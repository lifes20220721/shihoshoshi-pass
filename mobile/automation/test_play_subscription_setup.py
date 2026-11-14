import copy
import unittest
import play_subscription_setup as p


CONFIG = {'package_name': p.PACKAGE, 'product_id': 'shihoshi_premium'}


class FakeCatalog:
    def __init__(self):
        self.product = {'packageName': p.PACKAGE, 'productId': CONFIG['product_id'],
                        'listings': [{'languageCode': 'ja-JP', 'title': p.TITLE}]}
        self.calls, self.extra, self.bad_saved_state = [], [], False
        self.concurrent = False
        self.gets = 0

    def request(self, method, url, body=None):
        self.calls.append((method, url, copy.deepcopy(body)))
        if method == 'GET' and '/subscriptions?' in url:
            return {'subscriptions': [copy.deepcopy(self.product)] + self.extra}
        if method == 'GET':
            self.gets += 1
            result = copy.deepcopy(self.product)
            if self.concurrent and self.gets == 2:
                result['listings'][0]['title'] = 'Changed by owner'
            return result
        if method == 'PATCH':
            self.product.update(copy.deepcopy(body))
            for plan in self.product['basePlans']:
                plan['state'] = 'ACTIVE' if self.bad_saved_state else 'DRAFT'
            return copy.deepcopy(self.product)
        raise AssertionError('Unexpected catalog mutation')


class CatalogTests(unittest.TestCase):
    def test_read_only_inventory_discovers_actual_id_without_mutations(self):
        c = FakeCatalog()
        result = p.run(c, CONFIG, 'catalog-check')
        self.assertEqual(result['subscriptions'][0]['product_id'], 'shihoshi_premium')
        self.assertFalse(result['changes_saved'])
        self.assertTrue(all(method == 'GET' for method, _, _ in c.calls))

    def test_creates_japan_only_drafts_at_exact_consumer_prices_not_conversion(self):
        c = FakeCatalog()
        result = p.run(c, CONFIG, 'catalog-draft')
        self.assertTrue(result['draft_plans_verified'])
        self.assertFalse(result['activated'])
        patches = [(url, body) for method, url, body in c.calls if method == 'PATCH']
        self.assertEqual(len(patches), 1)
        self.assertIn('regionsVersion.version=2022%2F02', patches[0][0])
        self.assertEqual({plan['basePlanId']: plan['regionalConfigs'][0]['price']['units']
                          for plan in patches[0][1]['basePlans']}, {'monthly': '500', 'annual': '5000'})
        self.assertTrue(all('/edits' not in url and ':activate' not in url for _, url, _ in c.calls))
        self.assertTrue(all(method in ('GET', 'PATCH') for method, _, _ in c.calls))

    def test_permission_denial_stops_before_any_mutation(self):
        class Denied(FakeCatalog):
            def request(self, method, url, body=None):
                self.calls.append((method, url, body))
                raise p.SafeError('Google API returned HTTP 403')
        c = Denied()
        with self.assertRaisesRegex(p.SafeError, '403'):
            p.run(c, CONFIG, 'catalog-draft')
        self.assertEqual([x[0] for x in c.calls], ['GET'])

    def test_refuses_unexpected_existing_plans_and_multiple_products(self):
        for multiple in (True, False):
            c = FakeCatalog()
            if multiple:
                c.extra = [{'productId': 'another_product'}]
            else:
                c.product['basePlans'] = [{'basePlanId': 'other', 'state': 'ACTIVE'}]
            with self.assertRaises(p.SafeError):
                p.run(c, CONFIG, 'catalog-draft')
            self.assertTrue(all(method == 'GET' for method, _, _ in c.calls))

    def test_concurrent_console_changes_are_preserved(self):
        c = FakeCatalog(); c.concurrent = True
        with self.assertRaisesRegex(p.SafeError, 'concurrently'):
            p.run(c, CONFIG, 'catalog-draft')
        self.assertFalse(any(method == 'PATCH' for method, _, _ in c.calls))

    def test_draft_rerun_is_idempotent(self):
        c = FakeCatalog()
        p.run(c, CONFIG, 'catalog-draft')
        c.calls.clear()
        result = p.run(c, CONFIG, 'catalog-draft')
        self.assertTrue(result['already_configured'])
        self.assertTrue(all(method == 'GET' for method, _, _ in c.calls))

    def test_active_plan_or_wrong_price_is_not_reported_as_verified(self):
        c = FakeCatalog(); c.bad_saved_state = True
        with self.assertRaisesRegex(p.SafeError, 'unactivated'):
            p.run(c, CONFIG, 'catalog-draft')
        c = FakeCatalog(); p.run(c, CONFIG, 'catalog-draft')
        c.product['basePlans'][0]['regionalConfigs'][0]['price']['units'] = '550'
        c.calls.clear()
        with self.assertRaisesRegex(p.SafeError, 'price'):
            p.run(c, CONFIG, 'catalog-draft')
        self.assertTrue(all(method == 'GET' for method, _, _ in c.calls))

    def test_endpoint_guard_blocks_activation_purchases_and_other_apps(self):
        c = FakeCatalog(); guard = p.CatalogClient(c)
        for method, url in [('POST', p.PUBLISHER + '/subscriptions/shihoshi_premium/basePlans/monthly:activate'),
                            ('POST', p.PUBLISHER + '/edits'),
                            ('GET', p.PUBLISHER + '/purchases/subscriptions'),
                            ('PATCH', p.PUBLISHER.replace(p.PACKAGE, 'another.app') + '/subscriptions/shihoshi_premium')]:
            with self.assertRaises(p.SafeError):
                guard.request(method, url)
        self.assertEqual(c.calls, [])


if __name__ == '__main__':
    unittest.main()
