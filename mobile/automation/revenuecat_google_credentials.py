"""Generate one billing credential in CI memory and send it to the fixed RC app."""
import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from revenuecat_check import Client, NoRedirect, SetupError

PROJECT = 'shihoshoshi-pass-ci'
ACCOUNT = 'revenuecat-billing@' + PROJECT + '.iam.gserviceaccount.com'
KEYS = 'https://iam.googleapis.com/v1/projects/' + PROJECT + '/serviceAccounts/' + urllib.parse.quote(ACCOUNT, safe='') + '/keys'
APP = '/v2/projects/proj9ba19f6b/apps/app1d9873660b'
PACKAGE = 'com.shihoshoshipass.app'


class Google:
    def __init__(self, token):
        if not token:
            raise SetupError('Google keyless access token is missing')
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect)

    def request(self, method, url, body=None):
        if not ((url == KEYS and method in ('GET', 'POST')) or
                (method == 'DELETE' and re.fullmatch(re.escape(KEYS) + r'/[a-f0-9]{20,64}', url))):
            raise SetupError('Google credential operation is outside the billing service account')
        if method == 'POST' and body != {'privateKeyType': 'TYPE_GOOGLE_CREDENTIALS_FILE', 'keyAlgorithm': 'KEY_ALG_RSA_2048'}:
            raise SetupError('Only the approved Google credential file type may be generated')
        request = urllib.request.Request(url, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with self.opener.open(request, timeout=60) as response:
                data = response.read(100001)
                if len(data) > 100000:
                    raise SetupError('Unexpectedly large Google credential response')
                return json.loads(data or b'{}')
        except urllib.error.HTTPError as error:
            raise SetupError(f'Google billing credential API returned HTTP {error.code} for {method}; check the one-hour setup authorization') from None
        except (urllib.error.URLError, TimeoutError):
            raise SetupError('Google credential connection failed; do not blindly repeat key creation') from None


def verify_app(app):
    if app.get('id') != 'app1d9873660b' or app.get('project_id') != 'proj9ba19f6b' or app.get('type') != 'play_store' or app.get('play_store', {}).get('package_name') != PACKAGE:
        raise SetupError('RevenueCat app identity does not match')


def run(google, revenuecat):
    # _request is used only with this fixed existing app and exact credential body.
    verify_app(revenuecat._request('GET', APP))
    keys = google.request('GET', KEYS).get('keys', [])
    if any(k.get('keyType') == 'USER_MANAGED' for k in keys):
        raise SetupError('Billing account already has a user key; preserve it and inspect RevenueCat instead of rotating it')
    key_id, uploaded = None, False
    credentials = {}
    try:
        key = google.request('POST', KEYS, {'privateKeyType': 'TYPE_GOOGLE_CREDENTIALS_FILE', 'keyAlgorithm': 'KEY_ALG_RSA_2048'})
        resource_id = key.get('name', '').rsplit('/', 1)[-1]
        if not re.fullmatch(r'[a-f0-9]{20,64}', resource_id):
            raise SetupError('Invalid Google key identifier; inspect the billing account')
        key_id = resource_id
        credentials = json.loads(base64.b64decode(key['privateKeyData'], validate=True))
        if credentials.get('project_id') != PROJECT or credentials.get('client_email') != ACCOUNT or credentials.get('type') != 'service_account' or credentials.get('private_key_id') != key_id or not credentials.get('private_key', '').startswith('-----BEGIN PRIVATE KEY-----'):
            raise SetupError('Generated credential identity does not match')
        revenuecat._request('POST', APP, {'play_store': {'play_service_account_credentials_json': json.dumps(credentials)}})
        uploaded = True
        verify_app(revenuecat._request('GET', APP))
        return {'mode': 'billing-credentials', 'google_credentials_uploaded': True,
                'service_account': ACCOUNT, 'private_key_id': key_id,
                'revenuecat_app_id': 'app1d9873660b', 'private_key_written_to_file': False,
                'play_permissions_verified': False, 'purchase_tests_completed': False,
                'released': False}
    finally:
        credentials.clear()
        if key_id and not uploaded:
            google.request('DELETE', KEYS + '/' + key_id)


def main():
    google = Google(os.environ.get('GOOGLE_SETUP_TOKEN'))
    rc = Client(os.environ.get('REVENUECAT_AUTOMATION_KEY'))
    # A new IAM binding may take time to propagate. Retry the read only.
    for attempt in range(4):
        try:
            result = run(google, rc)
            print(json.dumps(result))
            return
        except SetupError as error:
            if str(error).startswith('Google billing credential API returned HTTP 403 for GET') and attempt < 3:
                print('Waiting for the saved one-hour Google setup permission to propagate.')
                time.sleep(10)
                continue
            raise


if __name__ == '__main__':
    try:
        main()
    except (SetupError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(str(error) if isinstance(error, SetupError) else 'Credential setup stopped; private details not displayed') from None
