#!/usr/bin/env node
// Offline preparation only. Run after root confirms production source is stable.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source='/Users/steph/Documents/Playground/output/meta-hackathon/samepage-live/lib';
if(process.argv.length!==2)throw Error('Preparation accepts no arguments.');
for(const name of ['live-ledger.json','.live-run.lock']){try{await fs.access(path.join(dir,name));throw Error('Live evidence already exists; cannot rewrite snapshots.');}catch(e){if(e.code!=='ENOENT')throw e;}}
const hash=b=>createHash('sha256').update(b).digest('hex');
const modules=['studio.ts','studio-engine.ts','studio-model.ts','studio-expression.ts','studio-repair.ts','studio-repair-model.ts','policy-model.ts','room.ts','consequences.ts'];
await fs.mkdir(path.join(dir,'evaluator'),{recursive:true});
const files=[];
for(const name of modules){const bytes=await fs.readFile(path.join(source,name));await fs.writeFile(path.join(dir,'evaluator',name),bytes);files.push({source:'lib/'+name,snapshot:'evaluator/'+name,bytes:bytes.length,sha256:hash(bytes)});}
const plan={schemaVersion:1,origin:'https://samepage-language-lab.ampleboar17.chatgpt.site',model:'muse-spark-1.3',protocol:'expression-v3',reasoningEffort:'low',reuseUnchanged:false,maxCompletionTokens:8192,maxRequests:6,maxProviderRequestBytes:65536,framingTokens:4096,budgetUsd:1,holdoutManifestSha256:'8f20e8e8572f9144fdd8afb95b6856bd971a8ff496591b40313b5c226b74615d',providerInputsSha256:'23b05ff1403d16b9c61fa114a726d8d0b76064d39a0a3bb9cac42dc64e5822a9',cases:['lumen-archive-workshop','orbit-mapping-sprint'],stages:['baseline','check-rewrite','generate-repair'],automaticRetries:false};
const json=x=>JSON.stringify(x,null,2)+'\n';
const planBytes=json(plan);
await fs.writeFile(path.join(dir,'plan.json'),planBytes);
await fs.writeFile(path.join(dir,'plan.freeze.json'),json({algorithm:'sha256',sha256:hash(planBytes),frozenBeforeLive:true}));
await fs.writeFile(path.join(dir,'evaluator-snapshot.json'),json({sourceDirectory:source,capturedAt:new Date().toISOString(),files}));
console.log(JSON.stringify({status:'prepared-offline',files:files.length,planSha256:hash(planBytes),networkCalls:0}));
