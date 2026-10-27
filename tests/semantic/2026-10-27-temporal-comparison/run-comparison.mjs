#!/usr/bin/env node
// Site service token enters hidden stdin and is never saved, printed, or put in argv.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const DIR=path.dirname(fileURLToPath(import.meta.url));
const ORIGIN='https://samepage-language-lab.ampleboar17.chatgpt.site';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async name=>JSON.parse(await fs.readFile(path.join(DIR,name),'utf8'));
const save=async(name,value)=>{await fs.mkdir(path.dirname(path.join(DIR,name)),{recursive:true});await fs.writeFile(path.join(DIR,name),JSON.stringify(value,null,2)+'\n');};
async function verifyFreeze(){
 const freeze=await read('FREEZE.json');
 for(const [name,expected] of Object.entries(freeze.files))assert.equal(hash(await fs.readFile(path.join(DIR,name))),expected,'Frozen file changed: '+name);
 const plan=await read('plan.json');assert.equal(plan.maxRequests,24);assert.equal(plan.model,'muse-spark-1.3');assert.equal(plan.reasoningEffort,'low');assert.equal(plan.maxCompletionTokens,8192);assert.ok(plan.conservativeEstimatedMaxUsd<2);
 assert.equal(plan.order.length,24);assert.equal(new Set(plan.order.map(x=>x.caseId+':'+x.arm)).size,24);
 return {freeze,plan};
}
let token='',ledger;
async function secretInput(){
 if(process.stdin.isTTY)process.stdin.setRawMode(true);
 process.stdout.write('Ready for Site service credential on hidden stdin.\n');
 token=await new Promise((resolve,reject)=>{let buffer='';process.stdin.setEncoding('utf8');process.stdin.resume();const onData=chunk=>{buffer+=chunk;const n=buffer.indexOf('\n');if(n>=0){process.stdin.off('data',onData);process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);try{const data=JSON.parse(buffer.slice(0,n));assert.equal(typeof data.token,'string');assert.ok(data.token.length>10);resolve(data.token);}catch{reject(Error('Invalid credential input'));}}};process.stdin.on('data',onData);});
}
async function request(method,body,name){
 const started=Date.now();let response;
 try{response=await fetch(ORIGIN+'/api/studio-benchmark',{method,headers:{'OAI-Sites-Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json','Origin':ORIGIN}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(70000)});}catch{await save('responses/'+name+'.json',{status:'transport-error',durationMs:Date.now()-started});throw Error('Transport failed; no automatic retry. Consult durable server ledger.');}
 const rawText=await response.text();let json;try{json=JSON.parse(rawText);}catch{throw Error('Non-JSON server response; no retry.');}
 const evidence={httpStatus:response.status,durationMs:Date.now()-started,body:body??null,json};await save('responses/'+name+'.json',evidence);
 return evidence;
}
async function main(){
 const {freeze,plan}=await verifyFreeze();
 if(process.argv[2]!=='--live'){console.log(JSON.stringify({status:'offline-preflight-passed',model:plan.model,reasoningEffort:plan.reasoningEffort,requests:plan.maxRequests,estimatedCeilingUsd:plan.conservativeEstimatedMaxUsd,freezeSha256:hash(JSON.stringify(freeze)),networkCalls:0},null,2));return;}
 assert.equal(process.argv.length,3);await secretInput();
 const lock=await fs.open(path.join(DIR,'.live-run.lock'),'wx',0o600);await lock.close();
 ledger={runId:plan.runId,startedAt:new Date().toISOString(),status:'running',freezeSha256:hash(JSON.stringify(freeze)),attempts:[],actualBilledCostUsd:null};await save('live-ledger.json',ledger);
 try{
  const preflight=await request('GET',null,'00-server-preflight');assert.equal(preflight.httpStatus,200);assert.equal(preflight.json.runId,plan.runId);assert.equal(preflight.json.ready,true);assert.equal(preflight.json.ordinaryStudioEnabled,false);assert.equal(preflight.json.maxAttempts,24);assert.equal(preflight.json.config.model,plan.model);assert.equal(preflight.json.config.reasoningEffort,plan.reasoningEffort);assert.equal(preflight.json.config.protocol,'expression-v3');assert.equal(preflight.json.config.maxCompletionTokens,8192);assert.equal(preflight.json.config.reuseUnchanged,false);assert.equal(preflight.json.ledger,null,'Expected untouched server ledger');assert.ok(preflight.json.conservativeEstimatedMaxUsd<2);
  assert.equal(preflight.json.datasetHash,plan.datasetHash);
  const plannedRequests=await read('provider-requests.freeze.json');
  for(const [i,item] of plan.order.entries()){
   const name=String(i+1).padStart(2,'0')+'-'+item.caseId+'-'+item.arm;
   const attempt={...item,sequence:i+1,status:'pending',startedAt:new Date().toISOString()};ledger.attempts.push(attempt);await save('live-ledger.json',ledger);
   console.log(JSON.stringify({event:'attempt-start',sequence:i+1,...item}));
   const result=await request('POST',item,name);attempt.httpStatus=result.httpStatus;attempt.responseFile='responses/'+name+'.json';attempt.status=result.json.slot?.status??'server-error';await save('live-ledger.json',ledger);
   console.log(JSON.stringify({event:'attempt-finished',sequence:i+1,...item,status:attempt.status,durationMs:result.durationMs}));
   assert.ok(result.json.slot,'Missing durable result');assert.equal(result.json.replayed,false,'Fresh benchmark unexpectedly returned replay');assert.equal(result.json.slot.caseId,item.caseId);assert.equal(result.json.slot.arm,item.arm);const planned=plannedRequests.find(p=>p.caseId===item.caseId&&p.arm===item.arm);assert.equal(result.json.slot.requestSha256,planned.requestSha256);assert.equal(result.json.slot.requestBytes,planned.requestBytes);assert.equal(result.json.slot.reservedNanoUsd,planned.reservedNanoUsd);
   const code=result.json.slot.error?.code??result.json.code;
   if(['MODEL_AUTH','MODEL_RATE_LIMIT','BENCHMARK_BUDGET','BENCHMARK_DISABLED','BENCHMARK_BUSY','MODEL_NETWORK'].includes(code)||result.json.slot.status==='running')throw Error('Run stopped after '+code+'; no retry');
   assert.ok(['completed','failed'].includes(result.json.slot.status),'Nonterminal or rejected attempt');
  }
  ledger.status='completed';ledger.finishedAt=new Date().toISOString();
 }catch(error){ledger.status='stopped';ledger.error=error.message;throw error;}
 finally{try{await request('GET',null,'99-server-final');}catch{ledger.finalReadFailed=true;}await save('live-ledger.json',ledger);token='';}
 console.log(JSON.stringify({status:ledger.status,attempts:ledger.attempts.length,estimatedCeilingUsd:plan.conservativeEstimatedMaxUsd}));
}
main().catch(error=>{token='';console.error(error.message);process.exitCode=1;});
