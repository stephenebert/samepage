import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {independentExpected,checkRulesAgainstSource} from './independent-oracle.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const gold=JSON.parse(await fs.readFile(path.join(dir,'goldens.json'),'utf8'));
let manualChecks=0;const oracleChecks=[];
for(const c of gold.cases){
 for(const s of c.testAttendees)for(const phase of ['baseline','repaired','unsafe']){assert.deepEqual(independentExpected(c.id,phase,s.attendee),s.expected[phase],c.id+'/'+s.id+'/'+phase);manualChecks++;}
 for(const [phase,key]of[['baseline','baselineRules'],['repaired','expectedRepairRules'],['unsafe','unsafeRules']]){const check=checkRulesAgainstSource(c.id,phase,c[key]);assert.equal(check.passed,true,JSON.stringify(check));oracleChecks.push(check);}
 const surprise=c.testAttendees.find(s=>s.id===c.unintendedWitnessId);
 assert.notDeepEqual(surprise.expected.repaired,surprise.expected.unsafe);
 const intended=c.testAttendees.find(s=>s.id===c.intendedWitnessId);
 assert.notDeepEqual(intended.expected.baseline,intended.expected.repaired);
}
console.log(JSON.stringify({status:'passed',cases:gold.cases.length,manualAttendees:manualChecks/3,manualPhaseChecks:manualChecks,oracleChecks,totalOracleChecks:oracleChecks.reduce((n,c)=>n+c.checkedCases,0),networkCalls:0},null,2));
