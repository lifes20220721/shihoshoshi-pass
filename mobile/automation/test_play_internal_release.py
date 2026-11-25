import copy
import json
import unittest

import play_internal_release as module
from test_play_draft_upload import fixture


class FakeGoogle:
    def __init__(self, config, data):
        self.config, self.data = config, data
        self.calls = []
        self.bundles = [{'versionCode': 2, 'sha256': '2' * 64}]
        self.tracks = [{'track': 'production', 'releases': []}, {'track': 'internal', 'releases': [
            {'name': 'internal v2', 'versionCodes': ['2'], 'status': 'completed'}]}]
        self.edited = copy.deepcopy(self.tracks)
        self.fail_commit = False
        self.alter_other_track = False

    def request(self, method, url, body=None, raw=False):
        self.calls.append((method, url, body))
        if method == 'POST' and url.endswith('/edits'):
            self.edited = copy.deepcopy(self.tracks)
            return {'id': 'test-edit'}
        if method == 'GET' and url.endswith('/bundles'):
            return {'bundles': copy.deepcopy(self.bundles)}
        if method == 'GET' and url.endswith('/tracks'):
            return {'tracks': copy.deepcopy(self.edited)}
        if method == 'GET' and 'drive/v3/files/' in url:
            return self.data
        if method == 'POST' and '/bundles?uploadType=media' in url:
            row = {'versionCode': 4, 'sha256': self.config['sha256']}
            self.bundles.append(row)
            return json.dumps(row).encode()
        if method == 'PUT' and url.endswith('/tracks/internal'):
            self.edited[1] = copy.deepcopy(body)
            if self.alter_other_track:
                self.edited[0]['releases'] = [{'versionCodes': ['4'], 'status': 'completed'}]
            return body
        if method == 'POST' and url.endswith(':validate'):
            return {}
        if method == 'POST' and ':commit?' in url:
            if self.fail_commit:
                raise module.SafeError('Google API returned HTTP 400')
            self.tracks = copy.deepcopy(self.edited)
            return {}
        if method == 'DELETE' and url.endswith('/test-edit'):
            self.edited = copy.deepcopy(self.tracks)
            return {}
        raise AssertionError((method, url))


class InternalReleaseTests(unittest.TestCase):
    def setUp(self):
        self.data, self.config = fixture()
        self.config.update(version_code=4, package_name=module.PACKAGE, track='internal',
                           mode='publish-internal', previous_internal_versions=['2'],
                           referral_benefits_enabled=False)
        self.client = FakeGoogle(self.config, self.data)

    def test_internal_only_publish_and_readback(self):
        result = module.run(self.config, self.client)
        self.assertTrue(result['changes_committed'])
        self.assertFalse(result['production_track_written'])
        writes = [url for method, url, _ in self.client.calls if method == 'PUT']
        self.assertEqual(writes, [module.PUBLISHER + '/edits/test-edit/tracks/internal'])
        self.assertEqual(self.client.tracks[0]['releases'], [])
        self.assertEqual(self.client.tracks[1]['releases'][0]['status'], 'completed')

    def test_check_reads_without_upload_or_commit(self):
        self.config['mode'] = 'check'
        result = module.run(self.config, self.client)
        self.assertFalse(result['changes_committed'])
        self.assertFalse(any(method == 'PUT' or ':commit' in url or '/bundles?upload' in url
                             for method, url, _ in self.client.calls))

    def test_unexpected_internal_version_stops(self):
        self.client.tracks[1]['releases'][0]['versionCodes'] = ['3']
        with self.assertRaises(module.SafeError):
            module.run(self.config, self.client)
        self.assertFalse(any(method == 'PUT' for method, _, _ in self.client.calls))

    def test_wrong_bundle_hash_stops(self):
        self.client.bundles.append({'versionCode': 4, 'sha256': '0' * 64})
        with self.assertRaises(module.SafeError):
            module.run(self.config, self.client)
        self.assertFalse(any(method == 'PUT' for method, _, _ in self.client.calls))

    def test_other_track_change_stops_before_commit(self):
        self.client.alter_other_track = True
        with self.assertRaises(module.SafeError):
            module.run(self.config, self.client)
        self.assertFalse(any(':commit' in url for _, url, _ in self.client.calls))

    def test_commit_error_is_not_retried_with_different_review_options(self):
        self.client.fail_commit = True
        with self.assertRaises(module.SafeError):
            module.run(self.config, self.client)
        commits = [url for _, url, _ in self.client.calls if ':commit' in url]
        self.assertEqual(len(commits), 1)
        self.assertTrue(commits[0].endswith('?changesNotSentForReview=true'))

    def test_retry_same_registered_release_is_idempotent(self):
        self.client.bundles.append({'versionCode': 4, 'sha256': self.config['sha256']})
        self.client.tracks[1]['releases'][0]['versionCodes'] = ['4']
        result = module.run(self.config, self.client)
        self.assertTrue(result['already_available'])
        self.assertFalse(any(method == 'PUT' for method, _, _ in self.client.calls))

    def test_referral_or_production_request_rejected(self):
        for key, value in [('referral_benefits_enabled', True), ('track', 'production')]:
            config = dict(self.config, **{key: value})
            with self.assertRaises(module.SafeError):
                module.run(config, self.client)
        self.assertEqual(self.client.calls, [])


if __name__ == '__main__':
    unittest.main()
