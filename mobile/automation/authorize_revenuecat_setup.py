"""Owner-run Cloud Shell: authorize one billing credential setup for 60 minutes.

No RevenueCat key input and no Google private-key generation in the browser.
"""
from datetime import datetime, timedelta, timezone
import json
import subprocess

PROJECT = 'shihoshoshi-pass-ci'
NUMBER = '589479973554'
OWNER = 'life.s.20220721@gmail.com'
ACCOUNT_ID = 'revenuecat-billing'
ACCOUNT = ACCOUNT_ID + '@' + PROJECT + '.iam.gserviceaccount.com'
UPLOADER = 'play-draft-uploader@' + PROJECT + '.iam.gserviceaccount.com'


class SetupError(Exception):
    pass


def gcloud(args, allow_failure=False):
    result = subprocess.run(['gcloud', '--quiet', '--project=' + PROJECT] + args, capture_output=True, text=True)
    if result.returncode:
        if allow_failure:
            return None
        raise SetupError('Google Cloud step failed: ' + ' '.join(args[:3]))
    return result.stdout.strip()


def run():
    if gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']) != OWNER:
        raise SetupError('Select the Google Cloud owner account used for Play Console')
    if gcloud(['projects', 'describe', PROJECT, '--format=value(projectNumber)']) != NUMBER:
        raise SetupError('Google Cloud project number does not match')
    print('Verified owner and Google Cloud project. Preparing purchase verification setup.')
    gcloud(['services', 'enable', 'iam.googleapis.com', 'androidpublisher.googleapis.com',
            'playdeveloperreporting.googleapis.com', 'pubsub.googleapis.com'])
    account = gcloud(['iam', 'service-accounts', 'describe', ACCOUNT, '--format=json'], allow_failure=True)
    if account is None:
        gcloud(['iam', 'service-accounts', 'create', ACCOUNT_ID,
                '--display-name=RevenueCat purchase verification',
                '--description=Purchase verification and notifications for Shihoshoshi PASS'])
    value = json.loads(gcloud(['iam', 'service-accounts', 'describe', ACCOUNT, '--format=json']))
    if value.get('email') != ACCOUNT or value.get('projectId') != PROJECT:
        raise SetupError('Billing service account identity does not match')
    for role in ('roles/pubsub.editor', 'roles/monitoring.viewer'):
        gcloud(['projects', 'add-iam-policy-binding', PROJECT, '--member=serviceAccount:' + ACCOUNT,
                '--role=' + role, '--condition=None'])
    expires = (datetime.now(timezone.utc) + timedelta(minutes=60)).strftime('%Y-%m-%dT%H:%M:%SZ')
    condition = 'expression=request.time < timestamp("' + expires + '"),title=pass-revenuecat-bootstrap,description=One hour purchase verification credential setup'
    # This role is on the new billing service account only, never the project.
    gcloud(['iam', 'service-accounts', 'add-iam-policy-binding', ACCOUNT,
            '--member=serviceAccount:' + UPLOADER, '--role=roles/iam.serviceAccountKeyAdmin',
            '--condition=' + condition])
    return {'project_id': PROJECT, 'billing_service_account': ACCOUNT,
            'setup_authorized_for_account': UPLOADER, 'setup_permission_expires_at': expires,
            'authorization_scope': 'keys of revenuecat-billing service account only',
            'owner_private_key_created': False, 'revenuecat_secret_input_required': False,
            'play_permissions_verified': False, 'released': False}


if __name__ == '__main__':
    try:
        print(json.dumps(run()))
    except (SetupError, ValueError, KeyError, OSError, KeyboardInterrupt) as error:
        raise SystemExit(str(error) if isinstance(error, SetupError) else 'Setup stopped; private details not displayed') from None
