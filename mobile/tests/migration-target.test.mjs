import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyReviewGrant} from '../src/reviewer-access.mjs';
import {buildConnectPackage} from '../scripts/xserver-connect.mjs';
test('new issuer grants pass and old issuer grants fail',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const target=JSON.parse(fs.readFileSync(new URL('../review-access.public.json',import.meta.url))).shihoshoshi;
 assert.equal(target.reviewAccessVerified,false);
 assert.equal(target.reviewAccess.endpoint,'https://xs366651.xsrv.jp/pass-review');
 assert.equal(target.reviewAccess.issuer,target.reviewAccess.endpoint);
 const config={...target.reviewAccess,publicKey:publicKey.export({format:'jwk'})};
 const now=Math.floor(Date.now()/1000),nonce='migration-check';
 const grant=issuer=>{
  const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const input=part({alg:'EdDSA',typ:'JWT',kid:config.keyId})+'.'+part({iss:issuer,aud:config.audience,role:'play_reviewer',scope:'study:all',nonce,sub:'reviewer',sid:'session',iat:now,exp:now+100});
  return input+'.'+sign(null,Buffer.from(input),privateKey).toString('base64url');
 };
 await verifyReviewGrant(grant(config.issuer),config,nonce);
 await assert.rejects(verifyReviewGrant(grant('https://xs968799.xsrv.jp/pass-review'),config,nonce));
});
test('setup artifacts are bound to the new host',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pass-migration-target-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const built=buildConnectPackage({outputDirectory:path.join(root,'public'),privateDirectory:path.join(root,'private')});
 assert.equal(new URL(built.state.endpoint).hostname,'xs366651.xsrv.jp');
 assert.equal(built.spec.issuer,'https://xs366651.xsrv.jp/pass-review');
 const php=fs.readFileSync(built.publicFile,'utf8');
 assert(!php.includes('xs968799'));
 assert(php.includes('xs366651.xsrv.jp'));
});
