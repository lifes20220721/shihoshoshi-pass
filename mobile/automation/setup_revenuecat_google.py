"""Owner-run Cloud Shell bootstrap; send a new billing key directly to RevenueCat.

No key is printed, committed, uploaded as an artifact or left in Cloud Shell.
This does not grant Play Console access or activate products or releases.
"""
import getpass
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.request

PROJECT = 'shihoshoshi-pass-ci'
PROJECT_NUMBER = '589479973554'
OWNER = 'life.s.20220721@gmail.com'
ACCOUNT_ID = 'revenuecat-billing'
ACCOUNT = ACCOUNT_ID + '@' + PROJECT + '.iam.gserviceaccount.com'
RC_APP = 'https://api.revenuecat.com/v2/projects/proj9ba19f6b/apps/app1d9873660b'
PACKAGE = 'com.shihoshoshipass.app'
APIS = ['iam.googleapis.com', 'androidpublisher.googleapis.com',
        'playdeveloperreporting.googleapis.com', 'pubsub.googleapis.com']
ROLES = ['roles/pubsub.editor', 'roles/monitoring.viewer']


class SetupError(Exception):
    pass


def gcloud(args, allow_failure=False):
    result = subprocess.run(['gcloud', '--quiet', '--project=' + PROJECT] + args,
                            capture_output=True, text=True)
    if result.returncode:
        if allow_failure:
            return None
        raise SetupError('Google Cloud step failed: ' + ' '.join(args[:3]) + '; no private command output displayed')
    return result.stdout.strip()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise SetupError('RevenueCat redirected unexpectedly; credentials were not forwarded')


def revenuecat(token, method, body=None):
    if method not in ('GET', 'POST'):
        raise SetupError('Unsupported RevenueCat operation')
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(RC_APP, data=data, method=method,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=60) as response:
            payload = response.read(100001)
            if len(payload) > 100000:
                raise SetupError('Unexpectedly large RevenueCat response')
            return json.loads(payload or b'{}')
    except urllib.error.HTTPError as error:
        raise SetupError(f'RevenueCat returned HTTP {error.code}; no response body or keys displayed') from None
    except (urllib.error.URLError, TimeoutError):
        raise SetupError('RevenueCat connection failed') from None


def verify_app(app):
    if app.get('id') != 'app1d9873660b' or app.get('project_id') != 'proj9ba19f6b' or app.get('type') != 'play_store' or app.get('play_store', {}).get('package_name') != PACKAGE:
        raise SetupError('RevenueCat app/package identity does not match')


