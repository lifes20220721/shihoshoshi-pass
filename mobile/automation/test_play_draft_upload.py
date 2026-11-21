import hashlib
import io
import json
import unittest
import zipfile
import play_draft_upload as p


def fixture():
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        archive.writestr('BundleConfig.pb', b'config')
        archive.writestr('base/manifest/AndroidManifest.xml', b'manifest')
        archive.writestr('META-INF/TEST.RSA', b'x' * 1600)
    content = data.getvalue()
    config = {'package_name': p.PACKAGE, 'drive_file_id': 'approved_signed_aab', 'size': len(content),
              'sha256': hashlib.sha256(content).hexdigest(), 'version_code': 1, 'draft_name': 'Setup draft',
              'initial_console_upload_verified': True}
    return content, config


class FakeGoogle:
    def __init__(self, content, config, releases=None, registered=False):
        self.content, self.config = content, config
        self.calls, self.edits = [], 0
        self.releases = releases or []
        self.bundles = [{'versionCode': config['version_code'], 'sha256': config['sha256']}] if registered else []
        self.upload_hash = config['sha256']

    def request(self, method, url, body=None, raw=False):
        self.calls.append((method, url, body))
        if url.startswith('https://www.googleapis.com/drive/'):
            return self.content
        if url == p.PUBLISHER + '/edits':
            self.edits += 1
            return {'id': str(self.edits)}
        if method == 'DELETE':
            return {}
        if url.startswith(p.UPLOAD):
            return json.dumps({'versionCode': self.config['version_code'], 'sha256': self.upload_hash}).encode()
        if url.endswith('/bundles'):
            return {'bundles': self.bundles}
        if url.endswith('/tracks/internal'):
            if method == 'PUT':
                self.releases = body['releases']
            return {'track': 'internal', 'releases': self.releases}
        if ':validate' in url or ':commit' in url:
            return {}
        raise AssertionError('Unexpected API call: ' + url)


