import copy
import unittest
import revenuecat_setup as r


class FakeCatalog(r.CatalogClient):
    def __init__(self):
        super().__init__('sk_' + 'fixture_not_a_real_secret_key')
        self.calls = []
        self.project_name = r.PROJECT_NAME
        self.apps = [{'id': 'appTest', 'name': 'Test Store', 'type': 'test_store', 'project_id': r.PROJECT}]
        self.products = [{'id': 'prodTest', 'store_identifier': 'monthly', 'type': 'subscription', 'app_id': 'appTest'}]
        self.entitlements = [{'id': r.ENTITLEMENT_ID, 'lookup_key': r.ENTITLEMENT}]
        self.offerings = [{'id': 'ofrngDefault', 'lookup_key': 'default', 'is_current': True}]
        self.packages = []
        self.ent_products = [self.products[0]]
        self.associations = {}
        self.fail_attachment_once = False
        self.public_key = 'goog_FixturePublicValue123'

    def _request(self, method, path, body=None):
        self.calls.append((method, path, copy.deepcopy(body)))
        prefix = r.PREFIX
        if path == '/v2/projects':
            return {'items': [{'id': r.PROJECT, 'name': self.project_name}]}
        for resource in ('apps', 'products', 'entitlements', 'offerings'):
            if path == prefix + '/' + resource:
                values = getattr(self, resource)
                if method == 'GET':
                    return {'items': copy.deepcopy(values)}
                saved = dict(copy.deepcopy(body), id={'apps': 'appPlay', 'products': 'prod' + str(len(values)), 'offerings': 'ofrngPlay'}.get(resource, 'unexpected'))
                if resource == 'apps':
                    saved['project_id'] = r.PROJECT
                values.append(saved)
                return copy.deepcopy(saved)
        if path == prefix + '/apps/appPlay':
            return copy.deepcopy(next(a for a in self.apps if a['id'] == 'appPlay'))
        if path == prefix + '/apps/appPlay/public_api_keys':
            return {'items': [{'key': self.public_key, 'environment': 'production', 'app_id': 'appPlay'}]}
        if path == prefix + '/offerings/ofrngPlay/packages':
            if method == 'GET':
                return {'items': copy.deepcopy(self.packages)}
            saved = dict(copy.deepcopy(body), id='pkge' + str(len(self.packages)))
            self.packages.append(saved)
            return copy.deepcopy(saved)
        if path == prefix + '/entitlements/' + r.ENTITLEMENT_ID + '/products':
            return {'items': copy.deepcopy(self.ent_products)}
        if path == prefix + '/entitlements/' + r.ENTITLEMENT_ID + '/actions/attach_products':
            self.ent_products += [p for p in self.products if p['id'] in body['product_ids'] and p not in self.ent_products]
            return {}
        for package in self.packages:
            key = package['id']
            if path == prefix + '/packages/' + key + '/products':
                return {'items': copy.deepcopy(self.associations.get(key, []))}
            if path == prefix + '/packages/' + key + '/actions/attach_products':
                if self.fail_attachment_once:
                    self.fail_attachment_once = False
                    raise r.SetupError('Simulated temporary attachment failure')
                product_id = body['products'][0]['product_id']
                self.associations[key] = [{'product': next(p for p in self.products if p['id'] == product_id), 'eligibility_criteria': 'all'}]
                return {}
        raise AssertionError('Unexpected fake catalog call: ' + path)


