"""Read subscriptions or add the approved JP plans as drafts; never activate."""
import argparse
import copy
import json
import os
from pathlib import Path
from urllib.parse import urlencode, quote

from play_draft_upload import GoogleClient, PACKAGE, PUBLISHER, SafeError

TITLE = '司法書士PASS 全機能プラン'
EXPECTED = {'monthly': ('P1M', '500'), 'annual': ('P1Y', '5000')}
# Official RegionsVersion supports older published versions. Japan/JPY is
# unchanged in 2022/02; no currency conversion is needed for fixed JP prices.
REGIONS_VERSION = '2022/02'


class CatalogClient:
    """Keep catalog operations away from release, purchase and activation APIs."""
    def __init__(self, client):
        self.client = client

    def request(self, method, url, body=None):
        root = PUBLISHER + '/subscriptions'
        path = url.split('?', 1)[0]
        allowed_read = method == 'GET' and (path == root or
            path == root + '/shihoshi_premium' or path == root + '/shihoshoshi_premium')
        allowed_patch = method == 'PATCH' and path in (
            root + '/shihoshi_premium', root + '/shihoshoshi_premium')
        if not (allowed_read or allowed_patch):
            raise SafeError('Catalog endpoint is not permitted')
        return self.client.request(method, url, body)


def inventory(client):
    result, page = [], ''
    for _ in range(20):
        query = {'pageSize': 100}
        if page:
            query['pageToken'] = page
        response = client.request('GET', PUBLISHER + '/subscriptions?' + urlencode(query))
        result.extend(response.get('subscriptions', []))
        page = response.get('nextPageToken')
        if not page:
            return result
    raise SafeError('Catalog pagination exceeded its limit')


def summary(product):
    return {'product_id': product.get('productId'),
            'titles': [listing.get('title') for listing in product.get('listings', [])],
            'base_plans': product.get('basePlans', [])}


def verify_plans(plans, allow_partial=False):
    identifiers = {p.get('basePlanId') for p in plans}
    if (len(identifiers) != len(plans) or not identifiers <= set(EXPECTED)
            or not allow_partial and identifiers != set(EXPECTED)):
        raise SafeError('Existing base plans differ; no replacement or price migration is permitted')
    for plan in plans:
        duration, amount = EXPECTED[plan['basePlanId']]
        if plan.get('state') != 'DRAFT':
            raise SafeError('Only unactivated draft plans are permitted')
        if plan.get('autoRenewingBasePlanType', {}).get('billingPeriodDuration') != duration:
            raise SafeError('Unexpected subscription billing period')
        if 'prepaidBasePlanType' in plan or 'installmentsBasePlanType' in plan:
            raise SafeError('Unexpected subscription renewal type')
        available = [r for r in plan.get('regionalConfigs', []) if r.get('newSubscriberAvailability')]
        if len(available) != 1 or available[0].get('regionCode') != 'JP':
            raise SafeError('Only Japan availability is approved')
        price = available[0].get('price', {})
        if price.get('currencyCode') != 'JPY' or str(price.get('units')) != amount or int(price.get('nanos', 0)) != 0:
            raise SafeError('Unexpected subscription price')
        if plan.get('otherRegionsConfig', {}).get('newSubscriberAvailability'):
            raise SafeError('Future-region sales are not approved')


def run(raw_client, config, mode):
    if mode not in ('catalog-check', 'catalog-draft'):
        raise SafeError('Only catalog-check and catalog-draft are supported')
    if config.get('package_name') != PACKAGE:
        raise SafeError('Unexpected catalog package')
    product_id = config.get('product_id')
    if product_id not in ('shihoshi_premium', 'shihoshoshi_premium'):
        raise SafeError('Unexpected product ID')
    client = CatalogClient(raw_client)
    products = inventory(client)
    if mode == 'catalog-check':
        return {'mode': mode, 'catalog_read_verified': True,
                'subscriptions': [summary(p) for p in products], 'changes_saved': False}
    candidates = [p for p in products if p.get('productId') == product_id]
    if len(products) != 1 or len(candidates) != 1:
        raise SafeError('Confirm the sole existing subscription before creating plans')
    url = PUBLISHER + '/subscriptions/' + quote(product_id, safe='')
    current = client.request('GET', url)
    if current.get('packageName') != PACKAGE or current.get('productId') != product_id:
        raise SafeError('Returned subscription identity does not match')
    listings = current.get('listings', [])
    if not any(l.get('title') == TITLE and l.get('languageCode') in ('ja-JP', 'ja') for l in listings):
        raise SafeError('Confirm Japanese subscription title before writing')
    previous_plans = copy.deepcopy(current.get('basePlans', []))
    verify_plans(previous_plans, allow_partial=True)
    previous_ids = {p['basePlanId'] for p in previous_plans}
    if previous_ids == set(EXPECTED):
        return {'mode': mode, 'draft_plans_verified': True, 'already_configured': True,
                'product_id': product_id, 'changes_saved': False, 'activated': False}
    plans = previous_plans + [{'basePlanId': identifier,
              'autoRenewingBasePlanType': {'billingPeriodDuration': duration},
              'regionalConfigs': [{'regionCode': 'JP', 'newSubscriberAvailability': True,
                  'price': {'currencyCode': 'JPY', 'units': amount, 'nanos': 0}}]}
             for identifier, (duration, amount) in EXPECTED.items() if identifier not in previous_ids]
    # Stop if the owner changed the catalog while this task was preparing its patch.
    if client.request('GET', url) != current:
        raise SafeError('Catalog changed concurrently; stopped without writing')
    body = {'packageName': PACKAGE, 'productId': product_id, 'basePlans': plans}
    query = urlencode({'updateMask': 'basePlans', 'regionsVersion.version': REGIONS_VERSION})
    client.request('PATCH', url + '?' + query, body)
    # The API creates plans as DRAFT. This program has no activation endpoint.
    saved = client.request('GET', url)
    verify_plans(saved.get('basePlans', []))
    if (saved.get('packageName') != PACKAGE or saved.get('productId') != product_id
            or any(saved.get(k) != v for k, v in current.items() if k != 'basePlans')):
        raise SafeError('Could not verify saved catalog metadata; inspect Play Console')
    saved_by_id = {p['basePlanId']: p for p in saved.get('basePlans', [])}
    if any(saved_by_id[p['basePlanId']] != p for p in previous_plans):
        raise SafeError('A pre-existing draft plan changed; inspect Play Console')
    return {'mode': mode, 'draft_plans_verified': True, 'product_id': product_id,
            'monthly_jpy': 500, 'annual_jpy': 5000, 'region': 'JP',
            'changes_saved': True, 'activated': False, 'sent_for_review': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--mode', choices=['catalog-check', 'catalog-draft'], required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    result = run(GoogleClient(os.environ.get('PLAY_ACCESS_TOKEN')), config, args.mode)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (SafeError, KeyError, ValueError, TypeError) as error:
        raise SystemExit(str(error)) from None
