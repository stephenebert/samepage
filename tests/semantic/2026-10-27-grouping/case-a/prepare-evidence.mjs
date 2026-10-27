#!/usr/bin/env node
// Offline preparation only. Refuses after any live-run marker.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {CONTRACT} from './run-unseen.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),source='/Users/steph/Documents/Playground/output/meta-hackathon/samepage-live';
if(process.argv.length!==2)throw Error('Preparation accepts no arguments');
for(const name of ['live-ledger.json','.live-run.lock'])try{await fs.access(path.join(dir,name));throw Error('Live evidence exists; preparation forbidden');}catch(e){if(e.code!=='ENOENT')throw e;}
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
if(commit!==CONTRACT.sourceCommit||execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim())throw Error('Source must equal frozen clean production commit');
const hash=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,null,2)+'\n';
const input=JSON.parse(await fs.readFile(path.join(dir,'holdout/provider-inputs.json'),'utf8'));
await fs.mkdir(path.join(dir,'evaluator'),{recursive:true});const files=[];
for(const name of ['studio.ts','studio-engine.ts','studio-model.ts','studio-expression.ts','studio-repair.ts','studio-repair-model.ts','studio-presentation.ts','policy-model.ts','room.ts','consequences.ts']){const bytes=await fs.readFile(path.join(source,'lib',name));await fs.writeFile(path.join(dir,'evaluator',name),bytes);files.push({source:'lib/'+name,snapshot:'evaluator/'+name,bytes:bytes.length,sha256:hash(bytes)});}
const snapshot=json({sourceCommit:commit,sourceDirectory:source,capturedAt:new Date().toISOString(),files});await fs.writeFile(path.join(dir,'evaluator-snapshot.json'),snapshot);
const runnerFiles={};for(const name of ['run-unseen.mjs','verify-evidence.mjs','prepare-evidence.mjs'])runnerFiles[name]=hash(await fs.readFile(path.join(dir,name)));
const plan={schemaVersion:1,contract:CONTRACT,caseId:input.caseId,holdoutManifestSha256:hash(await fs.readFile(path.join(dir,'holdout/SHA256SUMS'))),providerInputsSha256:hash(await fs.readFile(path.join(dir,'holdout/provider-inputs.json'))),evaluatorSnapshotSha256:hash(snapshot),runnerFiles};
const planBytes=json(plan);await fs.writeFile(path.join(dir,'plan.json'),planBytes);await fs.writeFile(path.join(dir,'plan.freeze.json'),json({algorithm:'sha256',sha256:hash(planBytes),frozenBeforeLive:true,createdAt:new Date().toISOString()}));
console.log(json({status:'prepared-offline',sourceCommit:commit,caseId:input.caseId,snapshotFiles:files.length,planSha256:hash(planBytes),runnerFiles,networkCalls:0}));