class DraftUploadTests(unittest.TestCase):
    def test_replace_only_verified_unpublished_setup_with_internal_v2(self):
        data, config = fixture(); config.update(version_code=2, replace_setup_v1_draft=True)
        client = FakeGoogle(data, config, [{'status': 'draft', 'versionCodes': ['1']}])
        client.bundles = [{'versionCode': 1, 'sha256': p.SETUP_V1_SHA256}]
        result = p.run(config, client, 'draft')
        self.assertTrue(result['draft_verified'])
        self.assertTrue(result['replaced_preparation_draft'])
        self.assertEqual(client.releases[0]['status'], 'draft')
        self.assertEqual(client.releases[0]['versionCodes'], ['2'])
        self.assertFalse(result['sent_for_review'])
        self.assertTrue(all(url.endswith(':commit?changesNotSentForReview=true') for _, url, _ in client.calls if ':commit' in url))

    def test_wrong_old_bundle_active_release_and_unapproved_replacement_are_preserved(self):
        for status, digest, flag in [('completed', p.SETUP_V1_SHA256, True),
                                     ('draft', '0' * 64, True), ('draft', p.SETUP_V1_SHA256, False)]:
            with self.subTest(status=status, digest=digest, flag=flag):
                data, config = fixture(); config.update(version_code=2, replace_setup_v1_draft=flag)
                client = FakeGoogle(data, config, [{'status': status, 'versionCodes': ['1']}])
                client.bundles = [{'versionCode': 1, 'sha256': digest}]
                with self.assertRaisesRegex(p.SafeError, 'existing internal release'):
                    p.run(config, client, 'draft')
                self.assertFalse(any(method == 'PUT' or ':commit' in url or url.startswith(p.UPLOAD) for method, url, _ in client.calls))

    def test_internal_v2_preflight_does_not_replace_and_saved_v2_is_idempotent(self):
        data, config = fixture(); config.update(version_code=2, replace_setup_v1_draft=True)
        client = FakeGoogle(data, config, [{'status': 'draft', 'versionCodes': ['1']}])
        client.bundles = [{'versionCode': 1, 'sha256': p.SETUP_V1_SHA256}]
        self.assertTrue(p.run(config, client, 'check')['verified'])
        self.assertFalse(any(method == 'PUT' or ':commit' in url or url.startswith(p.UPLOAD) for method, url, _ in client.calls))
        client = FakeGoogle(data, config, [{'status': 'draft', 'versionCodes': ['2']}], registered=True)
        self.assertTrue(p.run(config, client, 'draft')['already_saved_draft'])
        self.assertFalse(any(method == 'PUT' or ':commit' in url or url.startswith(p.UPLOAD) for method, url, _ in client.calls))

    def test_replace_flag_does_not_authorize_other_new_versions(self):
        data, config = fixture(); config.update(version_code=3, replace_setup_v1_draft=True)
        client = FakeGoogle(data, config)
        with self.assertRaisesRegex(p.SafeError, 'Only internal version 2'):
            p.run(config, client, 'draft')
        self.assertEqual(client.calls, [])

    def test_connection_mode_does_not_call_publisher_before_first_upload(self):
        data, config = fixture(); config['initial_console_upload_verified'] = False
        client = FakeGoogle(data, config)
        result = p.run(config, client, 'connection')
        self.assertTrue(result['google_authentication_and_aab_download_verified'])
        self.assertFalse(result['publisher_access_verified'])
        self.assertEqual(len(client.calls), 1)
        self.assertTrue(client.calls[0][1].startswith('https://www.googleapis.com/drive/'))

    def test_publisher_modes_require_verified_first_console_upload(self):
        data, config = fixture(); config['initial_console_upload_verified'] = False
        client = FakeGoogle(data, config)
        for mode in ('check', 'draft'):
            with self.assertRaisesRegex(p.SafeError, 'first AAB upload'):
                p.run(config, client, mode)
        self.assertEqual(client.calls, [])

    def test_check_never_uploads_changes_track_or_commits(self):
        data, config = fixture(); client = FakeGoogle(data, config)
        self.assertTrue(p.run(config, client, 'check')['verified'])
        self.assertFalse(any(url.startswith(p.UPLOAD) or method == 'PUT' or ':commit' in url for method, url, body in client.calls))
        self.assertEqual(client.calls[-1][0], 'DELETE')

    def test_apply_creates_only_internal_draft_without_sending_review(self):
        data, config = fixture(); client = FakeGoogle(data, config)
        self.assertTrue(p.run(config, client, 'draft')['draft_verified'])
        changes = [(url, body) for method, url, body in client.calls if method == 'PUT']
        self.assertEqual(len(changes), 1)
        self.assertTrue(changes[0][0].endswith('/tracks/internal'))
        self.assertEqual(changes[0][1]['releases'][0]['status'], 'draft')
        commits = [url for method, url, body in client.calls if ':commit' in url]
        self.assertEqual(len(commits), 1)
        self.assertTrue(commits[0].endswith(':commit?changesNotSentForReview=true'))

    def test_existing_saved_draft_is_not_changed(self):
        data, config = fixture()
        client = FakeGoogle(data, config, [{'name': 'Manual draft', 'status': 'draft', 'versionCodes': ['1']}], True)
        self.assertTrue(p.run(config, client, 'draft')['already_saved_draft'])
        self.assertFalse(any(method == 'PUT' or ':commit' in url or url.startswith(p.UPLOAD) for method, url, body in client.calls))

    def test_existing_other_release_is_preserved(self):
        data, config = fixture(); client = FakeGoogle(data, config, [{'status': 'completed', 'versionCodes': ['1']}], True)
        with self.assertRaisesRegex(p.SafeError, 'existing internal release'):
            p.run(config, client, 'draft')
        self.assertFalse(any(method == 'PUT' or ':commit' in url or url.startswith(p.UPLOAD) for method, url, body in client.calls))
        self.assertEqual(client.calls[-1][0], 'DELETE')

    def test_existing_version_with_different_digest_is_rejected(self):
        data, config = fixture(); client = FakeGoogle(data, config, registered=True)
        client.bundles[0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(p.SafeError, 'different AAB'):
            p.run(config, client, 'draft')
        self.assertEqual(client.calls[-1][0], 'DELETE')

    def test_unexpected_uploaded_hash_is_never_committed(self):
        data, config = fixture(); client = FakeGoogle(data, config); client.upload_hash = '0' * 64
        with self.assertRaisesRegex(p.SafeError, 'expected version/checksum'):
            p.run(config, client, 'draft')
        self.assertFalse(any(method == 'PUT' or ':commit' in url for method, url, body in client.calls))
        self.assertEqual(client.calls[-1][0], 'DELETE')

    def test_downloaded_wrong_bytes_are_rejected_before_play_calls(self):
        data, config = fixture(); client = FakeGoogle(data + b'changed', config)
        with self.assertRaisesRegex(p.SafeError, 'checksum mismatch'):
            p.run(config, client, 'draft')
        self.assertEqual(len(client.calls), 1)

    def test_wrong_package_and_release_mode_are_rejected_before_network(self):
        data, config = fixture(); client = FakeGoogle(data, config)
        with self.assertRaises(p.SafeError):
            p.run({**config, 'package_name': 'another.app'}, client, 'draft')
        with self.assertRaises(p.SafeError):
            p.run(config, client, 'production')
        self.assertEqual(client.calls, [])


if __name__ == '__main__':
    unittest.main()
