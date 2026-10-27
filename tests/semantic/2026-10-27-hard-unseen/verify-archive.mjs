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
for(const [key,total] of Object.entries(summary.totals))assert.equal(verified.reduce((a,v)=>a+v[key],0),total,key);
assert.equal(summary.status,'findings-present');
assert.equal(summary.finding.id,'B-ES-AGE-SCOPE');
assert.equal(summary.finding.status,'open');
assert.equal((await read('ambiguity/not-run.json')).modelRequests,0);
assert.equal(summary.remainingClarificationTest.status,'not-run');
assert.equal(summary.shutdown.status,'succeeded');
assert.equal(summary.shutdown.studioEnabled,'false');
assert.equal(summary.shutdown.envRevision,23);
assert.ok(Math.abs(summary.uncachedTokenRateEstimateUsd-0.0912955)<1e-12);
console.log(JSON.stringify({status:'archive-verified-with-finding',verifiedFiles:names.size,
  frozenFiles:Object.keys(plan.files).length,sourceCommit:plan.sourceCommit,
  ...summary.totals,bilingualFinding:summary.finding.id,clarificationTest:'not-run',
  studioCallsPaused:true,networkCalls:0,filesWritten:0},null,2));
