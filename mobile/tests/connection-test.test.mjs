import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkServerClock,clockEndpoint} from '../src/connection-test.mjs';

test('native server clock succeeds without install attribution',async()=>{
  let calls=0;
  const plugin={trustedTime:async()=>{calls++;return {trustedNow:1795564800000,endpoint:clockEndpoint}},read:()=>{throw Error('Attribution must not be read')}};
  assert.deepEqual(await checkServerClock(plugin),{trustedNow:1795564800000,endpoint:clockEndpoint});
  assert.equal(calls,1);
});
test('missing, invalid and unexpected-host server clocks fail closed',async()=>{
  for(const result of [{}, {trustedNow:-1,endpoint:clockEndpoint},{trustedNow:1.5,endpoint:clockEndpoint},
    {trustedNow:1e16,endpoint:clockEndpoint},{trustedNow:1795564800000,endpoint:'https://other.test/'}]) {
    await assert.rejects(checkServerClock({trustedTime:async()=>result}));
  }
  await assert.rejects(checkServerClock({trustedTime:async()=>{throw Error('offline')}}));
});
