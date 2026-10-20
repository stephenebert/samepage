import {spawnSync} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url)),origin=process.env.SAMEPAGE_ORIGIN||'http://127.0.0.1:5173';
let bearer='';if(process.argv.includes('--credential-stdin')){if(process.stdin.isTTY)spawnSync('stty',['-echo'],{stdio:'inherit'}); console.log('Ready for hidden credential input.');for await(const chunk of process.stdin){bearer+=chunk;if(bearer.includes('\n'))break;}bearer=bearer.trim();if(process.stdin.isTTY)spawnSync('stty',['echo'],{stdio:'inherit'});}
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
async function call(url,body,status=200){const r=await fetch(origin+url,{method:body?'POST':'GET',headers:{'content-type':'application/json','Origin':origin,...(bearer?{'OAI-Sites-Authorization':`Bearer ${bearer}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,status,`${url}: ${JSON.stringify(d).slice(0,200)}`);return d.room||d;}
const results=[];
for(const [id,prefix] of [['central-demo',''],['equivalent-window-and-negation',''],['unsupported-seat-capacity',''],['guardian-exception-scope','clarified/'],['discount-priority','clarified/']]){
  let room=await call('/api/studio',{},201);const url='/api/studio/'+room.id;
  const snap=read(`${prefix}prompts/${id}.snapshot.json`),response=read(`${prefix}responses/${id}.json`);
  await Promise.all(['alice','bob'].map(editor=>call(url,{type:'draft',editor,baseVersion:1,text:snap.drafts[editor].text})));
  room=await call(url,{type:'requestReview'});assert.equal(room.activeJob.prompt,snap.activeJob.prompt);
  room=await call(url,{type:'completeReview',response});const review=room.review;
  if(review.discovery.status==='unresolved'){
    await call(url,{type:'vote',editor:'alice',reviewId:review.id,candidateId:review.candidates[0].id},400);
    assert.equal((await call(url)).published.version,1);
  }else{
    room=await call(url,{type:'vote',editor:'alice',reviewId:review.id,candidateId:review.candidates[0].id});assert.equal(room.published.version,1);
    room=await call(url,{type:'vote',editor:'bob',reviewId:review.id,candidateId:review.candidates[1].id});assert.equal(room.published.version,1);
    room=await call(url,{type:'vote',editor:'bob',reviewId:review.id,candidateId:review.candidates[0].id});assert.equal(room.published.version,2);
    if(review.discovery.witnesses.length){const w=review.discovery.witnesses[0];const action={type:'register',requestId:'http-'+id,policyVersion:2,label:'Synthetic HTTP witness',...w.attendee};room=await call(url,action);assert.deepEqual(room.registrations.at(-1).decision,w.left);const again=await call(url,action);assert.equal(again.registrations.length,1);}
  }
  results.push({caseId:id,roomId:room.id,status:review.discovery.status,publishedVersion:room.published.version,receipts:room.registrations.length});
}
fs.writeFileSync(path.join(base,origin.includes('127.0.0.1')?'http-local.json':'http-private-deployed.json'),JSON.stringify({origin,providerCalls:0,results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
