#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
globalThis.fetch=()=>{throw Error('Evidence verification is offline');};
const DIR=path.dirname(fileURLToPath(import.meta.url)),read=async n=>JSON.parse(await fs.readFile(path.join(DIR,n),'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const freeze=await read('FREEZE.json');for(const[name,sha]of Object.entries(freeze.files))assert.equal(hash(await fs.readFile(path.join(DIR,name))),sha,name+' changed');
const ledger=await read('live-ledger.json'),plan=await read('plan.json'),requests=await read('provider-requests.freeze.json');
const start=(await read('responses/00-server-preflight.json')).json,end=(await read('responses/99-server-final.json')).json;
assert.equal(ledger.runId,plan.runId);assert.equal(ledger.freezeSha256,hash(JSON.stringify(freeze)));assert.equal((await read('responses/00-server-preflight.json')).httpStatus,200);assert.equal((await read('responses/99-server-final.json')).httpStatus,200);assert.equal(start.config.model,plan.model);assert.equal(start.config.protocol,plan.protocol);assert.equal(start.config.reasoningEffort,plan.reasoningEffort);assert.equal(start.config.maxCompletionTokens,plan.maxCompletionTokens);
assert.equal(start.ledger,null);assert.equal(start.datasetHash,plan.datasetHash);assert.equal(end.datasetHash,plan.datasetHash);assert.equal(end.ordinaryStudioEnabled,false);assert.equal(end.ledger.runId,plan.runId);assert.equal(end.ledger.inFlight,null);
assert.ok(Date.parse(freeze.frozenAt)<Date.parse(ledger.startedAt));assert.ok(ledger.attempts.length<=24);assert.equal(new Set(ledger.attempts.map(a=>a.caseId+':'+a.arm)).size,ledger.attempts.length);
let calls=0,promptTokens=0,completionTokens=0,reservedNanoUsd=0,naturalStops=0,usageComplete=true;
for(const [i,a]of ledger.attempts.entries()){
 assert.deepEqual({caseId:a.caseId,arm:a.arm},plan.order[i]);
 const r=await read(a.responseFile),slot=r.json.slot,planned=requests.find(p=>p.caseId===a.caseId&&p.arm===a.arm);assert.equal(r.json.replayed,false);assert.equal(slot.caseId,a.caseId);assert.equal(slot.arm,a.arm);assert.equal(slot.requestSha256,planned.requestSha256);assert.equal(slot.requestSha256,hash(JSON.stringify(planned.body)));assert.equal(slot.requestBytes,Buffer.byteLength(JSON.stringify(planned.body)));assert.equal(slot.reservedNanoUsd,planned.reservedNanoUsd);assert.deepEqual(slot,end.ledger.attempts[a.caseId+':'+a.arm]);assert.equal(slot.status,a.status);
 assert.equal(planned.body.model,plan.model);assert.equal(planned.body.reasoning_effort,plan.reasoningEffort);assert.equal(planned.body.max_completion_tokens,8192);
 assert.ok(['completed','failed'].includes(slot.status));assert.ok(!('apiKey'in slot));calls++;reservedNanoUsd+=slot.reservedNanoUsd;
 if(!Number.isInteger(slot.metrics?.promptTokens)||slot.metrics.promptTokens<0||!Number.isInteger(slot.metrics?.completionTokens)||slot.metrics.completionTokens<0)usageComplete=false;
 if(slot.metrics){promptTokens+=slot.metrics.promptTokens??0;completionTokens+=slot.metrics.completionTokens??0;assert.equal(slot.metrics.requestBytes,planned.requestBytes);assert.equal(slot.metrics.maxCompletionTokens,8192);if(slot.metrics.finishReason==='stop')naturalStops++;}
}
assert.equal(Object.keys(end.ledger.attempts).length,calls);assert.equal(end.ledger.reservedNanoUsd,reservedNanoUsd);assert.ok(reservedNanoUsd/1e9<2);if(ledger.status==='completed')assert.equal(calls,24);
console.log(JSON.stringify({status:'verified',runStatus:ledger.status,frozenBeforeCalls:true,modelRequests:calls,naturalStops,promptTokens,completionTokens,usageComplete,uncachedRateEstimateUsd:usageComplete?(promptTokens*1.25+completionTokens*4.25)/1e6:null,partialReportedUsageEstimateUsd:(promptTokens*1.25+completionTokens*4.25)/1e6,conservativeReservedUsd:reservedNanoUsd/1e9,actualBilledCostUsd:null,networkCalls:0},null,2));
