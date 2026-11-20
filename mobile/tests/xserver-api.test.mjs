import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkXServerApi} from '../scripts/xserver-api-check.mjs';
const key='xs_'+'test_'.repeat(8);

test('XServer API probe uses fixed read-only destinations and strips sensitive metadata',async()=>{
  const calls=[];
  const result=await checkXServerApi({key,request:async(url,credential)=>{
    calls.push(url);assert.equal(credential,key);assert(!url.includes(key));
    if(url.endsWith('/me'))return {status:200,body:{token:key,permissions:['write']}};
    if(url.endsWith('/server-info'))return {status:200,body:{server_id:'xs366651',domain_validation_token:'private'}};
    return {status:200,body:{crons:[{id:'existing',command:'private command'}]}};
  }});
  assert.deepEqual(calls,['https://api.xserver.ne.jp/v1/me','https://api.xserver.ne.jp/v1/server/xs366651/server-info','https://api.xserver.ne.jp/v1/server/xs366651/cron']);
  assert.deepEqual(result,{authenticated:true,serverId:'xs366651',readOnlyCheck:true,existingCronJobs:1});
  assert(!JSON.stringify(result).includes(key));assert(!JSON.stringify(result).includes('private'));
});

test('XServer API probe rejects missing or header-injection credentials before connecting',async()=>{
  for(const value of [undefined,'',key+'\nHost: evil.example',key+'"','wrong-prefix']) {
    await assert.rejects(()=>checkXServerApi({key:value,request:async()=>{assert.fail('must not connect')}}));
  }
});

test('XServer API errors never return raw response or credential-bearing transport errors',async()=>{
  for(const request of [async()=>({status:401,body:{error:key}}),async()=>{throw Error(key)}]) {
    await assert.rejects(()=>checkXServerApi({key,request}),error=>!error.message.includes(key));
  }
});

test('XServer API probe stops on a mismatched server and refuses malformed job lists',async()=>{
  for(const wrongServer of [true,false]) {
    let count=0;
    await assert.rejects(()=>checkXServerApi({key,request:async()=>{
      count++;
      return {status:200,body:count===1?{}:count===2?{server_id:wrongServer?'other':'xs366651'}:{crons:null}};
    }}));
    assert.equal(count,wrongServer?2:3);
  }
});