class RevenueCatSetupTests(unittest.TestCase):
    def test_adds_exact_android_catalog_and_keeps_test_store_and_current_offering(self):
        c = FakeCatalog(); original = copy.deepcopy((c.apps, c.products, c.offerings))
        result = r.run(c)
        self.assertTrue(result['catalog_links_verified'])
        self.assertFalse(result['released'])
        self.assertFalse(result['purchase_tests_completed'])
        self.assertEqual(c.apps[0], original[0][0])
        self.assertEqual(c.products[0], original[1][0])
        self.assertEqual(c.offerings[0], original[2][0])
        self.assertEqual({p['store_identifier'] for p in c.products if p['app_id'] == 'appPlay'}, {'shihoshoshi_premium:monthly', 'shihoshoshi_premium:annual'})
        self.assertEqual({p['lookup_key'] for p in c.packages}, {'$rc_monthly', '$rc_annual'})
        self.assertEqual(len(c.ent_products), 3)
        self.assertNotIn('sk_', str(result))

    def test_repeated_setup_does_not_duplicate_or_mutate(self):
        c = FakeCatalog(); r.run(c); c.calls.clear()
        result = r.run(c)
        self.assertFalse(result['changes_saved'])
        self.assertTrue(all(m == 'GET' for m, _, _ in c.calls))

    def test_wrong_project_or_entitlement_stops_before_writing(self):
        for bad_entitlement in (True, False):
            c = FakeCatalog()
            if bad_entitlement:
                c.entitlements[0]['lookup_key'] = 'another_entitlement'
            else:
                c.project_name = 'Another app'
            with self.assertRaises(r.SetupError):
                r.run(c)
            self.assertTrue(all(m == 'GET' for m, _, _ in c.calls))

    def test_different_play_package_is_not_changed(self):
        c = FakeCatalog(); c.apps.append({'id': 'appOther', 'type': 'play_store', 'play_store': {'package_name': 'another.app'}})
        with self.assertRaises(r.SetupError):
            r.run(c)
        self.assertTrue(all(m == 'GET' for m, _, _ in c.calls))

    def test_partial_setup_can_resume_without_duplicate_products(self):
        c = FakeCatalog(); c.fail_attachment_once = True
        with self.assertRaisesRegex(r.SetupError, 'temporary'):
            r.run(c)
        result = r.run(c)
        self.assertTrue(result['catalog_links_verified'])
        self.assertEqual(len(c.apps), 2)
        self.assertEqual(len(c.products), 3)
        self.assertEqual(len(c.packages), 2)
        self.assertEqual(len(c.offerings), 2)

    def test_conflicting_package_product_is_preserved(self):
        c = FakeCatalog(); r.run(c)
        key = c.packages[0]['id']
        c.associations[key] = [{'product': c.products[0], 'eligibility_criteria': 'all'}]
        original = copy.deepcopy(c.associations); c.calls.clear()
        with self.assertRaisesRegex(r.SetupError, 'differs'):
            r.run(c)
        self.assertEqual(c.associations, original)
        self.assertTrue(all(m == 'GET' for m, _, _ in c.calls))

    def test_public_key_output_never_accepts_secret_or_test_key(self):
        for value in ('sk_' + 'fake_secret_value_12345', 'test_FixtureValue123'):
            c = FakeCatalog(); c.public_key = value
            with self.assertRaisesRegex(r.SetupError, 'public SDK key'):
                r.run(c)

    def test_guard_blocks_customers_purchase_keys_and_other_project_mutations(self):
        c = FakeCatalog()
        for path, body in [(r.PREFIX + '/customers', {}),
                           (r.PREFIX + '/offerings/ofrngDefault', {'is_current': False}),
                           ('/v2/projects/projOther/apps', {}),
                           (r.PREFIX + '/apps', {'name': 'Other', 'type': 'play_store', 'play_store': {'package_name': 'another.app'}}),
                           (r.PREFIX + '/entitlements/' + r.ENTITLEMENT_ID + '/actions/attach_products', {'product_ids': ['prodOther']})]:
            with self.assertRaises(r.SetupError):
                c.post(path, body)
        for path in (r.PREFIX + '/customers', r.PREFIX + '/apps/appPlay/secret_api_keys'):
            with self.assertRaises(r.SetupError):
                c.get(path)
        self.assertEqual(c.calls, [])


if __name__ == '__main__':
    unittest.main()
