"""Download one approved signed AAB and check or save an internal DRAFT only."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import zipfile

PACKAGE = 'com.shihoshoshipass.app'
PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + PACKAGE
UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/' + PACKAGE
SETUP_V1_SHA256 = '919f030ad7fc61e01e5d6726e1c525c6dce7767d24916888d5a40b9e4acdc244'


class SafeError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise SafeError('Unexpected API redirect; credentials were not forwarded')


class GoogleClient:
    def __init__(self, token):
        if not token:
            raise SafeError('Google authentication is not configured')
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect)

    def request(self, method, url, body=None, raw=False):
        if not (url.startswith(PUBLISHER + '/') or url.startswith(UPLOAD + '/') or
                url.startswith('https://www.googleapis.com/drive/v3/files/')):
            raise SafeError('Unexpected API destination')
        headers = {'Authorization': 'Bearer ' + self.token}
        if body is not None:
            headers['Content-Type'] = 'application/octet-stream' if raw else 'application/json'
            if not raw:
                body = json.dumps(body).encode()
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=120) as response:
                data = response.read(150_000_001)
                if len(data) > 150_000_000:
                    raise SafeError('API response exceeds the size limit')
                return data if raw else json.loads(data or b'{}')
        except urllib.error.HTTPError as error:
            # Log only bounded canonical status/reason codes, never message,
            # headers or arbitrary response fields that could contain secrets.
            reasons = []
            unsupported_review_flag = False
            try:
                detail = json.loads(error.read(16384)).get('error', {})
                # Retain only a recognized API compatibility hint, never arbitrary error text.
                message = detail.get('message', '')
                unsupported_review_flag = error.code == 400 and isinstance(message, str) and bool(
                    re.search(r'query parameter [\"\'`]?changesNotSentForReview[\"\'`]? must not be set', message, re.IGNORECASE))
                if unsupported_review_flag:
                    reasons.append('REVIEW_FLAG_UNSUPPORTED')
                if error.code == 400 and isinstance(message, str) and 'Only releases with status draft may be created on draft app' in message:
                    reasons.append('DRAFT_APP_REQUIRES_DRAFT_RELEASE')
                candidates = [detail.get('status')] + [e.get('reason') for e in detail.get('errors', [])] + [e.get('reason') for e in detail.get('details', [])]
                reasons = sorted(set(reasons) | {v for v in candidates if isinstance(v, str) and re.fullmatch(r'[A-Za-z_]{1,64}', v)})
            except (ValueError, TypeError, AttributeError):
                pass
            canonical = ' (' + ','.join(reasons) + ')' if reasons else ''
            hint = ' Confirm the first Play Console upload and app permissions.' if error.code in (400, 403, 404) else ''
            failure = SafeError(f'Google API returned HTTP {error.code}{canonical} for {method} {urllib.parse.urlparse(url).path}.' + hint)
            failure.unsupported_review_flag = unsupported_review_flag
            raise failure from None
        except (urllib.error.URLError, TimeoutError):
            raise SafeError('Google API connection failed; no automatic publication retry was attempted') from None


def validate_config(config):
    if config.get('package_name') != PACKAGE:
        raise SafeError('Unexpected app package')
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,100}', config.get('drive_file_id', '')):
        raise SafeError('Invalid AAB file reference')
    if not re.fullmatch(r'[a-f0-9]{64}', config.get('sha256', '')):
        raise SafeError('Expected signed AAB checksum is required')
    if type(config.get('version_code')) is not int or config['version_code'] < 1:
        raise SafeError('Invalid version code')
    if config.get('replace_setup_v1_draft') and (config.get('replace_setup_v1_draft') is not True or config['version_code'] != 2):
        raise SafeError('Only internal version 2 may replace the exact setup-v1 draft')
    if type(config.get('size')) is not int or not 1_000 <= config['size'] <= 150_000_000:
        raise SafeError('Invalid expected AAB size')


def verify_bundle(data, config):
    if len(data) != config['size'] or hashlib.sha256(data).hexdigest() != config['sha256']:
        raise SafeError('Signed AAB size or checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        if 'BundleConfig.pb' not in names or 'base/manifest/AndroidManifest.xml' not in names or archive.testzip():
            raise SafeError('Not a valid Android App Bundle')
        if not any(name.startswith('META-INF/') and name.upper().endswith(('.RSA', '.EC', '.DSA')) for name in names):
            raise SafeError('The AAB must already be signed')
        forbidden = {'upload.p12', 'upload-key-private.json', 'reviewer-credentials.json', 'client-state.json', 'accounts.json', 'signing.key', 'server.json'}
        if any(Path(name).name in forbidden for name in names):
            raise SafeError('Private configuration found in AAB')


def run(config, client, mode):
    validate_config(config)
    if mode not in ('connection', 'check', 'draft'):
        raise SafeError('Only connection, check and draft modes are supported')
    if mode != 'connection' and config.get('initial_console_upload_verified') is not True:
        raise SafeError('Verify the first AAB upload in Play Console before accessing Publisher edits')
    data = client.request('GET', 'https://www.googleapis.com/drive/v3/files/' + config['drive_file_id'] + '?alt=media', raw=True)
    verify_bundle(data, config)
    if mode == 'connection':
        return {'mode': mode, 'google_authentication_and_aab_download_verified': True,
                'aab_checksum_verified': True, 'publisher_access_verified': False, 'changes_committed': False}
    edit = None
    try:
        edit = client.request('POST', PUBLISHER + '/edits', {})['id']
        base = PUBLISHER + '/edits/' + urllib.parse.quote(edit, safe='')
        bundles = client.request('GET', base + '/bundles').get('bundles', [])
        existing = next((b for b in bundles if int(b['versionCode']) == config['version_code']), None)
        if existing and existing.get('sha256', '').lower() != config['sha256']:
            raise SafeError('This version code is already assigned to a different AAB')
        track = client.request('GET', base + '/tracks/internal')
        releases = track.get('releases', [])
        expected_versions = [str(config['version_code'])]
        previous = next((b for b in bundles if int(b['versionCode']) == 1), None)
        replace_setup = bool(config.get('replace_setup_v1_draft') is True and len(releases) == 1
                             and releases[0].get('status') == 'draft' and releases[0].get('versionCodes') == ['1']
                             and previous and previous.get('sha256', '').lower() == SETUP_V1_SHA256)
        if releases and not (len(releases) == 1 and releases[0].get('status') == 'draft' and
                             releases[0].get('versionCodes') == expected_versions and existing) and not replace_setup:
            raise SafeError('An existing internal release would be affected; stopped without changing it')
        if mode == 'check':
            return {'mode': mode, 'verified': True, 'bundle_already_registered': bool(existing),
                    'current_internal_release_versions': [r.get('versionCodes', []) for r in releases],
                    'current_internal_release_statuses': [r.get('status') for r in releases], 'changes_committed': False}
        if releases and not replace_setup:
            return {'mode': mode, 'already_saved_draft': True, 'version_code': config['version_code'], 'changes_committed': False}
        if not existing:
            uploaded = client.request('POST', UPLOAD + '/edits/' + urllib.parse.quote(edit, safe='') + '/bundles?uploadType=media', data, raw=True)
            # Upload requests send raw bytes but their successful response is JSON.
            uploaded = json.loads(uploaded) if isinstance(uploaded, bytes) else uploaded
            if int(uploaded.get('versionCode', -1)) != config['version_code'] or uploaded.get('sha256', '').lower() != config['sha256']:
                raise SafeError('Uploaded bundle did not match the expected version/checksum')
        draft = {'track': 'internal', 'releases': [{'name': config['draft_name'], 'versionCodes': expected_versions, 'status': 'draft'}]}
        client.request('PUT', base + '/tracks/internal', draft)
        client.request('POST', base + ':validate', {})
        client.request('POST', base + ':commit?changesNotSentForReview=true', {})
        edit = None
        edit = client.request('POST', PUBLISHER + '/edits', {})['id']
        saved = client.request('GET', PUBLISHER + '/edits/' + urllib.parse.quote(edit, safe='') + '/tracks/internal')
        if saved.get('releases') != draft['releases']:
            # The API may return additional fields; verify the security-relevant ones.
            actual = saved.get('releases', [])
            if len(actual) != 1 or actual[0].get('status') != 'draft' or actual[0].get('versionCodes') != expected_versions:
                raise SafeError('Could not verify the saved internal draft; inspect Play Console')
        return {'mode': mode, 'draft_verified': True, 'version_code': config['version_code'],
                'changes_committed': True, 'sent_for_review': False, 'replaced_preparation_draft': replace_setup}
    finally:
        if edit:
            try:
                client.request('DELETE', PUBLISHER + '/edits/' + urllib.parse.quote(edit, safe=''))
            except SafeError:
                pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--mode', choices=['connection', 'check', 'draft'], default='connection')
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    if not config.get('enabled'):
        raise SafeError('Automation is disabled until keyless account setup and the AAB-only Viewer grant are verified')
    result = run(config, GoogleClient(os.environ.get('PLAY_ACCESS_TOKEN')), args.mode)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except (SafeError, KeyError, ValueError, zipfile.BadZipFile) as error:
        raise SystemExit(str(error)) from None
