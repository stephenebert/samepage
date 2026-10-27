from pathlib import Path
import hashlib, json, shutil

D=Path(__file__).resolve().parent
def sha(b): return hashlib.sha256(b).hexdigest()
def canonical(o): return json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def write(p,o): p.write_text(json.dumps(o,indent=2,ensure_ascii=False)+'\n')
cbytes=(D/'corpus.json').read_bytes()
assert sha(cbytes)=='70014e6e704fe7c005ede0e20881874e13814846f778c77568d1be163a8f0e2e'
c=json.loads(cbytes)
old=json.loads((D.parent/'samepage-meta-live-evidence/corpus.json').read_text())
stages=[]
for protocol,prefix in [('full-v1','baseline'),('compact-v2','compact')]:
 for oldid,name in [('pair1_initial','fee'),('pair2_boundary_exception','boundary')]:
  original=next(x for x in old['stages'] if x['id']==oldid)
  stages.append({'id':prefix+'-'+name,'kind':'initial','pairId':prefix+'-'+name,'protocol':protocol,'providerInput':original['providerInput'],'evaluation':original['evaluation'],'workflow':{'publishEditor':'alice'},'comparisonGroup':name,'sourceClassification':'previously frozen matched comparator, not a fresh holdout'})
for src in c['sources']:
 g=next(x for x in c['goldens'] if x['id']==src['id'])
 outcome=[]
 for row in g['scenarios']:
  expected={}
  for editor in ['alice','bob']:
   x=row['expected'][editor]
   expected[editor]=None if x.get('executable') is False else {'accepted':x['accepted'],'feeCents':x['feeCents']}
  outcome.append({'id':row['id'],'purpose':row.get('purpose',''),'attendee':row['attendee'],'expected':expected})
 ev={'expectedRulesByEditor':{e:g['expectedCandidates'][e]['rules'] for e in ['alice','bob']},'outcomeCases':outcome,'discovery':{'status':g['discovery']['status'],'exactWitnessIds':g['discovery']['witnessIdsExactSet']},'approval':{'candidateApprovalsAllowed':g['discovery']['status']!='unresolved'}}
 if 'maxFeeDeltaCentsByWitnessId' in g['discovery']: ev['expectedFeeDeltasByWitnessId']=g['discovery']['maxFeeDeltaCentsByWitnessId']
 flow={'publishEditor':None if g['discovery']['status']=='unresolved' else 'alice'}
 if src['id'] in [c['journey']['initialStage'],c['journey']['correctionStage']]:flow['receiptScenarioId']=next(row['id'] for row in outcome if row['attendee']==c['journey']['attendee'])
 stages.append({'id':src['id'],'kind':src['kind'],'pairId':'holdout-'+src['roomKey'],'protocol':'compact-v2','providerInput':{'en':src['alice']['text'],'es':src['bob']['text']},'evaluation':ev,'workflow':flow,'sourceClassification':'fresh independent holdout'})
plan={'schemaVersion':1,'name':'SamePage compact-v2 bounded matched comparison and fresh holdout','frozenHoldoutSha256':sha(cbytes),'stages':stages}
base=canonical(plan)
plan['freeze']={'mutableAfterFreeze':False,'algorithm':'SHA-256','providerInputsSha256':sha(canonical([{'id':s['id'],'providerInput':s['providerInput']} for s in stages])),'evaluationsSha256':sha(canonical([{'id':s['id'],'evaluation':s['evaluation']} for s in stages])),'corpusWithoutFreezeSha256':sha(base)}
write(D/'plan.json',plan)
h=sha((D/'plan.json').read_bytes());write(D/'plan.freeze.json',{'algorithm':'sha256','sha256':h,'heldoutCorpusSha256':sha(cbytes)})
p=D/'run-evaluation.mjs';s=p.read_text();assert 'PLAN_SHA256_PENDING' in s;s=s.replace('PLAN_SHA256_PENDING',h)
s=s.replace("  const discovery = engine.discoverStudioConsequences(byEditor.alice.rules, byEditor.bob.rules);", "  const discovery = engine.discoverStudioConsequences(byEditor.alice.rules, byEditor.bob.rules);\n  for (const [id, delta] of Object.entries(stage.evaluation.expectedFeeDeltasByWitnessId ?? {})) check(discovery.witnesses.find(w => w.id === id)?.feeDeltaCents === delta, `Witness ${id} price delta differs from frozen expectation.`);")
p.write_text(s)
oldSnapshot=json.loads((D.parent/'samepage-meta-live-evidence/evaluator-snapshot.json').read_text())
(D/'evaluator').mkdir(exist_ok=True)
snapshot={'kind':'read-only-production-evaluator-snapshot','sourceCheckout':str(D.parent/'samepage-live'),'files':[]}
for f in oldSnapshot['files']:
 dest=D/f['snapshot'];src=D.parent/'samepage-live/lib'/dest.name
 shutil.copyfile(src,dest);b=dest.read_bytes();snapshot['files'].append({'snapshot':f['snapshot'],'source':str(src),'sha256':sha(b),'bytes':len(b)})
write(D/'evaluator-snapshot.json',snapshot)
print(json.dumps({'planSha256':h,'stages':len(stages),'maxReviewRequests':8,'freshHoldoutStages':4}))
