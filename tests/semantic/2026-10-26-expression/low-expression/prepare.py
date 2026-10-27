from pathlib import Path
import json,hashlib,shutil
D=Path(__file__).resolve().parent;P=D.parent
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(o):return json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def write(p,o):p.write_text(json.dumps(o,indent=2,ensure_ascii=False)+'\n')
assert not (D/'live-ledger.json').exists(),'Never prepare after live dispatch.'
prior=json.loads((P/'report.json').read_text());ledger=json.loads((P/'live-ledger.json').read_text());parentplan=json.loads((P/'plan.json').read_text())
assert prior['status']=='passed' and prior['actualReviewPostAttempts']==6 and len(ledger['reviewPostAttempts'])==6 and ledger['status']=='completed'
stages=parentplan['stages'][2:];assert len(stages)==4 and all(s['protocol']=='expression-v3' and not s['allowOutputLimit'] for s in stages)
plan={'schemaVersion':1,'name':'Same frozen expression policies with low reasoning','reasoningEffort':'low','maxCompletionTokens':8192,'reuseUnchanged':False,'priorCompletedRequests':6,'combinedRequestLimit':10,'maxReviewPosts':4,'budgetUsd':1,'priorConservativeMaximumUsd':prior['preflight']['estimatedMaxUsd'],'priorReportSha256':sha((P/'report.json').read_bytes()),'priorLedgerSha256':sha((P/'live-ledger.json').read_bytes()),'priorPlanSha256':sha((P/'plan.json').read_bytes()),'holdoutManifestSha256':parentplan['holdoutManifestSha256'],'stages':stages}
raw=canonical(plan);plan['freeze']={'mutableAfterFreeze':False,'algorithm':'SHA-256','providerInputsSha256':sha(canonical([{'id':s['id'],'providerInput':s['providerInput']} for s in stages])),'evaluationsSha256':sha(canonical([{'id':s['id'],'evaluation':s['evaluation']} for s in stages])),'corpusWithoutFreezeSha256':sha(raw)}
write(D/'plan.json',plan);h=sha((D/'plan.json').read_bytes());write(D/'plan.freeze.json',{'algorithm':'sha256','sha256':h})
snapshot=json.loads((P/'evaluator-snapshot.json').read_text());(D/'evaluator').mkdir(exist_ok=True)
for f in snapshot['files']:
 b=(P/f['snapshot']).read_bytes();assert sha(b)==f['sha256'];(D/f['snapshot']).write_bytes(b)
write(D/'evaluator-snapshot.json',snapshot)
s=(P/'run-compiler.mjs').read_text()
def rep(a,b):
 global s
 assert a in s,a[:120]
 s=s.replace(a,b)
