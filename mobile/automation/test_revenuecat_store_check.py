import unittest
from unittest.mock import patch

from revenuecat_check import SetupError
from revenuecat_store_check import APP, PREFIX, PRODUCTS, StoreClient, run


class StoreReadTests(unittest.TestCase):
    def test_other_paths_rejected_before_network(self):
        client = StoreClient('sk_' + 'x' * 32)
        for path in (PREFIX + '/apps/' + APP, PREFIX + '/products/other/store_state',
                     'https://evil.example/store_state', PREFIX + '/products/prod007ac3be77/store_state?x=y'):
            with self.subTest(path=path), patch.object(client, '_request') as request:
                with self.assertRaises(SetupError):
                    client.get(path)
                request.assert_not_called()

    def test_identity_mismatch_prevents_store_read(self):
        client = StoreClient('sk_' + 'x' * 32)
        with patch.object(client, '_request', return_value={'app_id': 'wrong'}) as request:
            with self.assertRaises(SetupError):
                run(client)
            self.assertEqual(request.call_count, 1)

    def test_reads_each_fixed_product_without_mutation(self):
        calls = []
        def response(method, path):
            calls.append((method, path))
            product = path.split('/')[5]
            if path.endswith('/store_state'):
                return {'project_id': 'proj9ba19f6b', 'product_id': product, 'store': 'play_store',
                        'store_status': {'status': 'not_found'}, 'warnings': ['Base plan missing']}
            return {'app_id': APP, 'store_identifier': PRODUCTS[product]}
        client = StoreClient('sk_' + 'x' * 32)
        with patch.object(client, '_request', side_effect=response):
            result = run(client)
        self.assertEqual(len(calls), 4)
        self.assertTrue(all(method == 'GET' for method, _ in calls))
        self.assertFalse(result['changes_saved'])
        self.assertEqual(len(result['products']), 2)
