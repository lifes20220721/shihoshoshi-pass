import unittest
from unittest.mock import patch
import io
import urllib.error
import revenuecat_check as r


class RevenueCatConnectionTests(unittest.TestCase):
    def client(self):
        return r.Client('sk_' + 'fixture_not_a_real_secret_key')

    def test_public_sdk_keys_are_rejected(self):
        for token in (None, '', 'goog_' + 'x'*30, 'test_' + 'x'*30):
            with self.assertRaises(r.SetupError):
                r.Client(token)

    def test_only_expected_configuration_reads_are_allowed(self):
        c = self.client(); c.project = 'proj123'
        for path in ('https://evil.example/v2/projects', '//evil.example/v2/projects',
                     '/v2/projects/proj999/products', '/v2/projects/proj123/customers',
                     '/v2/projects/proj123/subscriptions', '/v2/projects/proj123/apps/app123/api_keys'):
            with self.assertRaises(r.SetupError):
                c.get(path)

    def test_redirect_never_forwards_secret(self):
        with self.assertRaises(r.SetupError):
            r.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://evil.example')

    def test_http_errors_hide_body_and_credentials(self):
        c = self.client()
        c.opener.open = lambda *a, **kw: (_ for _ in ()).throw(urllib.error.HTTPError(
            'https://api.revenuecat.com/v2/projects', 403, 'private secret message', {}, io.BytesIO(b'private response')))
        with self.assertRaises(r.SetupError) as result:
            c.get('/v2/projects')
        self.assertNotIn(c.token, str(result.exception))
        self.assertNotIn('private', str(result.exception))
        self.assertIn('403', str(result.exception))

    def test_pagination_rejects_external_origin(self):
        c = self.client()
        c.get = lambda path: {'items': [], 'next_page': 'https://evil.example/v2/projects'}
        with self.assertRaisesRegex(r.SetupError, 'pagination path'):
            c.items('/v2/projects')

    def test_other_projects_are_not_selected_or_modified(self):
        c = self.client()
        c.items = lambda path: [{'id': 'projOther', 'name': 'Another app'}]
        with self.assertRaises(r.SetupError):
            r.run(c)
        self.assertIsNone(c.project)

    def test_metadata_output_omits_keys_and_customer_data(self):
        c = self.client()
        def items(path):
            if path == '/v2/projects':
                return [{'id': 'proj123', 'name': r.PROJECT_NAME}]
            if path.endswith('/apps'):
                return [{'id': 'app123', 'name': 'Test Store', 'type': 'rc_billing',
                         'api_key': 'private_key_fixture', 'credentials': 'private_credentials_fixture'}]
            return []
        c.items = items
        result = r.run(c)
        self.assertFalse(result['changes_saved'])
        self.assertEqual(result['apps'], [{'id': 'app123', 'name': 'Test Store', 'type': 'rc_billing'}])
        self.assertNotIn('private', str(result))

    def test_missing_key_reports_incomplete_connection_without_network(self):
        with patch.dict(r.os.environ, {}, clear=True), patch('builtins.print') as output:
            r.main()
        self.assertIn('"connection_configured": false', output.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
