import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const D=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse(await fs.readFile(path.join(D,p),'utf8'));
const write=async(p,o)=>fs.writeFile(path.join(D,p),JSON.stringify(o,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
await fs.access(path.join(D,'live-ledger.json')).then(()=>{throw Error('Do not regenerate frozen plan after any live dispatch.');},e=>{if(e.code!=='ENOENT')throw e;});
const holdoutManifest=await fs.readFile(path.join(D,'holdout/SHA256SUMS'));
assert.equal(hash(holdoutManifest),'0a1e959ae04b89f3c7138da87bcbab2294fff134f77e9c94317d32dd881d3581');
const inputs=await read('holdout/provider-inputs.json'),goldens=await read('holdout/goldens.json'),boundaries=await read('holdout/boundary-cases.json');
const source=path.join(D,'../samepage-live/lib');
const names=['studio.ts','studio-engine.ts','studio-model.ts','policy-model.ts','room.ts','consequences.ts','studio-expression.ts'];
await fs.mkdir(path.join(D,'evaluator'),{recursive:true});
const snapshot={kind:'read-only-production-evaluator-snapshot',sourceCheckout:path.dirname(source),files:[]};
for(const name of names){const b=await fs.readFile(path.join(source,name));await fs.writeFile(path.join(D,'evaluator',name),b);snapshot.files.push({snapshot:'evaluator/'+name,source:path.join(source,name),sha256:hash(b),bytes:b.length});}
await write('evaluator-snapshot.json',snapshot);
const engine=await import('./evaluator/studio-engine.ts');
const old=await read('../samepage-latency-evidence/plan.json');
const matched=old.stages.slice(5,7);assert.deepEqual(matched.map(s=>s.id),['mosaic-priority','mosaic-corrected']);
const stages=[];
for(const phase of ['baseline','expression'])for(let i=0;i<2;i++){
 const stage=structuredClone(matched[i]);stage.id=phase+'-'+stage.id;stage.pairId=phase+'-mosaic';stage.phase=phase;stage.protocol=phase==='baseline'?'compact-v2':'expression-v3';
 stage.expectedRequestedEditors=phase==='baseline'&&i===1?['alice']:['alice','bob'];stage.expectedReusedEditors=phase==='baseline'&&i===1?['bob']:[];
 stage.allowOutputLimit=phase==='baseline'&&i===1;stages.push(stage);
}
for(const pair of inputs.pairs){
 const g=goldens.pairs.find(x=>x.id===pair.id);assert.ok(g);
 const rules=Object.fromEntries(g.candidates.map(c=>[c.editor,c.rules]));const discovery=engine.discoverStudioConsequences(rules.alice,rules.bob);assert.equal(discovery.status,g.expectedDiscoveryStatus);
 const cases=g.expectedDiscoveryStatus==='different'?boundaries.cases:[{id:'ambiguous-overlapping-rates',attendee:g.ambiguityWitness.attendee,expected:{alice:null,bob:null}}];
 if(g.expectedDiscoveryStatus==='different')for(const c of cases)for(const editor of ['alice','bob']){const a=engine.evaluateStudioPolicy(rules[editor],c.attendee);assert.deepEqual({accepted:a.accepted,feeCents:a.feeCents},c.expected[editor]);}
 const receipt=cases.find(c=>c.expected.alice?.accepted&&c.expected.bob?.accepted&&c.expected.alice.feeCents!==c.expected.bob.feeCents)||cases.find(c=>c.expected.alice?.accepted);
 stages.push({id:'fresh-'+pair.id,pairId:'fresh-'+pair.id,kind:'initial',phase:'expression',protocol:'expression-v3',expectedRequestedEditors:['alice','bob'],expectedReusedEditors:[],allowOutputLimit:false,
  providerInput:{en:pair.en,es:pair.es},evaluation:{expectedRulesByEditor:rules,outcomeCases:cases,discovery:{status:discovery.status,exactWitnessIds:discovery.witnesses.map(w=>w.id)},approval:{candidateApprovalsAllowed:discovery.status!=='unresolved'}},
  workflow:{publishEditor:discovery.status==='unresolved'?null:'alice',...(receipt?{receiptScenarioId:receipt.id}:{})}});
}
const plan={schemaVersion:1,name:'Bounded expression compiler vs indexed-node baseline',maxReviewPosts:6,budgetUsd:1,reservedOutputTokensPerRequest:12288,
 baseline:{protocol:'compact-v2',reasoningEffort:'medium',reuseUnchanged:true,maxCompletionTokens:8192},
 expression:{protocol:'expression-v3',reasoningEffort:'medium',reuseUnchanged:false,allowedMaxCompletionTokens:[8192,12288],higherLimitRequires:'baseline-mosaic-corrected MODEL_OUTPUT_LIMIT with finishReason:length'},
 holdoutManifestSha256:hash(holdoutManifest),historicalMatchedPlanSha256:hash(await fs.readFile(path.join(D,'../samepage-latency-evidence/plan.json'))),stages};
const content=canonical(plan);plan.freeze={mutableAfterFreeze:false,algorithm:'SHA-256',providerInputsSha256:hash(canonical(stages.map(s=>({id:s.id,providerInput:s.providerInput})))),evaluationsSha256:hash(canonical(stages.map(s=>({id:s.id,evaluation:s.evaluation})))),corpusWithoutFreezeSha256:hash(content)};
await write('plan.json',plan);const planSha=hash(await fs.readFile(path.join(D,'plan.json')));await write('plan.freeze.json',{algorithm:'sha256',sha256:planSha});
let runner=await fs.readFile(path.join(D,'run-compiler.mjs'),'utf8');assert.ok(runner.includes('PLAN_HASH_PENDING'));runner=runner.replace('PLAN_HASH_PENDING',planSha);await fs.writeFile(path.join(D,'run-compiler.mjs'),runner);
console.log(JSON.stringify({planSha256:planSha,stages:stages.map(s=>({id:s.id,protocol:s.protocol,expected:s.evaluation.discovery.status,scenarios:s.evaluation.outcomeCases.length})),snapshotFiles:names.length}));
