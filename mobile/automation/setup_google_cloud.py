"""Run in the owner's Google Cloud Shell; creates no JSON or signing keys."""
import json
import subprocess

PROJECT = 'shihoshoshi-pass-ci'
NUMBER = '589479973554'
POOL = 'github-play-draft'
PROVIDER = 'github'
ACCOUNT = 'play-draft-uploader@' + PROJECT + '.iam.gserviceaccount.com'
POOL_NAME = f'projects/{NUMBER}/locations/global/workloadIdentityPools/{POOL}'
PROVIDER_NAME = POOL_NAME + '/providers/' + PROVIDER
ISSUER = 'https://token.actions.githubusercontent.com'
CONDITION = "assertion.repository_id == '1416556302' && assertion.repository == 'lifes20220721/shihoshoshi-pass' && assertion.ref == 'refs/heads/codex/store-apps-preparation' && assertion.workflow_ref == 'lifes20220721/shihoshoshi-pass/.github/workflows/play-draft-upload.yml@refs/heads/codex/store-apps-preparation'"
MAPPING = 'google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id'


def cloud(*args):
    result = subprocess.run(['gcloud', *args, '--project=' + PROJECT, '--format=json', '--quiet'],
                            text=True, stdout=subprocess.PIPE, check=True)
    return json.loads(result.stdout or '{}')


def setup():
    project = cloud('projects', 'describe', PROJECT)
    if str(project['projectNumber']) != NUMBER:
        raise RuntimeError('Unexpected project; no settings changed')
    cloud('services', 'enable', 'androidpublisher.googleapis.com', 'iam.googleapis.com',
          'iamcredentials.googleapis.com', 'sts.googleapis.com', 'drive.googleapis.com')
    accounts = cloud('iam', 'service-accounts', 'list')
    if not any(a.get('email') == ACCOUNT for a in accounts):
        cloud('iam', 'service-accounts', 'create', 'play-draft-uploader', '--display-name=Google Play draft uploader')
    if cloud('iam', 'service-accounts', 'keys', 'list', '--iam-account=' + ACCOUNT, '--managed-by=user'):
        raise RuntimeError('Existing user-managed keys require review; no keys were removed')
    policy = cloud('projects', 'get-iam-policy', PROJECT)
    if any('serviceAccount:' + ACCOUNT in b.get('members', []) for b in policy.get('bindings', [])):
        raise RuntimeError('Existing project-level service-account roles require review')
    pools = cloud('iam', 'workload-identity-pools', 'list', '--location=global')
    if not any(p.get('name') == POOL_NAME for p in pools):
        cloud('iam', 'workload-identity-pools', 'create', POOL, '--location=global',
              '--display-name=GitHub Play draft', '--disabled')
    flags = ['--location=global', '--workload-identity-pool=' + POOL]
    providers = cloud('iam', 'workload-identity-pools', 'providers', 'list', *flags)
    if any(p.get('name') != PROVIDER_NAME for p in providers):
        raise RuntimeError('Other providers exist in the dedicated pool; no impersonation grant created')
    if providers:
        existing = cloud('iam', 'workload-identity-pools', 'providers', 'describe', PROVIDER, *flags)
        if existing.get('oidc', {}).get('issuerUri') != ISSUER:
            raise RuntimeError('Different existing issuer requires review')
        condition = existing.get('attributeCondition', '')
        if condition and ''.join(condition.split()) != ''.join(CONDITION.split()):
            raise RuntimeError('Different existing condition requires review')
        action = 'update-oidc'
    else:
        action = 'create-oidc'
    cloud('iam', 'workload-identity-pools', 'providers', action, PROVIDER, *flags,
          '--issuer-uri=' + ISSUER, '--attribute-mapping=' + MAPPING,
          '--attribute-condition=' + CONDITION, '--no-disabled')
    provider = cloud('iam', 'workload-identity-pools', 'providers', 'describe', PROVIDER, *flags)
    if provider.get('state') != 'ACTIVE' or ''.join(provider.get('attributeCondition', '').split()) != ''.join(CONDITION.split()):
        raise RuntimeError('Provider condition/state was not verified')
    expected = {'google.subject': 'assertion.sub', 'attribute.repository': 'assertion.repository',
                'attribute.repository_id': 'assertion.repository_id'}
    if provider.get('attributeMapping') != expected:
        raise RuntimeError('Unexpected attribute mapping')
    cloud('iam', 'service-accounts', 'add-iam-policy-binding', ACCOUNT,
          '--role=roles/iam.workloadIdentityUser',
          '--member=principalSet://iam.googleapis.com/' + POOL_NAME + '/attribute.repository/lifes20220721/shihoshoshi-pass')
    cloud('iam', 'workload-identity-pools', 'update', POOL, '--location=global', '--no-disabled')
    print(json.dumps({'project_id': PROJECT, 'project_number': NUMBER, 'service_account': ACCOUNT,
                      'workload_identity_provider': PROVIDER_NAME, 'cloud_setup_verified': True,
                      'play_app_permissions_verified': False, 'drive_file_permission_verified': False}))


if __name__ == '__main__':
    setup()
