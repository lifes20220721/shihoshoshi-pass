"""Prepare a reviewable Japan-only DRAFT price plan. Applying is not implemented."""
import json
import os
import re
from pathlib import Path
import time
import urllib.error
import urllib.request

from revenuecat_check import SetupError, identifier
from revenuecat_store_check import StoreClient, PREFIX, PRODUCTS, run as read_store

PLANS = PREFIX + '/store_state/plans'
OWN_PLAN = 'c1921d0b-e870-4467-ab16-c9ea228582e7'


def desired_states():
    result = []
    for product, store_id in PRODUCTS.items():
        plan_id = store_id.split(':')[1]
        duration, amount = ('P1M', 500) if plan_id == 'monthly' else ('P1Y', 5000)
        base_plan = {'state': 'DRAFT',
            'auto_renewing_base_plan_type': {'billing_period_duration': duration},
            'regional_configs': {'JP': {'new_subscriber_availability': True,
                'price': {'amount_micros': amount * 1000000, 'currency': 'JPY'}}}}
        result.append({'product_id': product, 'store': 'play_store',
            'common': {'localizations': {'ja-JP': {'name': '司法書士PASS 全機能プラン', 'description': None}}},
            'store_state': {'base_plans': {plan_id: base_plan}}})
    return result


class PlanClient(StoreClient):
    plan_id = None

    def _request(self, method, path, body=None):
        # The fixed plan payload contains only catalog metadata. Capture schema
        # validation diagnostics here; never include authorization or a raw body.
        if method != 'POST' or path != PLANS:
            return super()._request(method, path, body)
        request = urllib.request.Request('https://api.revenuecat.com' + path,
            headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/json',
                     'Content-Type': 'application/json'},
            data=json.dumps(body).encode(), method='POST')
        try:
            with self.opener.open(request, timeout=45) as response:
                data = response.read(1000001)
                if len(data) > 1000000:
                    raise SetupError('Plan response exceeded its size limit')
                return json.loads(data)
        except urllib.error.HTTPError as error:
            detail = ''
            if error.code == 400:
                try:
                    value = json.loads(error.read(8000))
                    detail = str(value.get('message', ''))[:2000]
                    detail = re.sub(r'(?:sk_|goog_|appl_|test_)[A-Za-z0-9_-]+', '[redacted]', detail)
                    if 'PRIVATE KEY' in detail:
                        detail = '[redacted]'
                except (ValueError, AttributeError):
                    pass
            raise SetupError(f'RevenueCat plan creation returned HTTP {error.code}: {detail}') from None
        except (urllib.error.URLError, TimeoutError):
            raise SetupError('RevenueCat plan connection failed') from None

    def get(self, path):
        if path == PLANS or self.plan_id and path == PLANS + '/' + self.plan_id:
            return self._request('GET', path)
        return super().get(path)

    def post(self, path, body):
        if path == PLANS and body == {'desired_states': desired_states()}:
            return self._request('POST', path, body)
        if self.plan_id and path == PLANS + '/' + self.plan_id + '/actions/plan' and body == {}:
            return self._request('POST', path, body)
        raise SetupError('Only exact approved DRAFT plan preparation is permitted; apply is disabled')

    def replace_own_draft(self):
        if self.plan_id != OWN_PLAN:
            raise SetupError('Only this session\'s failed draft plan may be corrected')
        return self._request('PUT', PLANS + '/' + OWN_PLAN, {'desired_states': desired_states()})


def run(client, wait=time.sleep):
    live = read_store(client)
    for product in live['products']:
        if product['store_status'].get('status') == 'could_not_check':
            raise SetupError('Live store read failed; stopped before preparing a plan')
        if product.get('store_state', {}).get('base_plans'):
            raise SetupError('Existing base plans found; stopped before any plan creation')
    listing = client.get(PLANS)
    if listing.get('next_page'):
        raise SetupError('Additional store plans exist; inspect before creating another')
    terminal = {'applied', 'planned_and_finished', 'cancelled', 'expired', 'discarded'}
    active = [p for p in listing.get('items', []) if p.get('status') not in terminal]
    if active:
        if len(active) != 1 or active[0].get('id') != OWN_PLAN or active[0].get('status') != 'plan_errored':
            raise SetupError('An existing store plan must be reviewed before preparing another')
        client.plan_id = OWN_PLAN
        existing = client.get(PLANS + '/' + OWN_PLAN)
        if {s.get('product_id') for s in existing.get('desired_states', [])} != set(PRODUCTS):
            raise SetupError('Existing draft plan products differ; no changes made')
        created = client.replace_own_draft()
    else:
        created = client.post(PLANS, {'desired_states': desired_states()})
    client.plan_id = identifier(created['id'])
    if created.get('status') != 'draft':
        raise SetupError('Unexpected new plan state; stopped without applying')
    client.post(PLANS + '/' + client.plan_id + '/actions/plan', {})
    for _ in range(30):
        plan = client.get(PLANS + '/' + client.plan_id)
        if plan.get('status') in ('planned', 'planned_and_finished', 'plan_errored'):
            return {'mode': 'revenuecat-store-plan', 'plan': plan,
                    'review_url': 'https://app.revenuecat.com/projects/proj9ba19f6b/product-catalog/product-editor/review-changes?plan_id=' + client.plan_id,
                    'store_changes_applied': False, 'released': False}
        wait(2)
    raise SetupError('Plan still computing; inspect the existing plan before retrying')


if __name__ == '__main__':
    try:
        request = json.loads(Path('mobile/automation/revenuecat-check-request.json').read_text())
        if request.get('prepare_store_plan') is True:
            print(json.dumps(run(PlanClient(os.environ.get('REVENUECAT_AUTOMATION_KEY'))), ensure_ascii=False))
        else:
            print(json.dumps({'mode': 'revenuecat-store-plan', 'skipped': True, 'store_changes_applied': False}))
    except (SetupError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(str(error)) from None
