"""Add only the approved Android catalog, with read-back and no store release."""
import json
import os
from pathlib import Path
import re
import urllib.parse
from revenuecat_check import Client, SetupError, PROJECT_NAME, identifier

PROJECT = 'proj9ba19f6b'
PACKAGE = 'com.shihoshoshipass.app'
ENTITLEMENT = 'shihoshoshi_premium'
ENTITLEMENT_ID = 'entl88b51f2d0b'
OFFERING = 'shihoshoshi_subscription'
SPECS = [('$rc_monthly', 'shihoshoshi_premium:monthly', '月額プラン'),
         ('$rc_annual', 'shihoshoshi_premium:annual', '年額プラン')]
PREFIX = '/v2/projects/' + PROJECT


class CatalogClient(Client):
    def __init__(self, token):
        super().__init__(token)
        self.project = PROJECT
        self.app_id = None
        self.offering_id = None
        self.package_ids = set()
        self.product_ids = set()

    def get(self, path):
        parsed = urllib.parse.urlsplit(path)
        if parsed.scheme or parsed.netloc or parsed.fragment:
            raise SetupError('Unexpected catalog destination')
        allowed = parsed.path in ('/v2/projects',) or parsed.path in [PREFIX + '/' + p for p in ('apps', 'products', 'entitlements', 'offerings')]
        if self.app_id:
            allowed |= parsed.path in (PREFIX + '/apps/' + self.app_id, PREFIX + '/apps/' + self.app_id + '/public_api_keys')
        allowed |= parsed.path == PREFIX + '/entitlements/' + ENTITLEMENT_ID + '/products'
        if self.offering_id:
            allowed |= parsed.path == PREFIX + '/offerings/' + self.offering_id + '/packages'
        allowed |= any(parsed.path == PREFIX + '/packages/' + p + '/products' for p in self.package_ids)
        if not allowed:
            raise SetupError('Catalog read is outside the approved resources')
        return self._request('GET', path)

    def post(self, path, body):
        allowed = False
        if path == PREFIX + '/apps':
            allowed = body == {'name': '司法書士PASS Android', 'type': 'play_store', 'play_store': {'package_name': PACKAGE}}
        elif path == PREFIX + '/products':
            allowed = self.app_id is not None and body.get('app_id') == self.app_id and body.get('type') == 'subscription' and body.get('store_identifier') in [s[1] for s in SPECS] and set(body) == {'app_id', 'type', 'store_identifier', 'display_name'}
        elif path == PREFIX + '/offerings':
            allowed = body == {'lookup_key': OFFERING, 'display_name': '司法書士PASS 月額・年額'}
        elif self.offering_id and path == PREFIX + '/offerings/' + self.offering_id + '/packages':
            allowed = body in [{'lookup_key': spec[0], 'display_name': spec[2], 'position': i + 1} for i, spec in enumerate(SPECS)]
        elif path == PREFIX + '/entitlements/' + ENTITLEMENT_ID + '/actions/attach_products':
            allowed = set(body) == {'product_ids'} and bool(body['product_ids']) and set(body['product_ids']) <= self.product_ids
        elif any(path == PREFIX + '/packages/' + p + '/actions/attach_products' for p in self.package_ids):
            allowed = set(body) == {'products'} and len(body['products']) == 1 and body['products'][0] in [{'product_id': p, 'eligibility_criteria': 'all'} for p in self.product_ids]
        if not allowed:
            raise SetupError('Catalog mutation is outside the approved additions')
        return self._request('POST', path, body)


def unique(items, key, value):
    matches = [i for i in items if i.get(key) == value]
    if len(matches) > 1:
        raise SetupError('Duplicate catalog configuration; inspect before changing it')
    return matches[0] if matches else None


