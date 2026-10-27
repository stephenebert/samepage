// Independent source oracle: no application imports, provider calls, or generated rules.
export const SOURCE_BOUNDARIES = Object.freeze([
  '2026-12-04T09:00:00.125Z',
  '2026-12-14T10:30:00.500Z',
  '2026-12-19T18:00:00.875Z',
]);
const [OPEN, LATE, CLOSE] = SOURCE_BOUNDARIES.map(Date.parse);
const STAGES = new Set(['alice', 'bob', 'unsafe', 'repaired']);

export function expectedOutcome(stage, attendee) {
  if (!STAGES.has(stage)) throw Error('Unknown stage: '+stage);
  const {age, resident, student, member, guardianConsent, scholarship, submittedAt} = attendee;
  const time = Date.parse(submittedAt);
  const youth = age >= 15 && age <= 19 && guardianConsent && (
    (resident && !member) || (student && scholarship)
  );
  const adultFirstAlternative = member && (stage === 'bob' ? student : !student);
  const adult = age >= 20 && (adultFirstAlternative || (resident && (!scholarship || student)));
  const lateSatisfied = time <= LATE || scholarship || (
    member && (stage === 'unsafe' || guardianConsent)
  );
  const accepted = time > OPEN && time <= CLOSE && (youth || adult) && lateSatisfied;
  if (!accepted) return {accepted:false, feeCents:null};
  let feeCents;
  if ((stage === 'unsafe' || stage === 'repaired') && student) feeCents = 2100;
  else if (scholarship && member) feeCents = 350;
  else if (scholarship) feeCents = 900;
  else if (age <= 19) feeCents = 1700;
  else if (resident && student) feeCents = 2300;
  else if (member) feeCents = 3200;
  else feeCents = 4700;
  return {accepted:true, feeCents};
}

function collectTimes(value, result, seen = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})/g) ?? []) {
      const instant = Date.parse(match);
      if (Number.isFinite(instant)) result.add(instant);
    }
  } else if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const [key,child] of Object.entries(value)) {collectTimes(key,result,seen);collectTimes(child,result,seen);}
  }
}

export function verificationInstants(rules) {
  const boundaries = new Set(SOURCE_BOUNDARIES.map(Date.parse));
  collectTimes(rules,boundaries);
  const instants = new Set([
    Date.parse('2026-01-01T00:00:00.000Z'),
    Date.parse('2026-12-10T11:22:33.444Z'),
    Date.parse('2026-12-16T11:22:33.444Z'),
    Date.parse('2027-01-01T00:00:00.000Z'),
  ]);
  for (const boundary of boundaries) for (const offset of [-1,0,1]) instants.add(boundary+offset);
  return [...instants].sort((a,b)=>a-b).map(t=>new Date(t).toISOString());
}

export function verifyRules(rules, stage, evaluate) {
  if (!STAGES.has(stage)) throw Error('Unknown stage: '+stage);
  const instants=verificationInstants(rules),mismatches=[];
  let checkedCases=0,mismatchCount=0;
  for(let age=0;age<=120;age++)for(let flags=0;flags<32;flags++)for(const submittedAt of instants){
    const attendee={age,resident:!!(flags&1),student:!!(flags&2),member:!!(flags&4),guardianConsent:!!(flags&8),scholarship:!!(flags&16),submittedAt};
    const expected=expectedOutcome(stage,attendee);
    let actual,evaluationError;
    try{actual=evaluate(rules,attendee);}catch(error){evaluationError=String(error?.message??error);}
    checkedCases++;
    if(evaluationError||actual?.accepted!==expected.accepted||actual?.feeCents!==expected.feeCents){
      mismatchCount++;
      if(mismatches.length<60)mismatches.push({attendee,expected,actual:actual??null,...(evaluationError?{evaluationError}:{})});
    }
  }
  return {ok:mismatchCount===0,checkedCases,mismatchCount,mismatches};
}
