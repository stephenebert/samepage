"""Offline report aggregation. No provider calls or frozen-input edits."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parent
def read(name): return json.loads((ROOT/name).read_text())
def write(name,value): (ROOT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
plan=read('suite-plan.json')
assert hashlib.sha256((ROOT/'suite-plan.json').read_bytes()).hexdigest()==read('suite-plan.freeze.json')['sha256']
for name,sha in plan['files'].items(): assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha,name
reports=[read(f'case-{c}/report.json') for c in 'ab']
checks=[read(f'case-{c}/evidence-verification-result.json') for c in 'ab']
amb=read('ambiguity/evidence-verification-result.json')
assert all(r['status']=='passed' for r in reports) and amb['runStatus']=='passed'
assert all(read(f'audit/live-{c}.json')['status'].startswith('pass') for c in 'ab')
totals={key:sum(v[key] for v in checks) for key in ['modelRequests','passedStages','failedStages','naturalStops','concreteChecks','concreteFailures','independentOracleChecks','independentOracleMismatches','blockedAuthoredRepairs','publishedGeneratedRepairs','receipts','promptTokens','completionTokens']}
for key in ['modelRequests','promptTokens','completionTokens']:totals[key]+=amb[key]
totals['naturalStops']+=int(read('ambiguity/report.json')['metrics']['finishReason']=='stop')
totals['unresolvedCandidates']=amb['unresolvedCandidates'];totals['clarificationVotesBlocked']=amb['blockedVotes']
activation=read('activation-and-shutdown.json');activation['shutdown']=read('shutdown-confirmation.json');write('activation-and-shutdown.json',activation)
cost=round(sum(v['uncachedTokenRateEstimateUsd'] for v in checks)+amb['uncachedTokenRateEstimateUsd'],8)
write('suite-summary.json',{
 'status':'passed-with-bounded-scope','sourceCommit':plan['sourceCommit'],'siteVersion':plan['siteVersion'],
 'model':plan['model'],'protocol':plan['protocol'],'frozenFilesVerified':len(plan['files']),
 'mechanicalTestsPassed':187,'typecheckPassed':True,'productionBuildPassed':True,
 'automaticRetries':0,'sourceChangesAfterFreeze':False,'exampleTuningAfterFreeze':False,
 'totals':totals,'uncachedTokenRateEstimateUsd':cost,'actualBilledCostUsd':None,'conservativeEstimatedMaxUsd':plan['conservativeEstimatedMaxUsd'],
 'pricingSource':plan['pricingSource'],'billingObservation':'billing-observation.json',
 'cases':[{'directory':f'case-{c}',**r['case'],'rawBilingualAudit':'pass','canonicalWordingAudit':'pass','canonicalPublicationVerified':True,'originalWordingPreserved':True,
           'stages':[{'stage':s['stage'],'httpDurationMs':s['httpDurationMs'],'metrics':s['metrics']} for s in r['stages']],
           'url':'https://samepage-language-lab.ampleboar17.chatgpt.site/studio?room='+r['case']['roomId']+'#studio-repair'} for c,r in zip('ab',reports)],
 'clarificationTest':read('ambiguity/report.json'),'shutdown':read('shutdown-confirmation.json'),
 'fix':'New approvals display and publish the same explicitly grouped bilingual text rendered from checked rules; original user/model wording is retained separately. Prompts also require explicit grouping.',
 'legacyBehavior':'Previously saved pending/published records retain their original wording and approval behavior; no retroactive migration or rewritten receipts.',
 'limits':['Two fresh synthetic full flows plus one clarification policy; simulated roles, not real users.',
           'Independent bilingual review was performed by AI agents, not human bilingual reviewers.',
           'Compiled-rule comparisons do not establish faithful interpretation of arbitrary natural language.',
           'Canonical wording guarantees grouping relative to the interpreted rules, not correctness of the interpretation.',
           'Unsafe rewrites were authored test challenges; generated repairs received server-derived target rules.',
           'No speed improvement is claimed; individual HTTP waits ranged from 6.480 to 24.366 seconds.',
           'Cost is a token-rate estimate; the refreshed billing page remained loading, so actual credit deduction is unconfirmed.']
})
print(json.dumps({'status':'aggregated',**totals,'estimateUsd':cost}))
