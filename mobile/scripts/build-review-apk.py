"""Build and inspect the separate reviewer test APK without publishing it."""
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlparse
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'native/shihoshoshi/android-review-test'
SDK = Path('/workspace/pass-android-sdk')
RUNTIME = Path('/workspace/pass-android-build')
RUNTIME.mkdir(mode=0o700, exist_ok=True)
ANDROID_USER = Path('/workspace/pass-android-user')
ANDROID_USER.mkdir(mode=0o700, exist_ok=True)

trust = RUNTIME / 'cacerts'
if not trust.exists():
    shutil.copyfile('/usr/lib/jvm/java-21-openjdk-amd64/lib/security/cacerts', trust)
    trust.chmod(0o600)
for index, certificate in enumerate(sorted(Path('/usr/local/share/ca-certificates').glob('*.crt'))):
    alias = 'pass-build-environment-' + str(index)
    check = subprocess.run(['keytool', '-list', '-alias', alias, '-keystore', str(trust),
                            '-storepass', 'changeit'], capture_output=True)
    if check.returncode:
        subprocess.run(['keytool', '-importcert', '-noprompt', '-alias', alias, '-file', str(certificate),
                        '-keystore', str(trust), '-storepass', 'changeit'], check=True)

env = os.environ.copy()
options = ['-Djavax.net.ssl.trustStore=' + str(trust), '-Djavax.net.ssl.trustStorePassword=changeit']
proxy = urlparse(env.get('HTTPS_PROXY') or env.get('https_proxy') or '')
if proxy.hostname:
    options += ['-Dhttps.proxyHost=' + proxy.hostname, '-Dhttps.proxyPort=' + str(proxy.port or 80),
                '-Dhttp.proxyHost=' + proxy.hostname, '-Dhttp.proxyPort=' + str(proxy.port or 80),
                '-Dhttp.nonProxyHosts=localhost|127.0.0.1']
env['JAVA_TOOL_OPTIONS'] = ' '.join(filter(None, [env.get('JAVA_TOOL_OPTIONS', ''), *options]))
env['ANDROID_HOME'] = str(SDK)
env['ANDROID_SDK_ROOT'] = str(SDK)
env['ANDROID_USER_HOME'] = str(ANDROID_USER)
env['GRADLE_USER_HOME'] = '/workspace/pass-gradle-cache'
env['JAVA_HOME'] = '/workspace/pass-java-runtime/usr/lib/jvm/java-21-openjdk-amd64'
env['PATH'] = env['JAVA_HOME'] + '/bin:' + env.get('PATH', '')
# Refresh the separate test project's web assets on every rebuild.
web_assets = ROOT / 'dist/shihoshoshi'
if not (web_assets / 'app.js').is_file():
    raise RuntimeError('Build web assets before building the test APK')
packaged_assets = PROJECT / 'app/src/main/assets/public'
if packaged_assets.exists():
    shutil.rmtree(packaged_assets)
shutil.copytree(web_assets, packaged_assets)
subprocess.run(['/workspace/pass-gradle-runtime/gradle-8.14.3/bin/gradle', '--no-daemon', '--console=plain',
                '--max-workers=2', '-Porg.gradle.java.installations.paths=' + env['JAVA_HOME'],
                '-Porg.gradle.java.installations.auto-detect=false', '-p', str(PROJECT), 'assembleDebug'], env=env, check=True)

apk = PROJECT / 'app/build/outputs/apk/debug/app-debug.apk'
output = Path('/workspace/shihoshoshi-pass-review-test.apk')
shutil.copyfile(apk, output)
output.chmod(0o600)
tools = SDK / 'build-tools/35.0.0'
subprocess.run([str(tools / 'apksigner'), 'verify', '--verbose', '--print-certs', str(output)], env=env, check=True)
badging = subprocess.run([str(tools / 'aapt'), 'dump', 'badging', str(output)], capture_output=True, text=True, check=True).stdout
if "package: name='com.shihoshoshipass.app.reviewtest'" not in badging:
    raise RuntimeError('Unexpected APK package; refusing to hand off')
for line in badging.splitlines():
    if line.startswith(('package:', 'sdkVersion:', 'targetSdkVersion:', 'application-label:')):
        print(line, flush=True)

handoff = json.loads(Path('/workspace/pass-review-connect-handoff.json').read_text())
private_state = json.loads(Path(handoff['privateStateFile']).read_text())
credentials = json.loads((Path(handoff['privateStateFile']).parent / 'reviewer-credentials.json').read_text())
secrets = [private_state['signingPrivateKey'].encode(), private_state['encryptionPrivateKey']['d'].encode(), credentials['password'].encode()]
found_endpoint = False
with zipfile.ZipFile(output) as archive:
    for item in archive.infolist():
        data = archive.read(item)
        if any(secret in data for secret in secrets):
            raise RuntimeError('Private credential found in APK; do not distribute')
        if item.filename == 'assets/public/app.js':
            found_endpoint = b'https://xs366651.xsrv.jp/pass-review' in data
if not found_endpoint:
    raise RuntimeError('Live reviewer endpoint missing from APK')
result = {'apk': str(output), 'packageId': 'com.shihoshoshipass.app.reviewtest',
          'versionCode': int(re.search(r"versionCode='(\d+)'", badging).group(1)),
          'versionName': re.search(r"versionName='([^']+)'", badging).group(1),
          'displayName': '司法書士PASS（確認用）', 'bytes': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'signatureVerified': True,
          'liveReviewerEndpointIncluded': True, 'privateCredentialsIncluded': False,
          'existingAppOverwritten': False, 'publishedToGooglePlay': False, 'deviceTested': False}
(ROOT / 'ANDROID-APK-RESULT.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False), flush=True)