def configure(token, state_path):
    token = token.strip()
    if not token.startswith('sk_') or any(c.isspace() for c in token) or len(token) < 20:
        raise SetupError('Use the pass-automation V2 secret key from Secret API keys')
    # Verify both owner identity and the destination before any cloud mutation.
    active = gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'])
    if active != OWNER:
        raise SetupError('Select the Google Cloud owner account used for Play Console before running this helper')
    number = gcloud(['projects', 'describe', PROJECT, '--format=value(projectNumber)'])
    if number != PROJECT_NUMBER:
        raise SetupError('Google Cloud project number does not match')
    verify_app(revenuecat(token, 'GET'))
    previous = json.loads(state_path.read_text()) if state_path.exists() else {}
    if previous.get('service_account') not in (None, ACCOUNT):
        raise SetupError('Existing local bootstrap record has a different service account')
    if previous.get('credentials_uploaded') is True:
        keys = json.loads(gcloud(['iam', 'service-accounts', 'keys', 'list', '--iam-account=' + ACCOUNT, '--format=json']))
        if any(k.get('name', '').endswith('/' + previous.get('private_key_id', 'missing')) and not k.get('disabled') for k in keys):
            return dict(previous, already_configured=True)
        raise SetupError('Previously uploaded Google key is no longer active; inspect RevenueCat before replacing credentials')
    print('Verified owner, Google Cloud project and RevenueCat app.')
    gcloud(['services', 'enable'] + APIS)
    account = gcloud(['iam', 'service-accounts', 'describe', ACCOUNT, '--format=json'], allow_failure=True)
    if account is None:
        gcloud(['iam', 'service-accounts', 'create', ACCOUNT_ID,
                '--display-name=RevenueCat purchase verification',
                '--description=Purchase verification and subscription notifications for Shihoshoshi PASS'])
    account = json.loads(gcloud(['iam', 'service-accounts', 'describe', ACCOUNT, '--format=json']))
    if account.get('email') != ACCOUNT or account.get('projectId') != PROJECT:
        raise SetupError('Created service account identity does not match')
    for role in ROLES:
        gcloud(['projects', 'add-iam-policy-binding', PROJECT,
                '--member=serviceAccount:' + ACCOUNT, '--role=' + role, '--condition=None'])
    keys = json.loads(gcloud(['iam', 'service-accounts', 'keys', 'list', '--iam-account=' + ACCOUNT, '--format=json']))
    if any(k.get('keyType') == 'USER_MANAGED' for k in keys):
        raise SetupError('This billing account already has a user key; inspect RevenueCat instead of creating another key')
    uploaded, key_id = False, None
    try:
        with tempfile.TemporaryDirectory(prefix='pass-revenuecat-') as directory:
            os.chmod(directory, 0o700)
            path = Path(directory) / 'credentials.json'
            # The file exists only inside this private temporary directory.
            gcloud(['iam', 'service-accounts', 'keys', 'create', str(path), '--iam-account=' + ACCOUNT])
            os.chmod(path, 0o600)
            credentials = json.loads(path.read_text())
            key_id = credentials.get('private_key_id')
            if credentials.get('client_email') != ACCOUNT or credentials.get('project_id') != PROJECT or not key_id or credentials.get('type') != 'service_account':
                raise SetupError('Generated credential identity does not match')
            # Exact app only; no private output and no GitHub credential storage.
            revenuecat(token, 'POST', {'play_store': {
                'play_service_account_credentials_json': json.dumps(credentials)}})
            uploaded = True
            verify_app(revenuecat(token, 'GET'))
            credentials.clear()
        result = {'project_id': PROJECT, 'service_account': ACCOUNT,
                  'revenuecat_app_id': 'app1d9873660b', 'private_key_id': key_id,
                  'credentials_uploaded': True, 'temporary_key_file_removed': True,
                  'play_app_permissions_verified': False, 'purchase_tests_completed': False,
                  'released': False}
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(result, indent=2) + '\n')
        os.chmod(state_path, 0o600)
        return result
    finally:
        # Revoke only this helper's new key if the upload did not succeed.
        # A key accepted by RevenueCat must stay active in Google Cloud.
        if key_id and not uploaded:
            gcloud(['iam', 'service-accounts', 'keys', 'delete', key_id, '--iam-account=' + ACCOUNT], allow_failure=True)


def main():
    if not os.isatty(0):
        raise SetupError('Run in the interactive Cloud Shell terminal; secret input must be hidden')
    token = ''
    while True:
        candidate = getpass.getpass('Paste the pass-automation secret key (hidden), then press Enter: ').strip()
        if candidate.startswith('sk_') and len(candidate) >= 20 and not any(c.isspace() for c in candidate):
            token = candidate
            candidate = ''
            break
        candidate = ''
        print('Still waiting: copy pass-automation from the upper Secret API keys section (starts with sk_).')
    try:
        result = configure(token, Path.home() / '.config/pass/revenuecat-google-setup.json')
        print(json.dumps(result))
    finally:
        token = ''


if __name__ == '__main__':
    try:
        main()
    except (SetupError, ValueError, KeyError, OSError, EOFError, KeyboardInterrupt) as error:
        if isinstance(error, SetupError):
            raise SystemExit(str(error)) from None
        raise SystemExit('Setup stopped; no private exception details displayed') from None
