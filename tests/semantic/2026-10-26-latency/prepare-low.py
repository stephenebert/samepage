from pathlib import Path
import json,hashlib,shutil
D=Path(__file__).resolve().parent;L=D/'low-effort';L.mkdir(exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(o):return json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def write(p,o):p.write_text(json.dumps(o,indent=2,ensure_ascii=False)+'\n')
prior=json.loads((D/'report.json').read_text());assert prior['status']=='passed' and prior['actualReviewPostAttempts']==8
parent=json.loads((D/'plan.json').read_text())
stages=parent['stages'][4:];assert len(stages)==4
for stage in stages:stage['reasoningEffort']='low'
plan={'schemaVersion':1,'name':'Paired low reasoning validation on the unchanged held-out policies','priorCompletedRequests':8,'totalTaskRequestLimit':12,'priorReportSha256':sha((D/'report.json').read_bytes()),'priorEstimatedMaximumUsd':prior['preflight']['estimatedMaxUsd'],'stages':stages}
base=canonical(plan);plan['freeze']={'mutableAfterFreeze':False,'algorithm':'SHA-256','providerInputsSha256':sha(canonical([{'id':s['id'],'providerInput':s['providerInput']} for s in stages])),'evaluationsSha256':sha(canonical([{'id':s['id'],'evaluation':s['evaluation']} for s in stages])),'corpusWithoutFreezeSha256':sha(base)}
write(L/'corpus.json',plan);h=sha((L/'corpus.json').read_bytes());write(L/'corpus.freeze.json',{'algorithm':'sha256','sha256':h})
old=D.parent/'samepage-meta-live-evidence';s=(old/'run-live.mjs').read_text()
def rep(a,b):
 global s
 assert a in s,a[:80]
 s=s.replace(a,b)
rep('4202af1610de58a958241c187200f5c740e95b9b70d8868c3eb6fbd0b5d75ecb',h)
rep("reasoning_effort: 'medium'","reasoning_effort: 'low'")
rep("name: 'samepage_studio_review'","name: 'samepage_studio_compact'")
rep("'Server model metadata is not ready automatic Meta muse-spark-1.3; no review may be requested.');","'Server model metadata is not ready automatic Meta muse-spark-1.3; no review may be requested.');\n  expect(model.protocol === 'compact-v2' && model.reasoningEffort === 'low', 'Require compact-v2 with explicit low reasoning.');")
rep("    workflow: { publishEditor: stage.evaluation.approval?.candidateApprovalsAllowed === false ? null : 'alice',\n      ...(['pair1_initial','pair1_correction'].includes(stage.id) ? { receiptScenarioId: 'resident_member_scholarship' } : {}) },","    workflow: stage.workflow,")
rep("  expect(corpus.stages[0].roomKey === corpus.stages[1].roomKey && corpus.stages[1].reusePreviousRoom === true, 'Correction must reuse first room.');","  expect(corpus.stages[1].roomKey === corpus.stages[2].roomKey && corpus.stages[2].reusePreviousRoom === true, 'Correction must reuse fee-priority room.');")
rep("  const corpus = normalizeCorpus(frozenCorpus);","  const priorBytes = await fs.readFile(path.join(DIR, '../report.json'));\n  const prior = JSON.parse(priorBytes);\n  expect(sha256(priorBytes) === frozenCorpus.priorReportSha256 && prior.status === 'passed' && prior.actualReviewPostAttempts === 8, 'Prior eight-review evidence changed or did not pass.');\n  const corpus = normalizeCorpus(frozenCorpus);")
rep("  expect(estimatedMaxUsd <= BUDGET_USD, 'Conservative whole-evaluation estimate exceeds USD 1.');","  expect(estimatedMaxUsd + inputs.corpus.priorEstimatedMaximumUsd <= BUDGET_USD, 'Combined twelve-review estimate exceeds USD 1.');")
rep("maxReviewPostsAcrossAllRooms: MAX_REVIEWS, noAutomaticRetries:","maxReviewPostsAcrossAllRooms: MAX_REVIEWS, priorCompletedRequests: 8, combinedTaskMaximumRequests: 12, combinedEstimatedMaxUsd: estimatedMaxUsd + inputs.corpus.priorEstimatedMaximumUsd, reasoningEffort: 'low', noAutomaticRetries:")
rep("  check(review.provenance === 'meta-model',","  check(after.automaticReview?.protocol === 'compact-v2' && after.automaticReview?.reasoningEffort === 'low', 'Wrong provider request configuration.');\n  check(review.provenance === 'meta-model',")
rep("  room = response.json.room;\n  const quality =","  room = response.json.room;\n  expect(room.automaticReview?.metrics?.requestBytes === actualEstimate.inputWireBytes, 'Hosted provider request bytes differ from reconstruction.');\n  expect(Number.isFinite(room.automaticReview.metrics.providerDurationMs) && room.automaticReview.metrics.providerDurationMs >= 0, 'Invalid provider duration.');\n  const quality =")
rep("evidence.quality = quality;","evidence.quality = quality; evidence.httpDurationMs = response.durationMs; evidence.metrics = room.automaticReview.metrics;")
rep("  const discovery = engine.discoverStudioConsequences(byEditor.alice.rules, byEditor.bob.rules);","  const discovery = engine.discoverStudioConsequences(byEditor.alice.rules, byEditor.bob.rules);\n  for (const [id, delta] of Object.entries(stage.evaluation.expectedFeeDeltasByWitnessId ?? {})) check(discovery.witnesses.find(w => w.id === id)?.feeDeltaCents === delta, `Witness ${id} price delta mismatch.`);")
rep('Hosted review API returns hydrated structured candidates and room state, not raw Meta transport responses or token usage.','Hosted review API returns parsed candidates and bounded token counters when available, not raw Meta envelopes or billed charges.')
rep('Provider delivery/token usage/billed cost are not measured; observed room modelCallCount is an app counter, not a billing receipt.','Numeric provider counters and durations are retained when available; billed cost is not measured. Room modelCallCount is an app counter, not a billing receipt.')
(L/'run-low.mjs').write_text(s)
(L/'evaluator').mkdir(exist_ok=True);oldSnapshot=json.loads((old/'evaluator-snapshot.json').read_text());snapshot={'kind':'read-only-evaluator-snapshot','files':[]}
for f in oldSnapshot['files']:
 dest=L/f['snapshot'];src=D.parent/'samepage-live/lib'/dest.name;shutil.copyfile(src,dest);b=dest.read_bytes();snapshot['files'].append({'snapshot':f['snapshot'],'source':str(src),'sha256':sha(b),'bytes':len(b)})
write(L/'evaluator-snapshot.json',snapshot)
print(json.dumps({'planSha256':h,'requests':4,'combinedMaximumRequests':12}))
