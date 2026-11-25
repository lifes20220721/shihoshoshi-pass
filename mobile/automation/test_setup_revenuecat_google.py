import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import setup_revenuecat_google as s


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.cli, self.http = [], []
        self.owner = s.OWNER
        self.user_keys = []
        self.fail_upload = False
        self.created_path = None
        self.app = {'id': 'app1d9873660b', 'project_id': 'proj9ba19f6b', 'type': 'play_store', 'play_store': {'package_name': s.PACKAGE}}

    def gcloud(self, args, allow_failure=False):
        self.cli.append(args)
        if args[:2] == ['auth', 'list']:
            return self.owner
        if args[:2] == ['projects', 'describe']:
            return s.PROJECT_NUMBER
        if args[:3] == ['iam', 'service-accounts', 'describe']:
            return json.dumps({'email': s.ACCOUNT, 'projectId': s.PROJECT})
        if args[:4] == ['iam', 'service-accounts', 'keys', 'list']:
            return json.dumps(self.user_keys)
        if args[:4] == ['iam', 'service-accounts', 'keys', 'create']:
            self.created_path = Path(args[4])
            self.created_path.write_text(json.dumps({'client_email': s.ACCOUNT,
                'project_id': s.PROJECT, 'type': 'service_account',
                'private_key_id': 'fixture_key_id', 'private_key': 'fixture_private_key_do_not_print'}))
        return '{}'

    def revenuecat(self, token, method, body=None):
        self.http.append((method, body))
        if method == 'POST' and self.fail_upload:
            raise s.SetupError('Simulated upload failure')
        return self.app.copy()

    def configure(self, path):
        with patch.object(s, 'gcloud', self.gcloud), patch.object(s, 'revenuecat', self.revenuecat):
            return s.configure('sk_fixture_secret_token_only_for_unit_test', path)

    def test_success_sends_only_to_fixed_app_and_removes_private_file(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()) as output:
            state = Path(directory) / 'status.json'
            result = self.configure(state)
            self.assertTrue(result['credentials_uploaded'])
            self.assertFalse(result['play_app_permissions_verified'])
            self.assertFalse(result['released'])
            self.assertFalse(self.created_path.exists())
            self.assertNotIn('fixture_private_key', state.read_text())
            self.assertNotIn('fixture_secret', output.getvalue())
            self.assertFalse(any(a[:4] == ['iam', 'service-accounts', 'keys', 'delete'] for a in self.cli))
            roles = [a for a in self.cli if a[:2] == ['projects', 'add-iam-policy-binding']]
            self.assertEqual({next(v for v in a if v.startswith('--role=')) for a in roles}, {'--role=roles/pubsub.editor', '--role=roles/monitoring.viewer'})
            self.assertTrue(all('--member=serviceAccount:' + s.ACCOUNT in a for a in roles))
            self.assertEqual(set(self.http[-2][1]), {'play_store'})

    def test_upload_failure_revokes_only_new_key_and_removes_file(self):
        self.fail_upload = True
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(s.SetupError, 'upload failure'):
                self.configure(Path(directory) / 'status.json')
            self.assertFalse(self.created_path.exists())
            deleted = [a for a in self.cli if a[:4] == ['iam', 'service-accounts', 'keys', 'delete']]
            self.assertEqual(len(deleted), 1)
            self.assertEqual(deleted[0][4], 'fixture_key_id')

    def test_wrong_owner_or_app_stops_before_cloud_mutations(self):
        for wrong_owner in (True, False):
            self.cli, self.http = [], []
            if wrong_owner:
                self.owner = 'someone_else@example.invalid'
            else:
                self.owner = s.OWNER; self.app['play_store']['package_name'] = 'another.app'
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(s.SetupError):
                    self.configure(Path(directory) / 'status.json')
            self.assertTrue(all(a[:2] in (['auth', 'list'], ['projects', 'describe']) for a in self.cli))

    def test_existing_key_is_preserved_instead_of_rotated(self):
        self.user_keys = [{'name': 'existing/key', 'keyType': 'USER_MANAGED'}]
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(s.SetupError, 'already has a user key'):
                self.configure(Path(directory) / 'status.json')
        self.assertFalse(any(a[:4] in (['iam', 'service-accounts', 'keys', 'create'], ['iam', 'service-accounts', 'keys', 'delete']) for a in self.cli))

    def test_repeat_uses_public_status_record_and_active_key(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / 'status.json'
            state.write_text(json.dumps({'credentials_uploaded': True, 'service_account': s.ACCOUNT, 'private_key_id': 'existing'}))
            self.user_keys = [{'name': 'projects/p/serviceAccounts/a/keys/existing', 'keyType': 'USER_MANAGED'}]
            result = self.configure(state)
            self.assertTrue(result['already_configured'])
            self.assertEqual(len(self.http), 1)
            self.assertFalse(any(a[:2] == ['services', 'enable'] for a in self.cli))

    def test_public_or_malformed_key_rejected_before_any_api(self):
        with patch.object(s, 'gcloud', self.gcloud), patch.object(s, 'revenuecat', self.revenuecat):
            for key in ('test_public_key_123456789', 'sk_short', 'sk_fixture_key with space'):
                with self.assertRaises(s.SetupError):
                    s.configure(key, Path('/tmp/not-used-pass-status'))
        self.assertEqual(self.cli + self.http, [])

    def test_hidden_prompt_requires_interactive_terminal(self):
        with patch.object(s.os, 'isatty', return_value=False), patch.object(s.getpass, 'getpass') as prompt:
            with self.assertRaisesRegex(s.SetupError, 'interactive'):
                s.main()
            prompt.assert_not_called()

    def test_empty_or_public_key_input_keeps_waiting_without_cloud_changes(self):
        expected = 'sk_fixture_secret_token_only_for_unit_test'
        with patch.object(s.os, 'isatty', return_value=True), patch.object(s.getpass, 'getpass', side_effect=['', 'test_public_key', expected]) as prompt, patch.object(s, 'configure', return_value={'credentials_uploaded': True}) as configure, contextlib.redirect_stdout(io.StringIO()) as output:
            s.main()
        self.assertEqual(prompt.call_count, 3)
        configure.assert_called_once()
        self.assertEqual(configure.call_args.args[0], expected)
        self.assertNotIn(expected, output.getvalue())

    def test_failed_cli_does_not_print_private_command_response(self):
        class Failure:
            returncode = 1
            stdout = 'fixture_private_key'
            stderr = 'fixture_private_error'
        with patch.object(s.subprocess, 'run', return_value=Failure()):
            with self.assertRaises(s.SetupError) as result:
                s.gcloud(['iam', 'service-accounts', 'keys', 'create'])
        self.assertNotIn('fixture_private', str(result.exception))


if __name__ == '__main__':
    unittest.main()
