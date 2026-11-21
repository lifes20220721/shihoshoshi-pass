"""Verify the CI internal-test candidate and sign locally with the existing key."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('artifact_zip', type=Path)
parser.add_argument('--source-commit', required=True)
args = parser.parse_args()
if not re.fullmatch(r'[a-f0-9]{40}', args.source_commit):
    raise SystemExit('Expected an exact source commit')
root = Path(__file__).resolve().parents[1]
vault = Path('/workspace/.pass-android-upload')
output = Path('/workspace/shihoshoshi-pass-internal-v2.aab')
expected = {'unsigned.aab', 'AndroidManifest.xml', 'apps.json', 'review-access.public.json',
            'built-web-assets.tar.gz', 'build-provenance.json', 'SHA256SUMS'}
package = 'com.shihoshoshipass.app'
sdk_key = 'goog_hNkKnHvIzXxhhughngWycCKDLUY'
expected_cert = '0b9702d3ea6853d3c867fee29272e10cccd52354cf2bdfbe85a37e1c9f23b5cd'

with tempfile.TemporaryDirectory(prefix='pass-internal-verify-', dir='/workspace') as temp:
    folder = Path(temp)
    with zipfile.ZipFile(args.artifact_zip) as archive:
        names = archive.namelist()
        if len(names) != len(expected) or set(names) != expected:
            raise RuntimeError('Unexpected build artifact files')
        archive.extractall(folder)
    checked = set()
    for line in (folder / 'SHA256SUMS').read_text().splitlines():
        digest, name = line.split('  ', 1)
        if name not in expected - {'SHA256SUMS'} or name in checked:
            raise RuntimeError('Unexpected checksum entry')
        if hashlib.sha256((folder / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError('Build artifact checksum mismatch')
        checked.add(name)
    if checked != expected - {'SHA256SUMS'}:
        raise RuntimeError('Incomplete build artifact checksums')
    provenance = json.loads((folder / 'build-provenance.json').read_text())
    if (provenance.get('source_commit') != args.source_commit or provenance.get('repository') != 'lifes20220721/shihoshoshi-pass'
            or provenance.get('package') != package or provenance.get('version_code') != 2
            or provenance.get('released') is not False):
        raise RuntimeError('Build provenance did not match the reviewed source')
    manifest = ET.parse(folder / 'AndroidManifest.xml').getroot()
    android = '{http://schemas.android.com/apk/res/android}'
    if (manifest.get('package') != package or manifest.get(android + 'versionCode') != '2'
            or manifest.get(android + 'versionName') != '1.1.0-internal'):
        raise RuntimeError('Unexpected Android package or version')
    if manifest.find('application').get(android + 'debuggable', 'false') != 'false':
        raise RuntimeError('Debug builds cannot be used for this release candidate')
    if 'com.android.vending.BILLING' not in [p.get(android + 'name') for p in manifest.findall('uses-permission')]:
        raise RuntimeError('Google Play Billing permission is missing')
    app = json.loads((folder / 'apps.json').read_text())['shihoshoshi']
    if (app['bundleId'] != package or app['revenueCat']['android'] != sdk_key
            or app['entitlement'] != 'shihoshoshi_premium' or app['offering'] != 'shihoshoshi_subscription'):
        raise RuntimeError('Unexpected Android billing configuration')
    if json.loads((folder / 'review-access.public.json').read_text()) != json.loads((root / 'review-access.public.json').read_text()):
        raise RuntimeError('Reviewer public configuration changed')
    credentials = json.loads((vault / 'upload-key-private.json').read_text())
    state_root = Path('/workspace/.pass-review-connect-POgo16')
    state = json.loads((state_root / 'client-state.json').read_text())
    reviewer = json.loads((state_root / 'reviewer-credentials.json').read_text())
    secrets = [credentials['storePassword'].encode(), (vault / 'upload.p12').read_bytes(), reviewer['password'].encode(),
               state['signingPrivateKey'].encode(), state['encryptionPrivateKey']['d'].encode()]
    forbidden = {'upload.p12', 'upload-key-private.json', 'reviewer-credentials.json', 'client-state.json',
                 'accounts.json', 'signing.key', 'server.json', 'revenuecat-key.json'}
    files = 0
    with tarfile.open(folder / 'built-web-assets.tar.gz') as web, zipfile.ZipFile(folder / 'unsigned.aab') as aab:
        names = aab.namelist()
        if len(names) != len(set(names)) or 'BundleConfig.pb' not in names or aab.testzip() is not None:
            raise RuntimeError('Invalid Android App Bundle')
        if any(name.startswith('META-INF/') and name.upper().endswith(('.RSA', '.DSA', '.EC')) for name in names):
            raise RuntimeError('Expected an unsigned CI input')
        for member in web.getmembers():
            if not member.isfile():
                if not member.isdir():
                    raise RuntimeError('Unsupported web asset type')
                continue
            name = member.name.removeprefix('./')
            if name.startswith('/') or '..' in Path(name).parts:
                raise RuntimeError('Invalid web asset path')
            if aab.read('base/assets/public/' + name) != web.extractfile(member).read():
                raise RuntimeError('Web asset did not match the bundle')
            files += 1
        script = aab.read('base/assets/public/app.js')
        for value in [sdk_key.encode(), b'https://xs968799.xsrv.jp/pass-review', b'shihoshoshi_premium',
                      b'shihoshoshi_subscription', b'play_reviewer', b'Ed25519']:
            if value not in script:
                raise RuntimeError('A required public app configuration or reviewer check is missing')
        for name in names:
            if Path(name).name in forbidden or any(secret in aab.read(name) for secret in secrets):
                raise RuntimeError('Private credentials found; do not sign or distribute')
    env = os.environ.copy()
    env['JAVA_HOME'] = '/workspace/pass-java-runtime/usr/lib/jvm/java-21-openjdk-amd64'
    env['PATH'] = env['JAVA_HOME'] + '/bin:' + env.get('PATH', '')
    env['PASS_UPLOAD_STORE_PASSWORD'] = credentials['storePassword']
    cert = subprocess.run(['keytool', '-exportcert', '-keystore', str(vault / 'upload.p12'), '-storetype', 'PKCS12',
        '-storepass:env', 'PASS_UPLOAD_STORE_PASSWORD', '-alias', credentials['alias']],
        env=env, capture_output=True, check=True).stdout
    if hashlib.sha256(cert).hexdigest() != expected_cert:
        raise RuntimeError('Upload certificate differs from the registered application')
    signed = folder / 'signed.aab'
    shutil.copyfile(folder / 'unsigned.aab', signed)
    subprocess.run(['jarsigner', '-keystore', str(vault / 'upload.p12'), '-storetype', 'PKCS12',
        '-storepass:env', 'PASS_UPLOAD_STORE_PASSWORD', '-keypass:env', 'PASS_UPLOAD_STORE_PASSWORD',
        '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', str(signed), credentials['alias']],
        env=env, capture_output=True, check=True)
    verified = subprocess.run(['jarsigner', '-verify', str(signed)], env=env, capture_output=True, text=True, check=True)
    if 'jar verified.' not in verified.stdout:
        raise RuntimeError('Bundle signature verification failed')
    signed.chmod(0o600)
    os.replace(signed, output)
    result = {'aab': str(output), 'packageId': package, 'versionCode': 2, 'versionName': '1.1.0-internal',
        'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'sourceCommit': args.source_commit, 'signatureVerified': True, 'uploadCertificateSha256': expected_cert,
        'billingPermissionPresent': True, 'productionAndroidSdkConfigured': True, 'reviewerAccessIncluded': True,
        'assetFilesVerified': files, 'privateSecretsIncluded': False, 'purchasesTested': False,
        'uploadedToGooglePlay': False, 'released': False}
    (root / 'ANDROID-INTERNAL-V2-RESULT.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))