def run(client):
    project = unique(client.items('/v2/projects'), 'id', PROJECT)
    if not project or project.get('name') != PROJECT_NAME:
        raise SetupError('Expected existing project is not accessible')
    ent = unique(client.items(PREFIX + '/entitlements'), 'lookup_key', ENTITLEMENT)
    if not ent or ent.get('id') != ENTITLEMENT_ID:
        raise SetupError('Expected existing entitlement does not match')
    apps = client.items(PREFIX + '/apps')
    play_apps = [a for a in apps if a.get('type') == 'play_store']
    if any(a.get('play_store', {}).get('package_name') != PACKAGE for a in play_apps) or len(play_apps) > 1:
        raise SetupError('Unexpected existing Play app; no app changes made')
    changes = []
    if play_apps:
        app = play_apps[0]
    else:
        app = client.post(PREFIX + '/apps', {'name': '司法書士PASS Android', 'type': 'play_store', 'play_store': {'package_name': PACKAGE}})
        changes.append('created_play_app')
    client.app_id = identifier(app['id'])
    app = client.get(PREFIX + '/apps/' + client.app_id)
    if app.get('type') != 'play_store' or app.get('project_id') != PROJECT or app.get('play_store', {}).get('package_name') != PACKAGE:
        raise SetupError('Could not verify the saved Play app identity')
    products = client.items(PREFIX + '/products')
    app_products = [p for p in products if p.get('app_id') == client.app_id]
    if any(p.get('store_identifier') not in [s[1] for s in SPECS] or p.get('type') != 'subscription' for p in app_products):
        raise SetupError('Unexpected existing Android product; no replacements are permitted')
    by_store = {}
    for spec in SPECS:
        product = unique(app_products, 'store_identifier', spec[1])
        if not product:
            product = client.post(PREFIX + '/products', {'store_identifier': spec[1], 'app_id': client.app_id, 'type': 'subscription', 'display_name': spec[2]})
            changes.append('created_' + spec[1])
        if product.get('store_identifier') != spec[1] or product.get('app_id') != client.app_id or product.get('type') != 'subscription':
            raise SetupError('Saved Android product identity does not match')
        by_store[spec[1]] = identifier(product['id'])
    client.product_ids = set(by_store.values())
    offerings = client.items(PREFIX + '/offerings')
    offering = unique(offerings, 'lookup_key', OFFERING)
    if not offering:
        offering = client.post(PREFIX + '/offerings', {'lookup_key': OFFERING, 'display_name': '司法書士PASS 月額・年額'})
        changes.append('created_offering')
    client.offering_id = identifier(offering['id'])
    packages = client.items(PREFIX + '/offerings/' + client.offering_id + '/packages')
    if any(p.get('lookup_key') not in [s[0] for s in SPECS] for p in packages):
        raise SetupError('Unexpected package in target offering; no replacements are permitted')
    package_map = {}
    for position, spec in enumerate(SPECS, 1):
        package = unique(packages, 'lookup_key', spec[0])
        if not package:
            package = client.post(PREFIX + '/offerings/' + client.offering_id + '/packages', {'lookup_key': spec[0], 'display_name': spec[2], 'position': position})
            changes.append('created_package_' + spec[0])
        package_map[spec[0]] = identifier(package['id'])
    client.package_ids = set(package_map.values())
    attached = client.items(PREFIX + '/entitlements/' + ENTITLEMENT_ID + '/products')
    missing = client.product_ids - {p['id'] for p in attached}
    if missing:
        client.post(PREFIX + '/entitlements/' + ENTITLEMENT_ID + '/actions/attach_products', {'product_ids': sorted(missing)})
        changes.append('attached_entitlement_products')
    for spec in SPECS:
        package_id, product_id = package_map[spec[0]], by_store[spec[1]]
        path = PREFIX + '/packages/' + package_id + '/products'
        associations = client.items(path)
        if associations and not (len(associations) == 1 and associations[0].get('product', {}).get('id') == product_id and associations[0].get('eligibility_criteria') == 'all'):
            raise SetupError('Existing package association differs; stopped without replacing it')
        if not associations:
            client.post(PREFIX + '/packages/' + package_id + '/actions/attach_products', {'products': [{'product_id': product_id, 'eligibility_criteria': 'all'}]})
            changes.append('attached_package_' + spec[0])
        saved = client.items(path)
        if len(saved) != 1 or saved[0].get('product', {}).get('id') != product_id or saved[0].get('eligibility_criteria') != 'all':
            raise SetupError('Could not verify saved monthly/annual package association')
    attached = client.items(PREFIX + '/entitlements/' + ENTITLEMENT_ID + '/products')
    if not client.product_ids <= {p['id'] for p in attached}:
        raise SetupError('Could not verify saved entitlement associations')
    fresh = client.items(PREFIX + '/products')
    if not client.product_ids <= {p['id'] for p in fresh if p.get('app_id') == client.app_id and p.get('store_identifier') in by_store and p.get('type') == 'subscription'}:
        raise SetupError('Could not read back approved Android products')
    keys = client.items(PREFIX + '/apps/' + client.app_id + '/public_api_keys')
    public = [k.get('key') for k in keys if k.get('environment') == 'production' and k.get('app_id') == client.app_id and isinstance(k.get('key'), str) and re.fullmatch(r'goog_[A-Za-z0-9]+', k['key'])]
    if len(public) != 1:
        raise SetupError('Could not uniquely identify the Android public SDK key')
    return {'mode': 'revenuecat-setup', 'project_id': PROJECT, 'app_id': client.app_id,
            'package_name': PACKAGE, 'entitlement': ENTITLEMENT, 'offering': OFFERING,
            'offering_id': client.offering_id, 'products': by_store, 'packages': package_map,
            'public_android_sdk_key': public[0], 'catalog_links_verified': True,
            'changes_saved': bool(changes), 'changes': changes, 'google_service_credentials_configured': False,
            'google_play_prices_verified': False, 'purchase_tests_completed': False, 'released': False}


def main():
    request = json.loads(Path('mobile/automation/revenuecat-check-request.json').read_text())
    token = os.environ.get('REVENUECAT_AUTOMATION_KEY')
    if request.get('mode') == 'setup':
        print(json.dumps(run(CatalogClient(token)), ensure_ascii=False))
    elif request.get('mode') == 'check':
        from revenuecat_check import main as check
        check()
    else:
        raise SetupError('Unsupported RevenueCat setup mode')


if __name__ == '__main__':
    try:
        main()
    except (SetupError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(str(error)) from None
