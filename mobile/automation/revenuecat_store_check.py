"""Read actual Google Play product state through RevenueCat; no store writes."""
import json
import os

from revenuecat_check import Client, SetupError

PROJECT = 'proj9ba19f6b'
APP = 'app1d9873660b'
PRODUCTS = {
    'prod007ac3be77': 'shihoshoshi_premium:monthly',
    'prode69827e01a': 'shihoshoshi_premium:annual',
}
PREFIX = '/v2/projects/' + PROJECT


class StoreClient(Client):
    def get(self, path):
        allowed = {PREFIX + '/products/' + item for item in PRODUCTS}
        allowed |= {path + '/store_state' for path in tuple(allowed)}
        if path not in allowed:
            raise SetupError('Only the two approved product reads are permitted')
        return self._request('GET', path)


def run(client):
    results = []
    for product, identifier in PRODUCTS.items():
        path = PREFIX + '/products/' + product
        catalog = client.get(path)
        if catalog.get('app_id') != APP or catalog.get('store_identifier') != identifier:
            raise SetupError('Approved product identity did not match; no store read attempted')
        state = client.get(path + '/store_state')
        if state.get('project_id') != PROJECT or state.get('product_id') != product or state.get('store') != 'play_store':
            raise SetupError('Unexpected product store-state identity')
        results.append({key: state.get(key) for key in (
            'project_id', 'product_id', 'store', 'store_status', 'common', 'store_state', 'warnings')})
    return {'mode': 'revenuecat-store-check', 'products': results,
            'changes_saved': False, 'purchase_tests_completed': False, 'released': False}


if __name__ == '__main__':
    try:
        print(json.dumps(run(StoreClient(os.environ.get('REVENUECAT_AUTOMATION_KEY'))), ensure_ascii=False))
    except (SetupError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(str(error)) from None
