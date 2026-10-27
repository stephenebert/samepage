import fs from 'node:fs/promises';
const read=async n=>JSON.parse(await fs.readFile(new URL(n,import.meta.url),'utf8'));
const r=await read('./report.json'),v=await read('./verification.json'),p=await read('./plan.json'),f=await read('./FREEZE.json'),ledger=await read('./live-ledger.json');
const a=r.summary.samepage,b=r.summary['plain-meta'];
const rows=r.rows.filter(x=>x.arm==='samepage'),policies=rows.flatMap(x=>x.fidelity?.policies??[]),checks=policies.reduce((s,x)=>s+x.checks,0),mismatches=policies.reduce((s,x)=>s+(x.mismatches??0),0),published=rows.filter(x=>x.workflow?.jointSelectionPublished),receipts=rows.reduce((s,x)=>s+(x.workflow?.receiptsCorrect??0),0);
const failures=[];for(const row of r.rows.filter(x=>!x.correct)){const attempt=ledger.attempts.find(x=>x.caseId===row.caseId&&x.arm===row.arm),raw=attempt?.responseFile?await read('./'+attempt.responseFile):null;failures.push({caseId:row.caseId,arm:row.arm,expected:row.expected,actual:row.predicted??row.status,issues:raw?.json?.slot?.result?.issues??row.error??null});}
const sec=x=>(x/1000).toFixed(2),money=x=>x===null?'unconfirmed':'$'+x.toFixed(6);
const text=`SamePage temporal clarification fix — fresh comparison, 27 October 2026

Frozen-label score: SamePage ${a.correct}/${a.total}; plain Meta ${b.correct}/${b.total}.
VALIDITY NOTE: v2c07 has a plausible Spanish AND/OR ambiguity that preflight missed. SamePage's clarification is not a confirmed error. The frozen scores remain unchanged. Excluding this disputed item gives11/11 for both approaches as a post-hoc sensitivity view, not a replacement primary result or a win. See post-run-adjudication.json.
This is a separate new holdout. The original 11/12 versus 12/12 benchmark and its failure remain unchanged.

Metric                              SamePage       Plain Meta
Correct classification              ${a.correct}/${a.total}          ${b.correct}/${b.total}
Differences detected                ${a.differencesDetected}/${a.differentTotal}            ${b.differencesDetected}/${b.differentTotal}
Equivalent pairs recognized         ${a.equivalentCorrect}/${a.equivalentTotal}            ${b.equivalentCorrect}/${b.equivalentTotal}
Necessary clarification             ${a.clarificationCorrect}/${a.clarificationTotal}            ${b.clarificationCorrect}/${b.clarificationTotal}
Different cases with valid example  ${a.differentCasesWithValidWitness}/${a.differentTotal}            ${b.differentCasesWithValidWitness}/${b.differentTotal}
Oracle-marked extra clarification   ${a.unnecessaryAbstentions} (disputed)   ${b.unnecessaryAbstentions}
Median provider time                ${sec(a.medianProviderMs)} seconds   ${sec(b.medianProviderMs)} seconds
Median complete HTTP request        ${sec(a.medianHttpMs)} seconds   ${sec(b.medianHttpMs)} seconds
Estimated uncached token cost        ${money(a.uncachedRateEstimateUsd)}      ${money(b.uncachedRateEstimateUsd)}

What changed
Shared interpretation guidance now makes explicit UTC 'before' / 'antes de/del' and 'after' / 'después de/del' boundaries exclusive without requiring an emphasis word. Inclusive and negated complete phrases retain their appropriate meaning. Missing dates/timezones, unclear wording, contradictions and unsupported requirements still require clarification. Source text is not rewritten, the validation/approval gates remain intact, and the interpreter cache version was updated. The same guidance applies to policy review and repair prompts. The fresh live test measures policy review, not the repair-generation branch.

Mechanics and fidelity
${policies.filter(x=>x.compiled).length} of20 resolved source policies compiled. The compiled rules matched ${checks.toLocaleString('en-US')} reference outcomes with ${mismatches} mismatches. These are many executions of the same small policy set, not independent policy examples or human language validation.
Offline replay of the actual returned interpretations through production reducers produced ${published.length} joint publications and ${receipts} correct synthetic receipts. One approval and different candidate choices were checked to hold publication. Genuinely unresolved cases must block; an unnecessary block remains a failure.

Failures retained
${failures.length?JSON.stringify(failures,null,2):'No classification errors were found in this fresh set.'}
Invalid witnesses: SamePage ${a.invalidWitnesses}, plain Meta ${b.invalidWitnesses}. Extra clarification against the frozen labels: SamePage ${a.unnecessaryAbstentions} (v2c07 disputed), plain Meta ${b.unnecessaryAbstentions}.

Fairness and reproducibility
One agent authored12 new synthetic pairs without viewing the previous cases, model outputs, application prompts or fix. A separate agent audited the source meanings and independent reference functions before freeze. Composition:6 different,4 equivalent,2 unresolved. Neither author nor reviewer is a human participant.
Both arms used ${p.model}, ${p.reasoningEffort} reasoning and ${p.maxCompletionTokens} completion-token caps, separate contexts and balanced first-arm order. The competent plain-review prompt is unchanged from the first comparison. It received the same original policies as SamePage, without goldens, examples, executable rules or checker tools. SamePage's revised interpreter plus unchanged deterministic checker is the tested product pipeline.
All ${Object.keys(f.files).length} frozen files stayed unchanged after freeze. Source commit ${p.sourceCoreCommit}. There were ${v.modelRequests} actual Meta requests and ${v.naturalStops} complete natural stops, with no model retries or case tuning. A read-only deployment preflight briefly received the older version and stopped with zero model attempts; it is preserved separately under rollout-preflight. The run began only after the new version and empty ledger were verified.

Cost and state
Estimated combined token cost ${money(v.uncachedRateEstimateUsd)}. The actual provider credit deduction is unconfirmed and billing may lag. Before this run, Meta showed148.85USD free credits and0USD outstanding. Conservative reservation for exact requests: ${money(v.conservativeReservedUsd)}, below the2USD allowance. Normal Studio model calls stayed paused; the separate benchmark gate is disabled after the run. See pause-verification.json for the verified post-run state.

Interpretation
The full-set difference depends on a disputed source item. It is not evidence that the temporal fix failed, nor proof that either system is more accurate. Our initial reference review missed that ambiguity. All11 undisputed cases were correctly classified by both arms; source-language assessments here remain AI reviewed.
${a.correct===b.correct?'Classification accuracy was tied on this set. This provides no evidence that SamePage detects policy disagreements more accurately than a competent plain Meta review.':a.correct>b.correct?'SamePage classified more pairs correctly on this small set. This is descriptive evidence, not proof of general superiority.':'Plain Meta matched more frozen labels, but the sole differing label is disputed. Do not call this a clean accuracy loss or claim SamePage has superior review accuracy.'}
The second holdout differs from the first, so their scores are not a controlled before/after estimate of the fix. Check fresh explicit-time cases and clarification controls to judge the targeted behavior. SamePage adds executable checks, joint approval, publication and versioned receipts; their practical value still needs real-user validation. No benchmark result predicts hackathon placement.

Evidence
report.json contains per-case scores, witnesses, fidelity and workflow checks. provider-requests.freeze.json contains exact provider requests without credentials. responses/ and live-ledger.json retain raw structured outcomes and accounting. protocol.txt, plan.json and FREEZE.json define the preregistered procedure. score.mjs and verify-evidence.mjs reproduce results offline; no API calls are needed to audit this evidence.
`;
await fs.writeFile(new URL('./RESULTS.txt',import.meta.url),text);console.log(JSON.stringify({reportWritten:'RESULTS.txt',samepage:a.correct,plainMeta:b.correct,compiledPolicies:policies.filter(x=>x.compiled).length,checks,mismatches,jointPublications:published.length,receipts,failures}));
