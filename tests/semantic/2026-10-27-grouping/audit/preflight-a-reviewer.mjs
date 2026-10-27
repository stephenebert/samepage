// Read-only independent source interpretation for cross-review of holdout A.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {expectedOutcome} from '../case-a/holdout/independent-oracle.mjs';
const OPEN='2026-12-04T09:00:00.125Z', LATE='2026-12-14T10:30:00.500Z', CLOSE='2026-12-19T18:00:00.875Z';
function reviewedSource(stage,a){
  const {age,guardianConsent:g,resident:r,member:m,student:s,scholarship:h,submittedAt:t}=a;
  // All supplied/reviewer dates are canonical, same-width UTC strings.
  if(t<=OPEN || t>CLOSE)return {accepted:false,feeCents:null};
  let route=false;
  if(age<15)route=false;
  else if(age<20){
    if(g){if(r&&!m)route=true;else if(s&&h)route=true;}
  }else{
    if(stage==='bob' ? m&&s : m&&!s)route=true;
    if(r){if(!h)route=true;else if(s)route=true;}
  }
  if(!route)return {accepted:false,feeCents:null};
  if(t>LATE && !h){
    if(!m)return {accepted:false,feeCents:null};
    if(stage!=='unsafe'&&!g)return {accepted:false,feeCents:null};
  }
  const tiers=[];
  if(stage==='unsafe'||stage==='repaired')tiers.push([s,2100]);
  tiers.push([h&&m,350],[h,900],[age<20,1700],[r&&s,2300],[m,3200],[true,4700]);
  return {accepted:true,feeCents:tiers.find(([applies])=>applies)[1]};
}
const gold=JSON.parse(await fs.readFile(new URL('../case-a/holdout/goldens.json',import.meta.url),'utf8'));
const stages=['alice','bob','unsafe','repaired'];
let goldenChecks=0;
for(const row of gold.explicitAttendees)for(const stage of stages){assert.deepEqual(reviewedSource(stage,row.attendee),row.expected[stage],row.id+'/'+stage);goldenChecks++;}
assert.deepEqual(reviewedSource('alice',gold.beforeAfterAttendee.attendee),gold.beforeAfterAttendee.before);
assert.deepEqual(reviewedSource('repaired',gold.beforeAfterAttendee.attendee),gold.beforeAfterAttendee.after);
const times=new Set(['2026-01-01T00:00:00.000Z','2026-12-10T11:22:33.444Z','2026-12-16T11:22:33.444Z','2027-01-01T00:00:00.000Z']);
for(const text of [OPEN,LATE,CLOSE])for(const delta of [-1,0,1])times.add(new Date(Date.parse(text)+delta).toISOString());
let crossChecks=0;
for(const stage of stages)for(const submittedAt of times)for(let age=0;age<=120;age++)for(let mask=0;mask<32;mask++){
  const a={age,submittedAt,resident:Boolean(mask&1),student:Boolean(mask&2),member:Boolean(mask&4),guardianConsent:Boolean(mask&8),scholarship:Boolean(mask&16)};
  assert.deepEqual(expectedOutcome(stage,a),reviewedSource(stage,a));crossChecks++;
}
console.log(JSON.stringify({status:'pass',goldenChecks,receiptChecks:2,independentOracleCrossChecks:crossChecks,timestamps:times.size,mismatches:0,networkCalls:0}));
