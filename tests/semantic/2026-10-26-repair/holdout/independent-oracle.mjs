// Source-specific oracle. This file imports no application or production evaluator.
// Expected decisions below are direct readings of the frozen source policies.
const A_CLOSE=Date.parse('2033-05-14T18:30:00.000Z');
const B_EARLY=Date.parse('2034-09-01T00:00:00.000Z');
const B_CLOSE=Date.parse('2034-09-07T16:00:00.000Z');
const MIN_TIME=Date.parse('0000-01-01T00:00:00.000Z');
const MAX_TIME=Date.parse('9999-12-31T23:59:59.999Z');
const outcome=fee=>({accepted:fee!==null,feeCents:fee});
export function independentExpected(caseId,phase,a){
 if(!['baseline','repaired','unsafe'].includes(phase))throw Error('Unknown phase');
 const t=Date.parse(a.submittedAt);
 if(caseId==='lumen-archive-workshop'){
  if(a.age<15 || (a.age<18 && !a.guardianConsent && !(phase==='unsafe' && a.scholarship)) || !(a.resident||a.member||a.student||a.age>=25) || t>=A_CLOSE)return outcome(null);
  if(phase!=='baseline'&&a.scholarship)return outcome(0);
  if(a.scholarship&&a.age<=19)return outcome(600);
  if(a.member)return outcome(1100);
  if(a.student)return outcome(1500);
  if(a.resident)return outcome(2100);
  return outcome(2900);
 }
 if(caseId==='orbit-mapping-sprint'){
  if(a.age<16 || (!a.member&&a.age<21) || (a.age<18&&!a.guardianConsent) || t>B_CLOSE)return outcome(null);
  if(phase!=='baseline'&&a.member)return outcome(0);
  if(a.scholarship)return outcome(0);
  if(a.member)return outcome(1400);
  if(a.student&&t<B_EARLY)return outcome(phase==='unsafe'?900:1200);
  if(a.student)return outcome(1800);
  if(a.resident)return outcome(1900);
  return outcome(2600);
 }
 throw Error('Unknown case');
}
export function* oracleAttendees(caseId,extraRules){
 const boundaries=caseId==='lumen-archive-workshop'?[A_CLOSE]:caseId==='orbit-mapping-sprint'?[B_EARLY,B_CLOSE]:null;
 if(!boundaries)throw Error('Unknown case');
 function collect(c){if(c.op==='time')boundaries.push(Date.parse(c.value));else if(c.op==='not')collect(c.arg);else if(c.op==='all'||c.op==='any')c.args.forEach(collect);}
 if(extraRules){collect(extraRules.eligibility);extraRules.fee.overrides.forEach(o=>collect(o.when));}
 const times=[...new Set([MIN_TIME,...boundaries.flatMap(t=>[t-1,t,t+1]).filter(t=>Number.isFinite(t)&&t>=MIN_TIME&&t<=MAX_TIME),MAX_TIME])];
 if(times.length*121*32>2_000_000)throw Error('Independent oracle case limit exceeded; unknown, not a pass');
 for(let age=0;age<=120;age++)for(let bits=0;bits<32;bits++)for(const time of times)yield {age,resident:!!(bits&1),student:!!(bits&2),member:!!(bits&4),guardianConsent:!!(bits&8),scholarship:!!(bits&16),submittedAt:new Date(time).toISOString()};
}
// Separate generic AST interpreter to compare returned/golden rules with the
// source-specific oracle above. It also imports no production evaluator.
function predicate(c,a,t){
 switch(c.op){
  case 'always':return true;
  case 'flag':return a[c.field]===c.value;
  case 'age':if(c.cmp==='gte')return a.age>=c.value;if(c.cmp==='lte')return a.age<=c.value;throw Error('Unknown age op');
  case 'not':return !predicate(c.arg,a,t);
  case 'all':return c.args.every(child=>predicate(child,a,t));
  case 'any':return c.args.some(child=>predicate(child,a,t));
  case 'time':{const b=Date.parse(c.value);if(c.cmp==='lt')return t<b;if(c.cmp==='lte')return t<=b;if(c.cmp==='gt')return t>b;if(c.cmp==='gte')return t>=b;throw Error('Unknown time op');}
  default:throw Error('Unknown predicate');
 }
}
export function independentRuleOutcome(r,a){
 if(!r)throw Error('Missing complete rules');
 const t=Date.parse(a.submittedAt);
 if(!predicate(r.eligibility,a,t))return outcome(null);
 const matched=r.fee.overrides.find(o=>predicate(o.when,a,t));
 return outcome(matched?matched.cents:r.fee.defaultCents);
}
export function checkRulesAgainstSource(caseId,phase,rules){
 let checkedCases=0,mismatchCount=0;const examples=[];
 for(const attendee of oracleAttendees(caseId,rules)){
  const expected=independentExpected(caseId,phase,attendee),actual=independentRuleOutcome(rules,attendee);checkedCases++;
  if(JSON.stringify(expected)!==JSON.stringify(actual)){mismatchCount++;if(examples.length<8)examples.push({attendee,expected,actual});}
 }
 return {caseId,phase,checkedCases,mismatchCount,passed:mismatchCount===0,examples};
}
