import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const source=process.env.SAMEPAGE_SOURCE || (fs.existsSync(path.resolve(base,'../../../lib/studio.ts')) ? path.resolve(base,'../../..') : path.resolve(base,'../samepage-live'));
const {applyStudioAction}=await import(pathToFileURL(path.join(source,'lib/studio.ts')));
const {evaluateStudioPolicy}=await import(pathToFileURL(path.join(source,'lib/studio-engine.ts')));
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const clarified=process.argv.includes('--clarified'),prefix=clarified?'clarified/':'';
const cases=clarified?['guardian-exception-scope','discount-priority']:['central-demo','guardian-exception-scope','discount-priority','equivalent-window-and-negation','unsupported-seat-capacity'];
const report={kind:clarified?'explicit-deadline-clarification-round':'frozen-independent-agent-evaluation',providerCalls:0,scenarioChecks:0,abstentionChecks:0,unexpectedAbstentions:0,cases:[]};
for(const id of cases){
  const fixture=read(`corpus/${id}.json`),expected=read(`corpus/${id}.expectations.json`),snapshot=read(`${prefix}prompts/${id}.snapshot.json`),response=read(`${prefix}responses/${id}.json`);
  const room=applyStudioAction(snapshot,{type:'completeReview',response},'2026-10-20T12:01:00.000Z');
  const result={caseId:id,responseSha256:createHash('sha256').update(fs.readFileSync(path.join(base,`${prefix}responses/${id}.json`))).digest('hex'),discovery:room.review.discovery,checks:[],unexpectedAbstentions:0};
  for(const editor of ['alice','bob']){
    const candidate=room.review.candidates.find(c=>c.editor===editor);
    if(expected.interpretationExpectation[editor]===null){
      assert.equal(candidate.rules,null);assert.ok(candidate.issues.length);report.abstentionChecks++;
      result.checks.push({editor,abstained:true,issues:candidate.issues});continue;
    }
    if(!candidate.rules){
      assert.ok(candidate.issues.length);report.unexpectedAbstentions++;result.unexpectedAbstentions++;
      result.checks.push({editor,expectedExecutable:true,abstained:true,issues:candidate.issues});continue;
    }
    for(const scenario of fixture.scenarios){
      const {registrationTimeUtc,...facts}=scenario.participant;
      const attendee={...facts,submittedAt:registrationTimeUtc};
      const decision=evaluateStudioPolicy(candidate.rules,attendee);
      const target=expected.scenarios.find(s=>s.scenarioId===scenario.scenarioId)[editor];
      assert.equal(decision.accepted,target.eligible,`${id}/${editor}/${scenario.scenarioId} admission`);
      assert.equal(decision.feeCents,target.feeCents,`${id}/${editor}/${scenario.scenarioId} fee`);
      result.checks.push({editor,scenarioId:scenario.scenarioId,accepted:decision.accepted,feeCents:decision.feeCents});report.scenarioChecks++;
    }
  }
  const relationship=expected.expectedRelationship;
  const want=relationship.supportedComparison==='unresolved'?'unresolved':relationship.admissionEquivalent&&relationship.feeEquivalentAmongAdmitted?'equivalent':'different';
  if(!result.unexpectedAbstentions) assert.equal(room.review.discovery.status,want,`${id} relationship`);
  for(const w of room.review.discovery.witnesses){
    const a=evaluateStudioPolicy(room.review.candidates[0].rules,w.attendee),b=evaluateStudioPolicy(room.review.candidates[1].rules,w.attendee);
    assert.ok(a.accepted!==b.accepted||a.feeCents!==b.feeCents);
  }
  result.passed=result.unexpectedAbstentions===0;report.cases.push(result);
  fs.mkdirSync(path.join(base,prefix+'results'),{recursive:true});
  fs.writeFileSync(path.join(base,`${prefix}results/${id}.room.json`),JSON.stringify(room,null,2)+'\n');
}
fs.writeFileSync(path.join(base,prefix+'results/report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pairs:report.cases.length,scenarioChecks:report.scenarioChecks,abstentionChecks:report.abstentionChecks,unexpectedAbstentions:report.unexpectedAbstentions,discoveries:report.cases.map(c=>({case:c.caseId,status:c.discovery.status,witnesses:c.discovery.witnesses.length}))},null,2));
