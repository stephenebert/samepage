import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {discoverCounterexamples} from './samepage-private-repo/lib/counterexamples.ts';

// No provider code or automatic-review endpoint is reachable from this runner.
const base='https://samepage-language-lab.ampleboar17.chatgpt.site';
const corpus='/Users/steph/Documents/Playground/output/meta-hackathon/samepage-hard-unseen-2026-10-20';
const run='/Users/steph/Documents/Playground/output/meta-hackathon/samepage-hard-run-2026-10-20';
const phase=process.argv[2];
assert.ok(['prepare','apply','snapshot'].includes(phase));
const hash=s=>createHash('sha256').update(s).digest('hex');
let secret='';
// PTY input is hidden before the ready signal; credentials never enter argv/files/logs.
async function authorization() {
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  process.stdin.resume();
  console.log('Ready for private Site authorization JSON on stdin (input is hidden).');
  const body=await new Promise((resolve,reject)=>{
    let text='';
    const onData=chunk=>{text+=chunk.toString();if(text.length>16384){cleanup();reject(new Error('Input too large'));}else if(text.includes('\n')){cleanup();resolve(text.slice(0,text.indexOf('\n')));}};
    const cleanup=()=>{process.stdin.off('data',onData);process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);};
    process.stdin.on('data',onData);
  });
  let value;try{value=JSON.parse(body);}catch{throw new Error('Authorization input must be valid JSON.');}assert.deepEqual(Object.keys(value),['siteAuthorization']);
  assert.equal(typeof value.siteAuthorization,'string');assert.ok(value.siteAuthorization.length>0&&!/\s/.test(value.siteAuthorization));
  secret=value.siteAuthorization;
}
const http=[];
function safe(value){return JSON.stringify(value,null,2).split(secret||'IMPOSSIBLE_EMPTY_TOKEN').join('[REDACTED]')+'\n';}
const save=(name,value)=>fs.writeFile(path.join(run,name),typeof value==='string'?value:safe(value),{flag:'wx',mode:0o600});
async function call(suffix,body,expectedStatus) {
  assert.ok(/^\/api\/consequences(?:\/consequence-[a-zA-Z0-9_-]+)?$/.test(suffix),'Only manual room endpoints allowed');
  if(body)assert.ok(['draft','requestReview','completeReview','vote','register',undefined].includes(body.type),'Only explicit manual actions allowed');
  const headers={'Accept':'application/json','OAI-Sites-Authorization':`Bearer ${secret}`};
  if(body)Object.assign(headers,{'Content-Type':'application/json',Origin:base});
  const start=performance.now();
  const response=await fetch(base+suffix,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  http.push({method:body?'POST':'GET',path:suffix,action:body?.type??null,status:response.status,durationMs:performance.now()-start});
  if(expectedStatus){assert.equal(response.status,expectedStatus);return result;}
  assert.ok(response.ok,`Manual endpoint returned ${response.status}: ${result.code||'error'}`);
  assert.ok(result.room&&!result.room.automaticReview,'No automatic model review is permitted');
  return result.room;
}
const post=(id,body,status)=>call('/api/consequences/'+id,body,status);
function oracle(r,a){if(!r)return null;const predicates=[];if(r.minAge!==null)predicates.push(a.age>=r.minAge);if(r.residentRequired)predicates.push(a.resident);return (!predicates.length||(r.join==='all'?predicates.every(Boolean):predicates.some(Boolean)))&&(r.deadline===null||(r.deadlineInclusive?Date.parse(a.submittedAt)<=Date.parse(r.deadline):Date.parse(a.submittedAt)<Date.parse(r.deadline)));}
function match(a,b){if(a===null||b===null)return a===b;const lo=Date.parse('0000-01-01T00:00:00.000Z'),hi=Date.parse('9999-12-31T23:59:59.999Z');const times=new Set([lo,hi]);for(const r of[a,b])if(r.deadline)for(const d of[-1,0,1]){const t=Date.parse(r.deadline)+d;if(t>=lo&&t<=hi)times.add(t);}for(let age=0;age<=120;age++)for(const resident of[false,true])for(const t of times){const attendee={age,resident,submittedAt:new Date(t).toISOString()};if(oracle(a,attendee)!==oracle(b,attendee))return false;}return true;}
await authorization();
const source=await fs.readFile(path.join(corpus,'cases.json'),'utf8');
const expected=await fs.readFile(path.join(corpus,'EXPECTATIONS.md'),'utf8');
const cases=JSON.parse(source).cases;
if(phase==='prepare'){
  await fs.mkdir(run); // Never overwrite prior evidence.
  const manifest={mode:'manual independent-agent relay; zero model API calls',base,preparedAt:new Date().toISOString(),casesSHA256:hash(source),expectationsSHA256:hash(expected),cases:[]};
  for(const c of cases){
    let room=await call('/api/consequences',{});
    await Promise.all(['alice','bob'].map(editor=>post(room.id,{type:'draft',editor,baseVersion:1,text:c.drafts[editor]})));
    room=await post(room.id,{type:'requestReview'});
    await save(c.id+'.before.json',room);await save(c.id+'.prompt.txt',room.activeJob.prompt);
    manifest.cases.push({id:c.id,roomId:room.id,promptSHA256:hash(room.activeJob.prompt)});
  }
  await save('manifest.json',manifest);await save('prepare-http.json',http);
  console.log(JSON.stringify({prepared:manifest.cases.length,run,manifest:manifest.cases}));
}else if(phase==='apply'){
  const manifest=JSON.parse(await fs.readFile(path.join(run,'manifest.json'),'utf8'));
  assert.equal(hash(source),manifest.casesSHA256);assert.equal(hash(expected),manifest.expectationsSHA256);
  await fs.access(path.join(run,'results.json')).then(()=>{throw new Error('Already applied');},e=>{if(e.code!=='ENOENT')throw e;});
  const results=[];
  for(const m of manifest.cases){
    const c=cases.find(c=>c.id===m.id),r={id:c.id,roomId:m.roomId,passed:false,checks:[],registrations:[]};
    try{
      assert.equal(hash(await fs.readFile(path.join(run,c.id+'.prompt.txt'),'utf8')),m.promptSHA256);
      const raw=await fs.readFile(path.join(run,c.id+'.response.json'),'utf8');r.responseSHA256=hash(raw);
      let room=await post(m.roomId,{type:'completeReview',response:raw});
      await save(c.id+'.interpreted.json',room);
      assert.equal(room.published.version,1);const baseline=structuredClone(room.published);
      const candidates=Object.fromEntries(room.review.candidates.map(v=>[v.editor,v]));
      r.candidates=candidates;
      for(const editor of ['alice','bob']){
        assert.equal(candidates[editor][editor==='alice'?'en':'es'],c.drafts[editor]);
        assert.ok(match(candidates[editor].rules,c.expected[editor].rules),c.id+'/'+editor+' interpretation mismatch');
        for(const s of c.scenarios){const actual=oracle(candidates[editor].rules,s);r.checks.push({editor,attendee:{age:s.age,resident:s.resident,submittedAt:s.submittedAt},actual,expected:s.expected[editor]});assert.equal(actual,s.expected[editor]);}
      }
      const discovery=discoverCounterexamples(candidates.alice.rules,candidates.bob.rules);r.discovery=discovery;
      assert.equal(discovery.status,c.expected.comparison);
      assert.deepEqual(discovery.witnesses.map(w=>w.direction==='left-only'?'alice-only':'bob-only').sort(),[...c.expected.directions].sort());
      for(const w of discovery.witnesses){assert.notEqual(oracle(candidates.alice.rules,w.attendee),oracle(candidates.bob.rules,w.attendee));assert.equal(w.left.accepted,oracle(candidates.alice.rules,w.attendee));assert.equal(w.right.accepted,oracle(candidates.bob.rules,w.attendee));}
      const immutable=[];
      for(const [i,w]of discovery.witnesses.entries()){
        room=await post(room.id,{type:'register',requestId:`before-${c.id}-${i}`,policyVersion:1,label:`Discovered consequence before approval ${i+1}`,...w.attendee});
        const receipt=room.registrations.at(-1);assert.equal(receipt.policyVersion,1);for(const key of ['age','resident','submittedAt'])assert.equal(receipt[key],w.attendee[key]);assert.equal(receipt.decision.accepted,oracle(room.published.rules,w.attendee));immutable.push(receipt);r.registrations.push(receipt);
      }
      if(candidates.alice.rules&&candidates.bob.rules){
        room=await post(room.id,{type:'vote',editor:'alice',reviewId:room.review.id,candidateId:candidates.alice.id});assert.deepEqual(room.published,baseline);r.singleVoteHeld=true;
        room=await post(room.id,{type:'vote',editor:'bob',reviewId:room.review.id,candidateId:candidates.bob.id});assert.deepEqual(room.published,baseline);r.mismatchedVotesHeld=true;
        room=await post(room.id,{type:'vote',editor:'bob',reviewId:room.review.id,candidateId:candidates.alice.id});assert.equal(room.published.version,2);r.jointApprovalPublished=true;
        for(const [i,w]of discovery.witnesses.entries()){
          room=await post(room.id,{type:'register',requestId:`after-${c.id}-${i}`,policyVersion:2,label:`Discovered consequence after approval ${i+1}`,...w.attendee});
          const receipt=room.registrations.at(-1);assert.equal(receipt.policyVersion,2);for(const key of ['age','resident','submittedAt'])assert.equal(receipt[key],w.attendee[key]);assert.equal(receipt.decision.accepted,oracle(candidates.alice.rules,w.attendee));r.registrations.push(receipt);
        }
      }else{
        for(const candidate of Object.values(candidates).filter(v=>v.rules===null)){
          const rejected=await post(room.id,{type:'vote',editor:'alice',reviewId:room.review.id,candidateId:candidate.id},400);assert.equal(rejected.code,'UNRESOLVED');
        }
        room=await call('/api/consequences/'+room.id);assert.deepEqual(room.published,baseline);r.unresolvedVoteBlocked=true;
      }
      for(const receipt of immutable)assert.deepEqual(room.registrations.find(v=>v.id===receipt.id),receipt);
      await save(c.id+'.after.json',room);r.passed=true;
    }catch(e){r.error=String(e.message).split(secret).join('[REDACTED]');}
    results.push(r);console.log(JSON.stringify({case:c.id,passed:r.passed,error:r.error,comparison:r.discovery?.status,witnesses:r.discovery?.witnesses.length}));
  }
  await save('results.json',results);await save('apply-http.json',http);
  console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,total:results.length,scenarioChecks:results.reduce((n,r)=>n+r.checks.length,0),witnesses:results.reduce((n,r)=>n+(r.discovery?.witnesses.length||0),0),receipts:results.reduce((n,r)=>n+r.registrations.length,0),automaticReviewEndpointsRequested:http.filter(x=>x.path.endsWith('/review')).length}));
}else{
  const room=await call('/api/consequences/consequence-0d124fd8-5ec2-4306-93a2-ce0d0a3282b9');
  await save('browser-final.json',room);await save('browser-snapshot-http.json',http);
  console.log(JSON.stringify({roomId:room.id,version:room.published.version,receipts:room.registrations.length}));
}
