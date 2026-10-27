// Source-authored oracle. No application imports or AST assumptions.
const OPEN = Date.parse('2026-11-22T17:30:00.000Z');
const REMOTE_CUTOFF = Date.parse('2026-11-24T10:15:30.250Z');
const CLOSE = Date.parse('2026-11-25T21:00:00.000Z');
const FLAGS = ['resident', 'student', 'member', 'guardianConsent', 'scholarship'];
const STAGES = new Set(['alice', 'bob', 'unsafe', 'repaired']);

export function expectedOutcome(stage, a) {
  if (!STAGES.has(stage)) throw Error(`Unknown stage ${stage}`);
  const t = Date.parse(a.submittedAt);
  if (!(t >= OPEN && t < CLOSE)) return {accepted:false,feeCents:null};
  if (!a.resident && !(stage === 'bob' ? t < REMOTE_CUTOFF : t <= REMOTE_CUTOFF))
    return {accepted:false,feeCents:null};
  let eligible = false;
  if (a.age >= 16 && a.age <= 20)
    eligible = a.guardianConsent && a.resident && a.student && !a.member;
  else if (a.age >= 21)
    eligible = (a.resident && !a.member) || (a.member && (a.student || !a.scholarship));
  if (!eligible) return {accepted:false,feeCents:null};
  if ((stage === 'repaired' || stage === 'unsafe') && a.student)
    return {accepted:true,feeCents:1900};
  let fee = 4600;
  if (a.scholarship) fee = 500;
  else if (a.student && a.member) fee = 1400;
  else if (a.member) fee = stage === 'unsafe' ? 3100 : 2700;
  else if (a.student) fee = 3300;
  return {accepted:true,feeCents:fee};
}

function timesFor(rules) {
  const cuts = new Set([OPEN, REMOTE_CUTOFF, CLOSE]);
  const visited = new WeakSet();
  function scan(x) {
    if (typeof x === 'string') {
      for (const m of x.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g)) {
        const t = Date.parse(m[0]); if (Number.isFinite(t)) cuts.add(t);
      }
    } else if (x && typeof x === 'object' && !visited.has(x)) {
      visited.add(x); for (const v of Object.values(x)) scan(v);
    }
  }
  scan(rules);
  const ordered = [...cuts].sort((a,b)=>a-b);
  const samples = new Set([Date.parse('2026-11-23T12:00:00.000Z'), Date.parse('2026-11-25T12:00:00.000Z')]);
  for (let i=0;i<ordered.length;i++) {
    for (const d of [-1,0,1]) samples.add(ordered[i]+d);
    if(i) samples.add(Math.floor((ordered[i-1]+ordered[i])/2));
  }
  return [...samples].sort((a,b)=>a-b).map(t=>new Date(t).toISOString());
}

export function verifyRules(rules, stage, evaluate) {
  if (!STAGES.has(stage)) throw Error(`Unknown stage ${stage}`);
  let checkedCases=0, mismatchCount=0;
  const mismatches=[];
  for (const submittedAt of timesFor(rules)) for(let age=0;age<=120;age++) for(let mask=0;mask<32;mask++) {
    const a={age,submittedAt}; FLAGS.forEach((flag,i)=>{a[flag]=Boolean(mask & (1<<i));});
    const expected=expectedOutcome(stage,a);
    let actual; try { actual=evaluate(rules,a); } catch(e) {actual={error:String(e?.message??e)};}
    checkedCases++;
    if(actual?.accepted!==expected.accepted || actual?.feeCents!==expected.feeCents) {
      mismatchCount++; if(mismatches.length<100)mismatches.push({attendee:a,expected,actual});
    }
  }
  return {ok:mismatchCount===0,checkedCases,mismatchCount,mismatches};
}
