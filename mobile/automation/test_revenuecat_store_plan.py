import unittest
import io
import json
import urllib.error
from unittest.mock import patch

from revenuecat_check import SetupError
from revenuecat_store_plan import PLANS, OWN_PLAN, PlanClient, desired_states, run, recheck


class StorePlanTests(unittest.TestCase):
    def test_recheck_refreshes_only_own_preview_and_reports_blockers(self):
        client = PlanClient('sk_' + 'x' * 32)
        existing = {'status': 'planned', 'actions': ['edit'], 'desired_states': desired_states()}
        result_plan = {'status': 'planned', 'plan_items': [{'warnings': [{'severity': 'blocker'}]}]}
        with patch('revenuecat_store_plan.read_store'), patch.object(client, '_request',
                side_effect=[existing, {'status': 'draft'}, {}, result_plan]) as request:
            result = recheck(client)
        self.assertEqual(result['blocker_count'], 1)
        self.assertFalse(result['store_changes_applied'])
        self.assertEqual([(c.args[0], c.args[1]) for c in request.call_args_list], [
            ('GET', PLANS + '/' + OWN_PLAN), ('PUT', PLANS + '/' + OWN_PLAN),
            ('POST', PLANS + '/' + OWN_PLAN + '/actions/plan'), ('GET', PLANS + '/' + OWN_PLAN)])

    def test_recheck_refuses_changed_price_before_any_write(self):
        client = PlanClient('sk_' + 'x' * 32)
        states = desired_states()
        states[0]['store_state']['base_plans']['monthly']['regional_configs']['JP']['price']['amount_micros'] = 1
        with patch('revenuecat_store_plan.read_store'), patch.object(client, '_request',
                return_value={'status': 'planned', 'actions': ['edit'], 'desired_states': states}) as request:
            with self.assertRaises(SetupError):
                recheck(client)
        self.assertEqual(request.call_count, 1)

    def test_schema_diagnostics_redact_tokens_and_hide_raw_body(self):
        client = PlanClient('sk_' + 'x' * 32)
        body = {'message': 'description missing; sk_' + 'z' * 32, 'other': 'PRIVATE DATA'}
        error = urllib.error.HTTPError('https://api.revenuecat.com', 400, 'Bad Request', {},
                                       io.BytesIO(json.dumps(body).encode()))
        with patch.object(client.opener, 'open', side_effect=error):
            with self.assertRaises(SetupError) as caught:
                client.post(PLANS, {'desired_states': desired_states()})
        self.assertIn('description missing', str(caught.exception))
        self.assertNotIn('sk_', str(caught.exception))
        self.assertNotIn('PRIVATE DATA', str(caught.exception))

    def test_draft_only_japan_prices(self):
        states = desired_states()
        self.assertEqual(len(states), 2)
        for state, period, amount in zip(states, ['P1M', 'P1Y'], [500, 5000]):
            plans = state['store_state']['base_plans']
            self.assertEqual(len(plans), 1)
            plan = next(iter(plans.values()))
            self.assertEqual(plan['state'], 'DRAFT')
            self.assertEqual(plan['auto_renewing_base_plan_type']['billing_period_duration'], period)
            self.assertEqual(plan['regional_configs'], {'JP': {'new_subscriber_availability': True,
                'price': {'amount_micros': amount * 1000000, 'currency': 'JPY'}}})
            self.assertNotIn('other_regions_config', plan)

    def test_apply_discard_and_modified_payload_rejected(self):
        client = PlanClient('sk_' + 'x' * 32)
        client.plan_id = 'plan_test'
        for path, body in [(PLANS + '/plan_test/actions/apply', {}),
                           (PLANS + '/plan_test/actions/discard', {}), (PLANS, {'desired_states': []})]:
            with self.subTest(path=path), patch.object(client, '_request') as request:
                with self.assertRaises(SetupError):
                    client.post(path, body)
                request.assert_not_called()

    def test_existing_base_plan_prevents_mutation(self):
        client = PlanClient('sk_' + 'x' * 32)
        with patch('revenuecat_store_plan.read_store', return_value={'products': [{
                'store_status': {'status': 'ok'}, 'store_state': {'base_plans': {'monthly': {'state': 'ACTIVE'}}}}]}), patch.object(client, '_request') as request:
            with self.assertRaises(SetupError):
                run(client)
            request.assert_not_called()

    def test_preview_plan_never_calls_apply(self):
        client = PlanClient('sk_' + 'x' * 32)
        calls = []
        def response(method, path, body=None):
            calls.append((method, path, body))
            if method == 'GET' and path == PLANS:
                return {'items': []}
            if method == 'POST' and path == PLANS:
                return {'id': 'plan_test', 'status': 'draft'}
            return {'id': 'plan_test', 'status': 'planned', 'warnings': []}
        with patch('revenuecat_store_plan.read_store', return_value={'products': [{
                'store_status': {'status': 'not_found'}, 'store_state': {'base_plans': {}}}]}), patch.object(client, '_request', side_effect=response):
            result = run(client)
        self.assertFalse(result['store_changes_applied'])
        self.assertEqual([path for method, path, _ in calls if method == 'POST'],
                         [PLANS, PLANS + '/plan_test/actions/plan'])
