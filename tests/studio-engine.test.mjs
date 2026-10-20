import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverStudioConsequences, evaluateStudioPolicy, parseStudioRules, parseStudioAttendee } from '../lib/studio-engine.ts';
const always = { op:'always' };
const age = (cmp,value) => ({op:'age',cmp,value});
const flag = (field,value=true) => ({op:'flag',field,value});
const all = (...args) => ({op:'all',args});
const any = (...args) => ({op:'any',args});
const not = arg => ({op:'not',arg});
const time = (cmp,value) => ({op:'time',cmp,value});
const policy = (eligibility=always,overrides=[],defaultCents=8000) => ({eligibility,fee:{currency:'USD',defaultCents,overrides}});
const person = (patch={}) => ({age:24,resident:false,student:false,member:false,guardianConsent:false,scholarship:false,submittedAt:'2026-10-26T12:00:00.000Z',...patch});
const price = (when,cents,label='Fee exception') => ({when,cents,label});

test('nested youth consent and scholarship fee exception do not bypass admission',()=>{
  const r=policy(all(age('gte',16),any(age('gte',18),flag('guardianConsent'))),[price(all(age('lte',17),flag('scholarship')),0)]);
  for(const [input,accepted,fee] of [[{age:15,scholarship:true,guardianConsent:true},false,null],[{age:17,scholarship:true},false,null],[{age:17,scholarship:true,guardianConsent:true},true,0],[{age:24,scholarship:true},true,8000]]) {
    const d=evaluateStudioPolicy(r,person(input));assert.equal(d.accepted,accepted);assert.equal(d.feeCents,fee);assert.ok(d.trace.every(t=>t.en&&t.es));
  }
});
test('negative flags and NOT scope differ from negating the whole group',()=>{
 const left=policy(all(not(flag('resident')),not(flag('student'))));
 const right=policy(not(all(flag('resident'),flag('student'))));
 assert.equal(evaluateStudioPolicy(left,person({resident:true})).accepted,false);
 assert.equal(evaluateStudioPolicy(right,person({resident:true})).accepted,true);
 assert.equal(evaluateStudioPolicy(policy(flag('resident',false)),person()).accepted,true);
 const d=discoverStudioConsequences(left,right); assert.deepEqual(d.witnesses.map(w=>w.kind),['admission-right']);
});
test('inclusive age range and lower/upper UTC milliseconds hold exact endpoints',()=>{
 const r=policy(all(age('gte',16),age('lte',25),time('gte','2026-10-26T10:00:00.000Z'),time('lt','2026-10-26T12:00:00.000Z')));
 for(const [a,t,expected] of [[16,'2026-10-26T10:00:00.000Z',true],[25,'2026-10-26T11:59:59.999Z',true],[15,'2026-10-26T11:00:00.000Z',false],[26,'2026-10-26T11:00:00.000Z',false],[18,'2026-10-26T09:59:59.999Z',false],[18,'2026-10-26T12:00:00.000Z',false]]) assert.equal(evaluateStudioPolicy(r,person({age:a,submittedAt:t})).accepted,expected);
});
test('fee overrides execute first matching rule, including zero; no stacking',()=>{
 const early=time('lte','2026-10-26T12:00:00.000Z');
 const a=policy(always,[price(flag('scholarship'),0,'Scholarship'),price(early,2500,'Early bird')]);
 const b=policy(always,[price(early,2500,'Early bird'),price(flag('scholarship'),0,'Scholarship')]);
 assert.equal(evaluateStudioPolicy(a,person({scholarship:true})).feeCents,0);
 assert.equal(evaluateStudioPolicy(b,person({scholarship:true})).feeCents,2500);
 assert.match(evaluateStudioPolicy(a,person({scholarship:true})).feeReason.en,/Scholarship/);
 assert.equal(evaluateStudioPolicy(a,person({submittedAt:'2026-10-26T12:00:00.001Z'})).feeCents,8000);
});
test('price-only disagreement catches an adult scholarship without inventing an admission conflict',()=>{
 const eligibility=all(age('gte',16),any(age('gte',18),flag('guardianConsent')));
 const left=policy(eligibility,[price(all(age('lte',17),flag('scholarship')),0)]),right=policy(eligibility,[price(flag('scholarship'),0)]);
 const d=discoverStudioConsequences(left,right);assert.equal(d.status,'different');assert.equal(d.witnesses.length,1);
 const w=d.witnesses[0];assert.equal(w.kind,'price-only');assert.equal(w.id,'price-left-higher');assert.equal(w.feeDeltaCents,8000);assert.ok(w.attendee.age>=18);assert.ok(w.attendee.scholarship);
 assert.deepEqual(w.left,evaluateStudioPolicy(left,w.attendee));assert.deepEqual(w.right,evaluateStudioPolicy(right,w.attendee));
});
test('price witnesses retain both directions and maximum delta for each direction',()=>{
 const left=policy(always,[price(flag('student'),1000),price(flag('member'),6000)]);
 const right=policy(always,[price(flag('member'),0),price(flag('student'),5000)]);
 const d=discoverStudioConsequences(left,right), byId=Object.fromEntries(d.witnesses.map(w=>[w.id,w]));
 assert.equal(byId['price-left-higher'].feeDeltaCents,6000);assert.equal(byId['price-right-higher'].feeDeltaCents,4000);
 assert.equal(d.witnesses.length,2);assert.ok(d.witnesses.every(w=>w.left.accepted&&w.right.accepted));
});
test('partition discovery agrees with an independently exhaustive age/flag/boundary oracle',()=>{
 const boundary='2027-03-14T23:59:59.640Z';
 const left=policy(all(any(all(age('gte',17),age('lte',42)),flag('member')),time('lte',boundary)),[price(all(flag('student'),not(flag('scholarship'))),1450),price(flag('resident'),4000)]);
 const right=policy(all(any(all(age('gte',18),age('lte',43)),flag('member')),time('lt',boundary)),[price(flag('scholarship'),0),price(flag('resident'),3500)]);
 const d=discoverStudioConsequences(left,right), expected=new Map();
 // The oracle expresses these policies directly, without invoking the engine.
 for(let age=0;age<=120;age++)for(let bits=0;bits<32;bits++)for(const dt of [-1,0,1]){
   const resident=!!(bits&1),student=!!(bits&2),member=!!(bits&4),scholarship=!!(bits&16);
   const a=(((age>=17&&age<=42)||member)&&dt<=0)?(student&&!scholarship?1450:resident?4000:8000):null;
   const b=(((age>=18&&age<=43)||member)&&dt<0)?(scholarship?0:resident?3500:8000):null;
   const id=a!==null&&b===null?'admission-left':a===null&&b!==null?'admission-right':a!==null&&b!==null&&a!==b?(a>b?'price-left-higher':'price-right-higher'):null;
   if(id)expected.set(id,Math.max(expected.get(id)||0,a!==null&&b!==null?Math.abs(a-b):0));
 }
 assert.deepEqual(d.witnesses.map(w=>w.id).sort(),[...expected.keys()].sort());
 for(const w of d.witnesses)if(w.kind==='price-only')assert.equal(w.feeDeltaCents,expected.get(w.id));
 assert.equal(d.checkedCases,d.coverage.agePartitions*32*d.coverage.timePartitions);
});
test('De Morgan equivalent policies do not produce fake differences',()=>{
 const a=policy(not(any(flag('resident'),flag('student'))));const b=policy(all(flag('resident',false),flag('student',false)));
 const d=discoverStudioConsequences(a,b);assert.equal(d.status,'equivalent');assert.equal(d.witnesses.length,0);assert.ok(d.checkedCases>0);assert.match(d.coverage.scope,/does not prove/);
});
test('bounded or unresolved search never claims equivalence',()=>{
 assert.equal(discoverStudioConsequences(policy(),null).status,'unresolved');
 const d=discoverStudioConsequences(policy(),policy(),1);assert.equal(d.status,'unresolved');assert.equal(d.checkedCases,0);assert.match(d.issues[0],/equivalence is unknown/);
});
test('strict schemas reject unsupported attributes, code, impossible dates and oversized rules',()=>{
 for(const r of [policy({op:'javascript',source:'true'}),policy(flag('veteran')),policy(time('lt','2026-02-30T10:00:00Z')),policy(always,[],1.1),{...policy(),code:'approve()'},policy({op:'all',args:[]}),policy(always,[{when:always,cents:0,label:'x',priority:1}])])assert.throws(()=>parseStudioRules(r));
 let c=always;for(let i=0;i<9;i++)c=not(c);assert.throws(()=>parseStudioRules(policy(c)),/limit/);
 assert.throws(()=>parseStudioRules(policy(all(...Array.from({length:16},()=>all(...Array.from({length:16},()=>always)))))),/limit/);
 assert.throws(()=>parseStudioAttendee({...person(),veteran:true}),/unexpected/);
});
