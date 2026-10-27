// Read-only integrity and frozen semantic replay. No provider requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
globalThis.fetch = () => { throw Error('Archive verifier forbids network'); };
const root = path.dirname(fileURLToPath(import.meta.url));
const read = async p => JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await read('evidence-manifest.json');
const names = new Set();
async function list(dir='') {
  const result=[];
  for (const f of await fs.readdir(path.join(root,dir),{withFileTypes:true})) {
    assert.equal(f.isSymbolicLink(),false);
    const rel=path.posix.join(dir,f.name);
    if(f.isDirectory()) result.push(...await list(rel)); else {assert.ok(f.isFile());result.push(rel);}
  }
  return result;
}
for(const entry of manifest.files){
  assert.ok(!entry.path.startsWith('/')&&!entry.path.split('/').includes('..'));
  assert.ok(!names.has(entry.path));names.add(entry.path);
  const bytes=await fs.readFile(path.join(root,entry.path));
  assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(hash(bytes),entry.sha256,entry.path);
}
assert.deepEqual((await list()).filter(p=>!manifest.excludedFiles.includes(p)).sort(),[...names].sort());
const plan=await read('suite-plan.json'),summary=await read('suite-summary.json');
assert.equal(hash(await fs.readFile(path.join(root,'suite-plan.json'))),(await read('suite-plan.freeze.json')).sha256);
for(const [name,expected] of Object.entries(plan.files))assert.equal(hash(await fs.readFile(path.join(root,name))),expected,name);
const verified=[];
for(const c of ['a','b']){
  const result=spawnSync(process.execPath,[path.join(root,`case-${c}/verify-evidence.mjs`)],{encoding:'utf8',maxBuffer:2_000_000});
  assert.equal(result.status,0,result.stderr);
  const value=JSON.parse(result.stdout);
  assert.deepEqual(value,await read(`case-${c}/evidence-verification-result.json`));verified.push(value);
}
const ar=spawnSync(process.execPath,[path.join(root,'verify-ambiguity.mjs')],{encoding:'utf8',maxBuffer:2_000_000});assert.equal(ar.status,0,ar.stderr);const ambiguity=JSON.parse(ar.stdout);assert.deepEqual(ambiguity,await read('ambiguity/evidence-verification-result.json'));assert.equal(ambiguity.runStatus,'passed');
for(const [key,total] of Object.entries(summary.totals)){let n=verified.reduce((a,v)=>a+(v[key]??0),0);if(['modelRequests','promptTokens','completionTokens'].includes(key))n+=ambiguity[key];if(key==='naturalStops')n++;if(key==='unresolvedCandidates')n=ambiguity.unresolvedCandidates;if(key==='clarificationVotesBlocked')n=ambiguity.blockedVotes;assert.equal(n,total,key);}
assert.equal(summary.status,'passed-with-bounded-scope');
for(const c of ['a','b'])assert.ok((await read(`audit/live-${c}.json`)).status.startsWith('pass'));
assert.equal(summary.clarificationTest.status,'passed');
assert.equal(summary.shutdown.status,'succeeded');assert.equal(summary.shutdown.studioEnabled,false);assert.equal(summary.shutdown.envRevision,25);
assert.ok(Math.abs(summary.uncachedTokenRateEstimateUsd-0.10448875)<1e-12);
console.log(JSON.stringify({status:'grouping-archive-verified',verifiedFiles:names.size,
  frozenFiles:Object.keys(plan.files).length,sourceCommit:plan.sourceCommit,
  ...summary.totals,bilingualAudit:'pass',clarificationTest:'passed',
  studioCallsPaused:true,networkCalls:0,filesWritten:0},null,2));
