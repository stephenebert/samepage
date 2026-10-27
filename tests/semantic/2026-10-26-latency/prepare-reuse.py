from pathlib import Path
import json,hashlib,shutil
D=Path(__file__).resolve().parent;C=D/'unchanged-reuse';C.mkdir(exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(o):return json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def write(p,o):p.write_text(json.dumps(o,indent=2,ensure_ascii=False)+'\n')
prior=json.loads((D/'report.json').read_text());low=json.loads((D/'low-effort/report.json').read_text())
assert prior['status']=='passed' and prior['actualReviewPostAttempts']==8
assert low['status']=='stopped-fail-closed' and low['actualReviewPostAttempts']==2
stages=json.loads((D/'plan.json').read_text())['stages'][5:7];assert [s['id'] for s in stages]==['mosaic-priority','mosaic-corrected']
for i,stage in enumerate(stages):stage.update(reasoningEffort='medium',expectedRequestedEditors=['alice','bob'] if i==0 else ['alice'],expectedReusedEditors=[] if i==0 else ['bob'])
priorMax=prior['preflight']['estimatedMaxUsd']+sum(low['preflight']['stages'][i]['estimatedMaxUsd'] for i in range(2))
plan={'schemaVersion':1,'name':'Exact unchanged-editor reuse with medium reasoning','priorCompletedRequests':10,'totalTaskRequestLimit':12,'priorReportSha256':sha((D/'report.json').read_bytes()),'lowReportSha256':sha((D/'low-effort/report.json').read_bytes()),'priorEstimatedMaximumUsd':priorMax,'stages':stages}
base=canonical(plan);plan['freeze']={'mutableAfterFreeze':False,'algorithm':'SHA-256','providerInputsSha256':sha(canonical([{'id':s['id'],'providerInput':s['providerInput']} for s in stages])),'evaluationsSha256':sha(canonical([{'id':s['id'],'evaluation':s['evaluation']} for s in stages])),'corpusWithoutFreezeSha256':sha(base)}
write(C/'corpus.json',plan);h=sha((C/'corpus.json').read_bytes());write(C/'corpus.freeze.json',{'algorithm':'sha256','sha256':h})
s=(D/'low-effort/run-low.mjs').read_text()
def rep(a,b):
 global s
 assert a in s,a[:90]
 s=s.replace(a,b)
rep('8f89bf4264332da863fcbfedd1cdc8901102fba73caa61b1d5386233f12ec678',h)
rep('const MAX_REVIEWS = 4;','const MAX_REVIEWS = 2;')
rep("reasoning_effort: 'low'","reasoning_effort: 'medium'")
rep("reasoningEffort: 'low'","reasoningEffort: 'medium'")
rep("model.reasoningEffort === 'low'","model.reasoningEffort === 'medium'")
rep('Require compact-v2 with explicit low reasoning.','Require compact-v2 with medium reasoning.')
rep("after.automaticReview?.reasoningEffort === 'low'","after.automaticReview?.reasoningEffort === 'medium'")
rep('function providerBody(job) {', "function providerBody(job, cache) {\n  const prepared = wire.prepareStudioRequest(job, {apiKey:'', model:MODEL, enabled:true, protocol:'compact-v2', reasoningEffort:'medium'}, cache);")
rep('wire.buildStudioWirePrompt(job)', 'prepared.prompt')
rep("name: 'samepage_studio_compact', strict: true, schema: wire.studioReviewWireSchema(job)", 'name: prepared.name, strict: true, schema: prepared.schema')
rep('function costForJob(job) {\n  const body = providerBody(job);', 'function costForJob(job, cache) {\n  const body = providerBody(job, cache);')
rep('const actualEstimate = costForJob(job),', 'const actualEstimate = costForJob(job, room.interpretationCache),')
rep('providerRequestBody: providerBody(job)', 'providerRequestBody: providerBody(job, room.interpretationCache)')
rep("'Exactly four frozen stages are required.'","'Exactly two frozen stages are required.'")
rep("corpus.stages[1].roomKey === corpus.stages[2].roomKey && corpus.stages[2].reusePreviousRoom === true","corpus.stages[0].roomKey === corpus.stages[1].roomKey && corpus.stages[1].reusePreviousRoom === true")
rep("new Set(corpus.stages.map(s => s.roomKey)).size === 3, 'Exactly three fresh policy-pair rooms required.'","new Set(corpus.stages.map(s => s.roomKey)).size === 1, 'Exactly one fresh policy-pair room required.'")
rep("  const corpus = normalizeCorpus(frozenCorpus);","  const lowBytes = await fs.readFile(path.join(DIR, '../low-effort/report.json'));\n  const low = JSON.parse(lowBytes);\n  expect(sha256(lowBytes) === frozenCorpus.lowReportSha256 && low.status === 'stopped-fail-closed' && low.actualReviewPostAttempts === 2, 'Prior two low-effort attempts changed.');\n  const corpus = normalizeCorpus(frozenCorpus);")
rep('priorCompletedRequests: 8, combinedTaskMaximumRequests: 12','priorCompletedRequests: 10, combinedTaskMaximumRequests: 12')
rep("  check(review.provenance === 'meta-model',","  check(isDeepStrictEqual(after.automaticReview?.requestedEditors, stage.expectedRequestedEditors), 'Wrong requested editor set.');\n  check(isDeepStrictEqual(after.automaticReview?.reusedEditors, stage.expectedReusedEditors), 'Wrong reused editor set.');\n  check(review.provenance === 'meta-model',")
rep("'Global four-review POST limit reached.'", "'Global two-review POST limit reached.'")
rep("'Expected exactly four completed review POSTs.'","'Expected exactly two completed review POSTs.'")
(C/'run-reuse.mjs').write_text(s)
(C/'evaluator').mkdir(exist_ok=True);old=json.loads((D/'evaluator-snapshot.json').read_text());snapshot={'kind':'read-only-evaluator-snapshot','files':[]}
for f in old['files']:
 dest=C/f['snapshot'];src=D.parent/'samepage-live/lib'/dest.name;shutil.copyfile(src,dest);b=dest.read_bytes();snapshot['files'].append({'snapshot':f['snapshot'],'source':str(src),'sha256':sha(b),'bytes':len(b)})
write(C/'evaluator-snapshot.json',snapshot)
print(json.dumps({'planSha256':h,'requests':2,'combinedMaximumRequests':12,'previousBudgetMaximum':priorMax}))
