import base64
import contextlib
import io
import json
import unittest
from unittest.mock import patch
import revenuecat_google_credentials as c
import authorize_revenuecat_setup as a


KEY_ID = 'a' * 40


class FakeGoogle:
    def __init__(self):
        self.calls, self.existing, self.wrong_email = [], False, False

    def request(self, method, url, body=None):
        self.calls.append((method, url, body))
        if method == 'GET':
            return {'keys': [{'keyType': 'USER_MANAGED'}]} if self.existing else {}
        if method == 'DELETE':
            return {}
        value = {'type': 'service_account', 'project_id': c.PROJECT,
                 'client_email': 'another@example.invalid' if self.wrong_email else c.ACCOUNT,
                 'private_key_id': KEY_ID, 'private_key': '-----BEGIN PRIVATE KEY-----\nfixture_only_do_not_log'}
        return {'name': 'projects/p/serviceAccounts/a/keys/' + KEY_ID,
                'privateKeyData': base64.b64encode(json.dumps(value).encode()).decode()}


class FakeRevenueCat:
    def __init__(self):
        self.calls, self.wrong_app, self.fail_upload = [], False, False

    def _request(self, method, path, body=None):
        self.calls.append((method, path, body))
        if method == 'POST' and self.fail_upload:
            raise c.SetupError('Simulated credential upload failure')
        return {'id': 'app1d9873660b', 'project_id': 'proj9ba19f6b', 'type': 'play_store',
                'play_store': {'package_name': 'another.app' if self.wrong_app else c.PACKAGE}}


class BillingCredentialTests(unittest.TestCase):
    def test_upload_holds_private_key_in_memory_and_reports_only_public_status(self):
        g, rc = FakeGoogle(), FakeRevenueCat()
        result = c.run(g, rc)
        self.assertTrue(result['google_credentials_uploaded'])
        self.assertFalse(result['private_key_written_to_file'])
        self.assertFalse(result['released'])
        self.assertNotIn('fixture_only', str(result))
        self.assertEqual([m for m, _, _ in g.calls], ['GET', 'POST'])
        self.assertTrue(all(path == c.APP for _, path, _ in rc.calls))
        body = next(b for m, _, b in rc.calls if m == 'POST')
        private = json.loads(body['play_store']['play_service_account_credentials_json'])
        self.assertEqual(private['client_email'], c.ACCOUNT)

    def test_failed_upload_revokes_only_this_new_key(self):
        g, rc = FakeGoogle(), FakeRevenueCat(); rc.fail_upload = True
        with self.assertRaisesRegex(c.SetupError, 'upload failure'):
            c.run(g, rc)
        self.assertEqual(g.calls[-1], ('DELETE', c.KEYS + '/' + KEY_ID, None))

    def test_existing_key_is_not_rotated_or_deleted(self):
        g, rc = FakeGoogle(), FakeRevenueCat(); g.existing = True
        with self.assertRaisesRegex(c.SetupError, 'already has a user key'):
            c.run(g, rc)
        self.assertEqual([m for m, _, _ in g.calls], ['GET'])
        self.assertEqual([m for m, _, _ in rc.calls], ['GET'])

    def test_wrong_app_stops_before_google_key_operations(self):
        g, rc = FakeGoogle(), FakeRevenueCat(); rc.wrong_app = True
        with self.assertRaisesRegex(c.SetupError, 'app identity'):
            c.run(g, rc)
        self.assertEqual(g.calls, [])

    def test_wrong_generated_identity_is_revoked_before_any_upload(self):
        g, rc = FakeGoogle(), FakeRevenueCat(); g.wrong_email = True
        with self.assertRaisesRegex(c.SetupError, 'credential identity'):
            c.run(g, rc)
        self.assertEqual(g.calls[-1][0], 'DELETE')
        self.assertEqual([m for m, _, _ in rc.calls], ['GET'])

    def test_api_guard_refuses_other_accounts_or_credential_types(self):
        google = c.Google('fixture_google_token')
        for method, url, body in [('POST', c.KEYS.replace('revenuecat-billing', 'another-account'), {}),
                                 ('POST', c.KEYS, {'privateKeyType': 'OTHER'}),
                                 ('DELETE', c.KEYS, None),
                                 ('GET', 'https://evil.example/keys', None)]:
            with self.assertRaises(c.SetupError):
                google.request(method, url, body)


class OneHourAuthorizationTests(unittest.TestCase):
    def test_grants_key_admin_only_on_billing_account_with_one_hour_condition(self):
        calls = []
        def fake(args, allow_failure=False):
            calls.append(args)
            if args[:2] == ['auth', 'list']:
                return a.OWNER
            if args[:2] == ['projects', 'describe']:
                return a.NUMBER
            if args[:3] == ['iam', 'service-accounts', 'describe']:
                return json.dumps({'email': a.ACCOUNT, 'projectId': a.PROJECT})
            return '{}'
        with patch.object(a, 'gcloud', fake), contextlib.redirect_stdout(io.StringIO()):
            result = a.run()
        binding = [v for v in calls if '--role=roles/iam.serviceAccountKeyAdmin' in v]
        self.assertEqual(len(binding), 1)
        self.assertEqual(binding[0][:4], ['iam', 'service-accounts', 'add-iam-policy-binding', a.ACCOUNT])
        self.assertIn('--member=serviceAccount:' + a.UPLOADER, binding[0])
        condition = next(v for v in binding[0] if v.startswith('--condition='))
        self.assertIn('request.time < timestamp("' + result['setup_permission_expires_at'] + '")', condition)
        expiry = a.datetime.strptime(result['setup_permission_expires_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=a.timezone.utc)
        remaining = (expiry - a.datetime.now(a.timezone.utc)).total_seconds()
        self.assertTrue(3500 < remaining <= 3600)
        self.assertFalse(result['owner_private_key_created'])
        self.assertFalse(result['revenuecat_secret_input_required'])
        self.assertFalse(any(v[:4] == ['iam', 'service-accounts', 'keys', 'create'] for v in calls))

    def test_wrong_owner_is_rejected_before_any_mutation(self):
        with patch.object(a, 'gcloud', return_value='another@example.invalid') as cli:
            with self.assertRaises(a.SetupError):
                a.run()
        self.assertEqual(cli.call_count, 1)


if __name__ == '__main__':
    unittest.main()
