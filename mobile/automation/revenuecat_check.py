"""Read the intended RevenueCat project's configuration, never customer data."""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = 'https://api.revenuecat.com/v2'
PROJECT_NAME = '司法書士PASS'


class SetupError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise SetupError('Unexpected redirect; RevenueCat key was not forwarded')


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value):
        raise SetupError('Invalid configuration resource identifier')
    return value


class Client:
    def __init__(self, token):
        if isinstance(token, str):
            token = token.strip()
        if token == 'REVENUECAT_AUTOMATION_KEY':
            raise SetupError('Repository secret contains the setting name instead of the RevenueCat key; replace its value')
        if isinstance(token, str) and token.startswith(('test_', 'goog_', 'appl_', 'amzn_')):
            raise SetupError('Repository secret contains a public SDK key; use the V2 secret key from Secret API keys')
        if not isinstance(token, str) or not token.startswith('sk_'):
            raise SetupError('A RevenueCat v2 secret key is required in the repository secret')
        if len(token) < 20:
            raise SetupError('The saved RevenueCat secret key is incomplete')
        if re.search(r'\s', token):
            raise SetupError('The saved RevenueCat secret key contains internal whitespace; copy the key alone')
        self.token = token
        self.project = None
        self.opener = urllib.request.build_opener(NoRedirect)

    def get(self, path):
        parsed = urllib.parse.urlsplit(path)
        if parsed.scheme or parsed.netloc or parsed.fragment or not parsed.path.startswith('/v2/'):
            raise SetupError('Unexpected RevenueCat destination')
        if parsed.path != '/v2/projects':
            if not self.project:
                raise SetupError('Select the intended project before reading configuration')
            prefix = '/v2/projects/' + identifier(self.project)
            allowed = [prefix + '/' + resource for resource in ('apps', 'products', 'entitlements', 'offerings')]
            packages = re.fullmatch(re.escape(prefix) + r'/offerings/[A-Za-z0-9_-]{1,128}/packages', parsed.path)
            if parsed.path not in allowed and not packages:
                raise SetupError('Only intended-project catalog reads are permitted')
        return self._request('GET', path)

    def _request(self, method, path, body=None):
        headers = {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/json'}
        data = None
        if body is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(body).encode()
        request = urllib.request.Request('https://api.revenuecat.com' + path,
            headers=headers, data=data, method=method)
        try:
            with self.opener.open(request, timeout=45) as response:
                data = response.read(1_000_001)
                if len(data) > 1_000_000:
                    raise SetupError('RevenueCat configuration response is too large')
                return json.loads(data)
        except urllib.error.HTTPError as error:
            raise SetupError(f'RevenueCat configuration API returned HTTP {error.code} for {method} {urllib.parse.urlsplit(path).path}; verify project-configuration permission') from None
        except (urllib.error.URLError, TimeoutError):
            raise SetupError('RevenueCat connection failed') from None

    def items(self, path):
        results = []
        for _ in range(10):
            page = self.get(path)
            results.extend(page.get('items', []))
            following = page.get('next_page')
            if not following:
                return results
            # Never forward credentials to links outside this resource or host.
            if following.startswith(ROOT + '/'):
                following = following[len('https://api.revenuecat.com'):]
            parsed_next = urllib.parse.urlsplit(following)
            if parsed_next.scheme or parsed_next.netloc or parsed_next.fragment or parsed_next.path != urllib.parse.urlsplit(path).path:
                raise SetupError('Unexpected configuration pagination path')
            path = following
        raise SetupError('Too many configuration pages')


def select_fields(items, fields):
    return [{key: item.get(key) for key in fields} for item in items]


def run(client):
    projects = client.items('/v2/projects')
    matches = [p for p in projects if p.get('name') == PROJECT_NAME]
    if len(matches) != 1:
        raise SetupError('Could not uniquely identify the existing 司法書士PASS project; no changes made')
    client.project = identifier(matches[0]['id'])
    prefix = '/v2/projects/' + client.project
    apps = client.items(prefix + '/apps')
    products = client.items(prefix + '/products')
    entitlements = client.items(prefix + '/entitlements')
    offerings = client.items(prefix + '/offerings')
    packages = []
    for offering in offerings:
        packages.append({'offering_id': offering['id'],
                         'packages': select_fields(client.items(prefix + '/offerings/' + identifier(offering['id']) + '/packages'),
                                                  ('id', 'lookup_key', 'display_name', 'position'))})
    return {'mode': 'revenuecat-check', 'connection_verified': True,
            'project_id': client.project, 'project_name': PROJECT_NAME,
            'apps': select_fields(apps, ('id', 'name', 'type')),
            'products': select_fields(products, ('id', 'store_identifier', 'type', 'app_id')),
            'entitlements': select_fields(entitlements, ('id', 'lookup_key', 'display_name')),
            'offerings': select_fields(offerings, ('id', 'lookup_key', 'display_name', 'is_current')),
            'packages': packages, 'changes_saved': False}


def main():
    token = os.environ.get('REVENUECAT_AUTOMATION_KEY')
    if not token:
        print(json.dumps({'mode': 'revenuecat-check', 'connection_configured': False,
                          'required_repository_secret': 'REVENUECAT_AUTOMATION_KEY', 'changes_saved': False}))
        return
    print(json.dumps(run(Client(token)), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (SetupError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(str(error)) from None
