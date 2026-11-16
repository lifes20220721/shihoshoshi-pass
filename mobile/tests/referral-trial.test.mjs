import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referralTrial, ReferralAccess} from '../src/referral-trial.mjs';

test('referrals are limited to the other app and one calendar month', () => {
  const installedAt = Date.parse('2026-01-31T10:30:00Z');
  const referrer = 'utm_source=gyoseishoshi_pass&utm_medium=app';
  const result = referralTrial({app:'shihoshoshi',referrer,installedAt,now:installedAt});
  assert.equal(new Date(result.expiresAt).toISOString(), '2026-02-28T10:30:00.000Z');
  assert.equal(referralTrial({app:'shihoshoshi',referrer,installedAt,now:result.expiresAt}).active, false);
  assert.equal(referralTrial({app:'gyoseishoshi',referrer,installedAt,now:installedAt}), null);
  assert.equal(referralTrial({app:'shihoshoshi',referrer:referrer+'&utm_source=other',installedAt,now:installedAt}), null);
  assert.equal(referralTrial({app:'shihoshoshi',referrer,installedAt,now:installedAt-1}), null);
});

test('the reciprocal source is recognized for the administrative app', () => {
  const now = Date.parse('2026-11-16T00:00:00Z');
  const result = referralTrial({app:'gyoseishoshi',referrer:'utm_source=shihoshoshi_pass&utm_medium=app',installedAt:now,now});
  assert.equal(new Date(result.expiresAt).toISOString(), '2026-12-16T00:00:00.000Z');
  assert.equal(result.active, true);
});

test('access is enabled only after a valid Play response and expires without another purchase', async () => {
  let now = Date.parse('2026-11-16T00:00:00Z');
  const installedAt = now;
  let changes = 0;
  const plugin = {async read() {return {referrer:'utm_source=gyoseishoshi_pass&utm_medium=app',installedAt,trustedNow:installedAt}}};
  const access = new ReferralAccess({app:'shihoshoshi',plugin,now:()=>now,onChange:()=>changes++});
  assert.equal(access.active,false);
  await access.refresh();
  assert.equal(access.active,true);
  assert.equal(changes,1);
  now = Date.parse('2026-12-16T00:00:00Z');
  assert.equal(access.active,false);
  now -= 1000;
  assert.equal(access.active,false, 'a clock rollback within the process must not restore access');
});

test('unavailable Play attribution never grants access', async () => {
  const access = new ReferralAccess({app:'shihoshoshi',plugin:{async read(){throw Error('unavailable')}}});
  await access.refresh();
  assert.equal(access.active,false);
});

test('a fresh process uses server time rather than the device wall clock', async () => {
  const installedAt=Date.parse('2026-11-16T00:00:00Z');
  const access=new ReferralAccess({app:'shihoshoshi',now:()=>0,plugin:{async read(){return {
    referrer:'utm_source=gyoseishoshi_pass&utm_medium=app',installedAt,
    trustedNow:Date.parse('2026-12-16T00:00:01Z')
  }}}});
  await access.refresh();
  assert.equal(access.active,false);
});

test('install data without trusted server time is rejected', async () => {
  const access=new ReferralAccess({app:'shihoshoshi',plugin:{async read(){return {
    referrer:'utm_source=gyoseishoshi_pass&utm_medium=app',installedAt:Date.now()
  }}}});
  await access.refresh();
  assert.equal(access.active,false);
});