rep('817bd242e25dadc62c9a6d37ce8e890436713e35327c00b34d9a465cacb95385',h)
rep('const MAX_REVIEWS = 6;', 'const MAX_REVIEWS = 4;')
rep('const RESERVED_OUTPUT_TOKENS = 12288;', 'const RESERVED_OUTPUT_TOKENS = 8192;')
rep("const BATCH = process.argv.includes('--expression') ? 'expression' : 'baseline';\nconst ACTIVE_PROTOCOL = BATCH === 'baseline' ? 'compact-v2' : 'expression-v3';\nconst ACTIVE_OUTPUT_TOKENS = process.argv.includes('--tokens=12288') ? 12288 : 8192;", "const ACTIVE_PROTOCOL = 'expression-v3';\nconst ACTIVE_OUTPUT_TOKENS = 8192;")
rep("model.reasoningEffort === 'medium' && model.reuseUnchanged === (BATCH === 'baseline')", "model.reasoningEffort === 'low' && model.reuseUnchanged === false")
rep("reasoningEffort:'medium', reuseUnchanged:protocol === 'compact-v2'", "reasoningEffort:'low', reuseUnchanged:false")
rep("reasoning_effort:'medium'", "reasoning_effort:'low'")
rep("after.automaticReview?.reasoningEffort === 'medium'", "after.automaticReview?.reasoningEffort === 'low'")
rep("path.join(DIR,'holdout", "path.join(DIR,'../holdout")
rep("import('./holdout/", "import('../holdout/")
rep("  const frozenCorpus = JSON.parse(bytes.toString('utf8'));", "  const frozenCorpus = JSON.parse(bytes.toString('utf8'));\n  const priorBytes=await fs.readFile(path.join(DIR,'../report.json')),priorLedgerBytes=await fs.readFile(path.join(DIR,'../live-ledger.json')),priorPlanBytes=await fs.readFile(path.join(DIR,'../plan.json'));\n  expect(sha256(priorBytes)===frozenCorpus.priorReportSha256&&sha256(priorLedgerBytes)===frozenCorpus.priorLedgerSha256&&sha256(priorPlanBytes)===frozenCorpus.priorPlanSha256,'Prior completed evidence changed.');\n  const prior=JSON.parse(priorBytes),priorLedger=JSON.parse(priorLedgerBytes),priorPlan=JSON.parse(priorPlanBytes);\n  expect(prior.status==='passed'&&prior.actualReviewPostAttempts===6&&priorLedger.status==='completed'&&priorLedger.reviewPostAttempts.length===6,'Require the previous six completed requests.');\n  exact(frozenCorpus.stages,priorPlan.stages.slice(2),'Extension policies or golden expectations differ from frozen medium expression stages.');")
rep("'Exactly six frozen stages are required.'", "'Exactly four frozen stages are required.'")
start=s.index("  exact(corpus.stages.map(s=>s.protocol)");end=s.index('\n}',start)
s=s[:start]+"  exact(corpus.stages.map(s=>s.protocol),Array(4).fill('expression-v3'),'Only expression-v3 stages are permitted.');\n  expect(corpus.stages.filter(s=>s.reusePreviousRoom).length===1&&corpus.stages[0].roomKey===corpus.stages[1].roomKey&&new Set(corpus.stages.map(s=>s.roomKey)).size===3,'Unexpected correction or room count.');"+s[end:]
rep("  expect(estimatedMaxUsd <= BUDGET_USD, 'Conservative whole-evaluation estimate exceeds USD 1.');", "  expect(estimatedMaxUsd+inputs.corpus.priorConservativeMaximumUsd<=BUDGET_USD,'Combined ten-request conservative estimate exceeds USD1.');")
rep('maxReviewPostsAcrossAllRooms: MAX_REVIEWS,', 'maxReviewPostsAcrossAllRooms: MAX_REVIEWS, priorCompletedRequests:6, combinedRequestLimit:10, combinedConservativeEstimatedMaxUsd:estimatedMaxUsd+inputs.corpus.priorConservativeMaximumUsd, reasoningEffort:\'low\',')
rep('maximum 12288 output tokens reserved for every request','maximum 8192 output tokens reserved for every extension request')
rep("['--live','--baseline','--expression','--tokens=12288']", "['--live']")
rep("'Global six-review POST limit reached.'", "'Global four-review POST limit reached.'")
rep("    expect(BATCH==='baseline'?ledger.reviewPostAttempts.length<2:ledger.reviewPostAttempts.length>=2,'Wrong phase request range.');", "    expect(ledger.reviewPostAttempts.length+6<10,'Combined ten-request limit reached.');")
rep("allowError:stage.allowOutputLimit===true", "allowError:false")
start=s.index('  if (!response.ok) {\n    expect(stage.allowOutputLimit');end=s.index("  expect(response.json.automatic?.status === 'completed'",start)
s=s[:start]+s[end:]
start=s.index('    let existing = null;');end=s.index('    ledger = { schemaVersion:',start)
s=s[:start]+"    await fs.access(path.join(DIR,'live-ledger.json')).then(()=>{throw Error('A durable ledger exists; this extension never resumes or retries.');},error=>{if(error.code!=='ENOENT')throw error;});\n"+s[end:]
rep("    await persistReport();\n    }\n    const rooms = new Map();", "    await persistReport();\n    const rooms = new Map();")
rep("    expect(ledger.reviewPostAttempts.length === (BATCH === 'baseline' ? 2 : MAX_REVIEWS), 'Unexpected completed review POST count.');", "    expect(ledger.reviewPostAttempts.length===MAX_REVIEWS,'Expected exactly four completed extension requests.');")
start=s.index("    lastReport.status = BATCH ===");end=s.index('    lastReport.observedAppModelAttempts',start)
s=s[:start]+"    lastReport.status='passed';lastReport.completedAt=new Date().toISOString();\n    const prior=await loadJson('../report.json');\n    lastReport.latencyComparisons=lastReport.stages.map((s,i)=>({stageId:s.stageId,mediumHttpMs:prior.stages[i+2].httpDurationMs,lowHttpMs:s.httpDurationMs,httpSpeedupFactor:prior.stages[i+2].httpDurationMs/s.httpDurationMs,note:'One sequential sample per effort setting, same model/protocol/source/token limit; no latency distribution or general accuracy claim.'}));\n"+s[end:]
rep("    ledger.status = BATCH === 'baseline' ? 'baseline-completed' : 'completed';", "    ledger.status = 'completed';")
start=s.index('  expect(args.length<=3');end=s.index('  const inputs = await verifyFrozenInputs();',start)
s=s[:start]+"  expect(args.length<=1&&args.every(a=>['--dry-run','--live'].includes(a)),'Use --dry-run or --live only; never credentials in argv.');\n"+s[end:]
rep("  if(BATCH==='baseline' || !args.includes('--live')) await save('preflight.json', preflight);", "  await save('preflight.json',preflight);")
rep("  if(!args.includes('--live')) { let exists=false;", "  { let exists=false;")
rep("'Dry-run will not rewrite preflight after live evaluation began.'", "'An existing ledger forbids restarting this extension or rewriting its preflight.'")
(D/'run-low-expression.mjs').write_text(s)
print(json.dumps({'planSha256':h,'extensionRequests':4,'combinedRequests':10,'priorConservativeMaximumUsd':plan['priorConservativeMaximumUsd']}))
