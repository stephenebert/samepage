import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
// Frozen evidence in this directory is read-only. New runs must live elsewhere.
const mode=process.argv[2];
assert.ok(mode==='prepare'||mode==='apply','Use prepare or apply');
assert.ok(process.env.SAMEPAGE_EVAL_RUN_DIR && path.isAbsolute(process.env.SAMEPAGE_EVAL_RUN_DIR),
  'Set SAMEPAGE_EVAL_RUN_DIR to an absolute, new run directory outside this evidence archive');
const requestedRun=path.resolve(process.env.SAMEPAGE_EVAL_RUN_DIR);
const archive=await fs.realpath(root);
const run=mode==='prepare'
  ? path.join(await fs.realpath(path.dirname(requestedRun)),path.basename(requestedRun))
  : await fs.realpath(requestedRun);
const within=(child,parent)=>{const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
assert.ok(!within(run,archive)&&!within(archive,run),'Run directory must be separate from the frozen evidence archive');
if(mode==='prepare')await fs.mkdir(run); // Refuse an existing directory, including a prior run.
else {
  const names=await fs.readdir(run);
  assert.ok(!names.includes('results.json')&&!names.some(name=>name.endsWith('.after.json')),
    'This run was already applied or partly applied; prepare a new run instead of overwriting it');
}
const base=process.env.SAMEPAGE_TEST_URL||'http://127.0.0.1:5173';
const source=await fs.readFile(path.join(root,'cases.json'),'utf8');
const expectations=await fs.readFile(path.join(root,'EXPECTATIONS.md'),'utf8');
const cases=JSON.parse(source).cases;
const save=(name,data)=>fs.writeFile(path.join(run,name),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function api(url,data) {
  const response=await fetch(base+url,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json',Origin:base}:undefined,body:data?JSON.stringify(data):undefined});
  const result=await response.json();assert.ok(response.ok,`${response.status}: ${JSON.stringify(result)}`);return result.room;
}
const post=(id,action)=>api('/api/consequences/'+id,action);
// Independent oracle: do not import the production evaluator to verify discoveries.
function oracle(r,a) {
  if(!r)return null;
  const eligible=r.minAge===null ? (!r.residentRequired||a.resident) : !r.residentRequired ? a.age>=r.minAge : r.join==='all' ? a.age>=r.minAge&&a.resident : a.age>=r.minAge||a.resident;
  const onTime=r.deadline===null || (r.deadlineInclusive ? Date.parse(a.submittedAt)<=Date.parse(r.deadline):Date.parse(a.submittedAt)<Date.parse(r.deadline));
  return eligible&&onTime;
}
function ruleSemanticsMatch(actual,expected) {
  if(actual===null||expected===null)return actual===expected;
  const times=new Set([Date.parse('0000-01-01T00:00:00Z'),Date.parse('9999-12-31T23:59:59.999Z')]);
  for(const r of [actual,expected])if(r.deadline)for(const offset of [-1,0,1]){const t=Date.parse(r.deadline)+offset;if(t>=Date.parse('0000-01-01T00:00:00Z')&&t<=Date.parse('9999-12-31T23:59:59.999Z'))times.add(t);}
  for(let age=0;age<=120;age++)for(const resident of [false,true])for(const t of times){const a={age,resident,submittedAt:new Date(t).toISOString()};if(oracle(actual,a)!==oracle(expected,a))return false;}
  return true;
}
if(process.argv[2]==='prepare') {
  const manifest={casesSHA256:hash(source),expectationsSHA256:hash(expectations),preparedAt:new Date().toISOString(),cases:[]};
  for(const c of cases) {
    let room=await api('/api/consequences',{});
    await Promise.all(['alice','bob'].map(editor=>post(room.id,{type:'draft',editor,baseVersion:1,text:c.drafts[editor]})));
    room=await post(room.id,{type:'requestReview'});
    for(const editor of ['alice','bob'])assert.equal(room.drafts[editor].text,c.drafts[editor]);
    await save(`${c.id}.before.json`,room);await save(`${c.id}.prompt.txt`,room.activeJob.prompt);
    manifest.cases.push({id:c.id,roomId:room.id,jobId:room.activeJob.id,promptSHA256:hash(room.activeJob.prompt)});
  }
  await save('manifest.json',manifest);console.log({prepared:manifest.cases.length,casesSHA256:manifest.casesSHA256});
} else if(process.argv[2]==='apply') {
  const {discoverCounterexamples}=await import('../../../lib/counterexamples.ts');
  const manifest=JSON.parse(await fs.readFile(path.join(run,'manifest.json'),'utf8'));
  assert.equal(hash(source),manifest.casesSHA256,'Frozen cases changed');
  assert.equal(hash(expectations),manifest.expectationsSHA256,'Frozen expectations changed');
  const results=[];
  for(const m of manifest.cases) {
    const c=cases.find(c=>c.id===m.id);
    assert.equal(hash(await fs.readFile(path.join(run,`${c.id}.prompt.txt`),'utf8')),m.promptSHA256,'Prepared prompt changed');
    const raw=await fs.readFile(path.join(run,`${c.id}.response.json`),'utf8');
    let room=await post(m.roomId,{type:'completeReview',response:raw});
    assert.equal(room.published.version,1);
    const candidates=Object.fromEntries(room.review.candidates.map(c=>[c.editor,c]));
    const checks=[];
    for(const editor of ['alice','bob']) {
      assert.equal(candidates[editor][editor==='alice'?'en':'es'],c.drafts[editor]);
      assert.ok(ruleSemanticsMatch(candidates[editor].rules,c.expected[editor].rules),`${c.id}/${editor} extraction mismatch`);
      for(const s of c.scenarios){const result=oracle(candidates[editor].rules,s);assert.equal(result,s.expected[editor],`${c.id}/${editor} oracle`);checks.push({editor,attendee:{age:s.age,resident:s.resident,submittedAt:s.submittedAt},actual:result});}
    }
    const start=performance.now();const discovery=discoverCounterexamples(candidates.alice.rules,candidates.bob.rules);const discoveryMs=performance.now()-start;
    assert.equal(discovery.status,c.expected.comparison,`${c.id} comparison`);
    const directions=discovery.witnesses.map(w=>w.direction==='left-only'?'alice-only':'bob-only').sort();
    assert.deepEqual(directions,[...c.expected.directions].sort(),`${c.id} reachable acceptance directions`);
    for(const w of discovery.witnesses){assert.notEqual(oracle(candidates.alice.rules,w.attendee),oracle(candidates.bob.rules,w.attendee));assert.equal(w.left.accepted,oracle(candidates.alice.rules,w.attendee));assert.equal(w.right.accepted,oracle(candidates.bob.rules,w.attendee));}
    const registrations=[];
    // Select alternating editors, then verify every discovered witness through the actual form endpoint.
    const owner=results.length%2?'bob':'alice';const selected=candidates[owner].rules?candidates[owner]:Object.values(candidates).find(c=>c.rules);
    if(selected&&discovery.witnesses.length){for(const editor of ['alice','bob']){room=await post(room.id,{type:'vote',editor,reviewId:room.review.id,candidateId:selected.id});if(editor==='alice')assert.equal(room.published.version,1);}for(const [i,w]of discovery.witnesses.entries()){room=await post(room.id,{type:'register',requestId:`witness-${c.id}-${i}`,policyVersion:2,label:`Discovered attendee ${i+1}`,...w.attendee});const record=room.registrations.at(-1);assert.equal(record.decision.accepted,oracle(selected.rules,w.attendee));registrations.push(record);}}
    await save(`${c.id}.after.json`,room);
    results.push({id:c.id,responseSHA256:hash(raw),sourcePreserved:true,interpretationsMatchExpected:true,scenarioChecks:checks,discovery,discoveryMs,registrations});
  }
  await save('results.json',results);
  console.log({passed:results.length,interpretations:results.length*2,scenarioOutcomes:results.reduce((n,r)=>n+r.scenarioChecks.length,0),discoveredWitnesses:results.reduce((n,r)=>n+r.discovery.witnesses.length,0),savedRegistrations:results.reduce((n,r)=>n+r.registrations.length,0)});
} else throw new Error('Use prepare or apply');
