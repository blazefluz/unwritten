// Integration checks use a disposable LOCAL Postgres database, never Meta or Render.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const name='unwritten_access_test_'+randomUUID().replaceAll('-','');
execFileSync('createdb',[name]);
process.env.DATABASE_URL=`postgresql://${process.env.USER}@localhost/${name}?host=%2Ftmp`;
process.env.JUDGE_LIVE_ENABLED='true';process.env.MODEL_API_KEY='offline-test-only';
process.env.JUDGE_ACCESS_CODE='offline-test-code-at-least-24-characters';
process.env.RENDER_EXTERNAL_URL='https://example.test';
const access=await import('../web/lib/judge-access.ts');
const {boundedBytes}=await import('../web/lib/bounded-form.ts');
const request=(cookie='',origin='https://example.test')=>new Request('https://example.test/api/analyze',{headers:{origin,cookie,'x-forwarded-for':'127.0.0.1'}});
try {
  await assert.rejects(boundedBytes(new Request('http://localhost',{method:'POST',body:'x'.repeat(2001)}),2000),RangeError);
  assert.equal((await boundedBytes(new Request('http://localhost',{method:'POST',body:'valid'}),2000)).length,5);
  assert.equal(await access.remainingRuns(),6);
  await assert.rejects(access.verifyCode(request(),'wrong'),e=>e.status===401);
  assert.equal(await access.remainingRuns(),6,'wrong codes cannot spend the run allowance');
  assert.equal(await access.verifyCode(request(),process.env.JUDGE_ACCESS_CODE),6);
  const cookie=access.sessionCookie(request()).split(';')[0];
  assert(access.hasJudgeSession(request(cookie)));
  assert(!access.hasJudgeSession(request(cookie+'tampered')));
  const expired=`unwritten_reviewer=${access.sessionToken(Date.now()-3*3600000)}`;
  assert(!access.hasJudgeSession(request(expired)));
  await assert.rejects(access.reserveJudgeRun(request(cookie,'https://evil.test'),randomUUID()),e=>e.status===403);
  const repeated=randomUUID();await access.reserveJudgeRun(request(cookie),repeated);
  await assert.rejects(access.reserveJudgeRun(request(cookie),repeated),e=>e.status===409);
  assert.equal(await access.remainingRuns(),5,'duplicate requests cannot spend twice or re-run');
  const results=await Promise.allSettled(Array.from({length:12},()=>access.reserveJudgeRun(request(cookie),randomUUID())));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,5,'only five of twelve concurrent requests may use the five remaining slots');
  assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===410));
  assert.equal(await access.remainingRuns(),0);
  await access.closeJudgeDatabase();
  assert.equal(await access.remainingRuns(),0,'reconnecting cannot reset allowance');
  await assert.rejects(access.verifyCode(request(),process.env.JUDGE_ACCESS_CODE),e=>e.status===410);
  process.env.JUDGE_LIVE_ENABLED='false';assert(!access.hasJudgeSession(request(cookie)));
  console.log('PASS: invalid/tampered/expired/cross-origin access, duplicates, 12 concurrent reservations, six-run exhaustion, reconnect persistence, and disabled-mode checks. No AI calls.');
} finally {await access.closeJudgeDatabase();execFileSync('dropdb',[name]);}
