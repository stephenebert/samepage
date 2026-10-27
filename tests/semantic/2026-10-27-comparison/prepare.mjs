#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {parseBenchmarkDataset,prepareBenchmarkPlan,BENCHMARK_CONFIG,BENCHMARK_RUN_ID} from '../samepage-live/lib/studio-benchmark.ts';
globalThis.fetch=()=>{throw Error('Freeze preparation makes no network requests');};
const DIR=path.dirname(fileURLToPath(import.meta.url)),SOURCE=path.resolve(DIR,'../samepage-live'),CORE_COMMIT='9d7b0c5755de3465610a592cfccd83bfd4d3ba7b';
const hash=b=>createHash('sha256').update(b).digest('hex');
try{await fs.access(path.join(DIR,'.live-run.lock'));throw Error('Cannot change freeze after live execution starts');}catch(e){if(e.code!=='ENOENT')throw e;}
const read=async n=>JSON.parse(await fs.readFile(path.join(DIR,n),'utf8'));
const save=async(n,v)=>fs.writeFile(path.join(DIR,n),JSON.stringify(v,null,2)+'\n');
const input=await read('holdout/provider-inputs.json'),data=await parseBenchmarkDataset(input),holdout=await read('holdout/FREEZE.json');
for(const[name,h]of Object.entries(holdout.sourceFiles))assert.equal(hash(await fs.readFile(path.join(DIR,'holdout',name))),h);
assert.deepEqual(input,JSON.parse(await fs.readFile(path.join(SOURCE,'lib/studio-benchmark-inputs.json'),'utf8')));
await fs.mkdir(path.join(DIR,'evaluator'),{recursive:true});
const evaluatorFiles=[];
for(const name of await fs.readdir(path.join(SOURCE,'lib'))){
 if(!name.endsWith('.ts')||name.startsWith('studio-benchmark'))continue;
 const bytes=await fs.readFile(path.join(SOURCE,'lib',name)),original=execFileSync('git',['show',CORE_COMMIT+':lib/'+name],{cwd:SOURCE});assert.equal(hash(bytes),hash(original),'Existing core changed: '+name);
 await fs.writeFile(path.join(DIR,'evaluator',name),bytes);evaluatorFiles.push('evaluator/'+name);
}
const order=data.cases.flatMap((item,i)=>(i%2?['plain-meta','samepage']:['samepage','plain-meta']).map(arm=>({caseId:item.id,arm})));
const requests=order.map(item=>{const p=prepareBenchmarkPlan(data.cases.find(c=>c.id===item.caseId),item.arm,{...BENCHMARK_CONFIG,apiKey:'',enabled:false},'2026-10-27T00:00:00.000Z');return{...item,requestBytes:p.requestBytes,reservedNanoUsd:p.reservedNanoUsd,requestSha256:hash(p.body),body:JSON.parse(p.body)};});
await save('provider-requests.freeze.json',requests);
const plan={runId:BENCHMARK_RUN_ID,sourceCoreCommit:CORE_COMMIT,datasetHash:data.inputSha256,model:BENCHMARK_CONFIG.model,protocol:BENCHMARK_CONFIG.protocol,reasoningEffort:BENCHMARK_CONFIG.reasoningEffort,maxCompletionTokens:8192,maxRequests:24,maxProviderRequestBytes:32768,framingTokens:4096,budgetUsd:2,conservativeEstimatedMaxUsd:24*((32768+4096)*1.25+8192*4.25)/1e6,exactRequestsConservativeEstimateUsd:requests.reduce((n,p)=>n+p.reservedNanoUsd,0)/1e9,automaticRetries:false,order};
assert.ok(plan.conservativeEstimatedMaxUsd<2);assert.ok(plan.exactRequestsConservativeEstimateUsd<plan.conservativeEstimatedMaxUsd);await save('plan.json',plan);
const files={};
for(const n of ['holdout/provider-inputs.json','holdout/goldens.json','holdout/independent-oracle.mjs','holdout/FREEZE.json','holdout/SHA256SUMS','protocol.txt','run-comparison.mjs','score.mjs','prepare.mjs','plan.json','provider-requests.freeze.json','preflight-audit.json','preflight-review.mjs',...evaluatorFiles])files[n]=hash(await fs.readFile(path.join(DIR,n)));
await save('FREEZE.json',{version:1,frozenAt:new Date().toISOString(),providerCallsSoFar:0,files});
console.log(JSON.stringify({status:'frozen-before-live',cases:data.cases.length,requests:requests.length,datasetHash:data.inputSha256,sourceCoreCommit:CORE_COMMIT,maximumProviderRequestBytes:Math.max(...requests.map(p=>p.requestBytes)),conservativeEstimatedMaxUsd:plan.conservativeEstimatedMaxUsd,exactRequestsConservativeEstimateUsd:plan.exactRequestsConservativeEstimateUsd},null,2));
