import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const flag=(field,value=true)=>({op:'flag',field,value});
const age=(cmp,value)=>({op:'age',cmp,value});
const time=(cmp,value)=>({op:'time',cmp,value});
const all=(...args)=>({op:'all',args});
const any=(...args)=>({op:'any',args});
const fee=(when,cents,label)=>({when,cents,label});
const copy=x=>JSON.parse(JSON.stringify(x));
const CASE_A='lumen-archive-workshop';
const CASE_B='orbit-mapping-sprint';
const A_CLOSE='2033-05-14T18:30:00.000Z';
const B_EARLY='2034-09-01T00:00:00.000Z';
const B_CLOSE='2034-09-07T16:00:00.000Z';
const aEn='Lumen Archive is an online archive workshop. Participants must be at least 15 years old. Participants younger than 18 must have guardian consent. Each participant must also be a resident, a member, a student, or at least 25 years old. Registration must be submitted strictly before 2033-05-14T18:30:00.000Z. All admission requirements apply even to scholarship holders. For eligible participants, charge the first matching fee in this order: scholarship holders aged 19 or younger pay $6; members pay $11; students pay $15; residents pay $21; everyone else pays $29. All amounts are USD. These fees do not combine.';
const aEs='Lumen Archive es un taller de archivo en línea. Las personas participantes deben tener al menos 15 años. Las menores de 18 años deben contar con el consentimiento de su tutor. Cada participante también debe ser residente, miembro, estudiante o tener al menos 25 años. La inscripción debe enviarse estrictamente antes de 2033-05-14T18:30:00.000Z. Todos los requisitos de admisión se aplican también a quienes tienen una beca. Para las personas admitidas, se cobra la primera tarifa aplicable en este orden: quienes tienen una beca y 19 años o menos pagan 6 USD; los miembros pagan 11 USD; los estudiantes pagan 15 USD; los residentes pagan 21 USD; todas las demás personas pagan 29 USD. Las tarifas no se combinan.';
const aRewriteEn='Lumen Archive is an online archive workshop. Participants must be at least 15 years old. Participants younger than 18 must have guardian consent unless they hold a scholarship. Each participant must also be a resident, a member, a student, or at least 25 years old. Registration must be submitted strictly before 2033-05-14T18:30:00.000Z. For eligible participants, charge the first matching fee in this order: all scholarship holders pay $0 regardless of age; members pay $11; students pay $15; residents pay $21; everyone else pays $29. All amounts are USD. These fees do not combine.';
const aRewriteEs='Lumen Archive es un taller de archivo en línea. Las personas participantes deben tener al menos 15 años. Las menores de 18 años deben contar con el consentimiento de su tutor, salvo que tengan una beca. Cada participante también debe ser residente, miembro, estudiante o tener al menos 25 años. La inscripción debe enviarse estrictamente antes de 2033-05-14T18:30:00.000Z. Para las personas admitidas, se cobra la primera tarifa aplicable en este orden: todas las personas con beca pagan 0 USD, independientemente de su edad; los miembros pagan 11 USD; los estudiantes pagan 15 USD; los residentes pagan 21 USD; todas las demás personas pagan 29 USD. Las tarifas no se combinan.';
const bEn='Orbit Atlas is a remote mapping sprint. Participants must be at least 16 years old. Nonmembers must be at least 21 years old. Every participant younger than 18 must have guardian consent. Registration is accepted through 2034-09-07T16:00:00.000Z, including that exact instant, and is closed afterward. None of the fee categories waives any admission requirement. Eligible participants pay the first matching fee in this order: scholarship holders pay $0; members pay $14; students whose registration is submitted strictly before 2034-09-01T00:00:00.000Z pay $12; all other students pay $18; residents pay $19; everyone else pays $26. All amounts are USD. Categories may overlap, but fees never combine.';
const bEs='Orbit Atlas es un encuentro de cartografía a distancia. Las personas participantes deben tener al menos 16 años. Quienes no son miembros deben tener al menos 21 años. Toda persona menor de 18 años debe contar con el consentimiento de su tutor. Se aceptan inscripciones hasta 2034-09-07T16:00:00.000Z, incluido ese instante exacto, y después se cierran. Ninguna categoría de tarifa exime de los requisitos de admisión. Las personas admitidas pagan la primera tarifa aplicable en este orden: quienes tienen una beca pagan 0 USD; los miembros pagan 14 USD; los estudiantes cuya inscripción se envíe estrictamente antes de 2034-09-01T00:00:00.000Z pagan 12 USD; los demás estudiantes pagan 18 USD; los residentes pagan 19 USD; todas las demás personas pagan 26 USD. Las categorías pueden coincidir, pero las tarifas nunca se combinan.';
const bRewriteEn='Orbit Atlas is a remote mapping sprint. Participants must be at least 16 years old. Nonmembers must be at least 21 years old. Every participant younger than 18 must have guardian consent. Registration is accepted through 2034-09-07T16:00:00.000Z, including that exact instant, and is closed afterward. None of the fee categories waives any admission requirement. Eligible participants pay the first matching fee in this order: members pay $0; scholarship holders pay $0; students whose registration is submitted strictly before 2034-09-01T00:00:00.000Z pay $9; all other students pay $18; residents pay $19; everyone else pays $26. All amounts are USD. Categories may overlap, but fees never combine.';
const bRewriteEs='Orbit Atlas es un encuentro de cartografía a distancia. Las personas participantes deben tener al menos 16 años. Quienes no son miembros deben tener al menos 21 años. Toda persona menor de 18 años debe contar con el consentimiento de su tutor. Se aceptan inscripciones hasta 2034-09-07T16:00:00.000Z, incluido ese instante exacto, y después se cierran. Ninguna categoría de tarifa exime de los requisitos de admisión. Las personas admitidas pagan la primera tarifa aplicable en este orden: los miembros pagan 0 USD; quienes tienen una beca pagan 0 USD; los estudiantes cuya inscripción se envíe estrictamente antes de 2034-09-01T00:00:00.000Z pagan 9 USD; los demás estudiantes pagan 18 USD; los residentes pagan 19 USD; todas las demás personas pagan 26 USD. Las categorías pueden coincidir, pero las tarifas nunca se combinan.';
const aRules={eligibility:all(age('gte',15),any(age('gte',18),flag('guardianConsent')),any(flag('resident'),flag('member'),flag('student'),age('gte',25)),time('lt',A_CLOSE)),fee:{currency:'USD',defaultCents:2900,overrides:[fee(all(flag('scholarship'),age('lte',19)),600,'Scholarship through age 19'),fee(flag('member'),1100,'Member'),fee(flag('student'),1500,'Student'),fee(flag('resident'),2100,'Resident')]}};
const bRules={eligibility:all(age('gte',16),any(flag('member'),age('gte',21)),any(age('gte',18),flag('guardianConsent')),time('lte',B_CLOSE)),fee:{currency:'USD',defaultCents:2600,overrides:[fee(flag('scholarship'),0,'Scholarship'),fee(flag('member'),1400,'Member'),fee(all(flag('student'),time('lt',B_EARLY)),1200,'Student before early boundary'),fee(flag('student'),1800,'Student'),fee(flag('resident'),1900,'Resident')]}};
const desired=(base,scope)=>{const r=copy(base);r.fee.overrides.unshift(fee(flag(scope),0,scope+' requested rate'));return r;};
const aExpected=desired(aRules,'scholarship'),bExpected=desired(bRules,'member');
const aUnsafe=copy(aExpected);aUnsafe.eligibility.args[1].args.push(flag('scholarship'));aUnsafe.fee.overrides.splice(1,1);
const bUnsafe=copy(bExpected);bUnsafe.fee.overrides[3].cents=900;bUnsafe.fee.overrides.splice(2,1);
const da={age:22,resident:false,student:false,member:false,guardianConsent:false,scholarship:false,submittedAt:'2033-05-13T12:00:00.000Z'};
const db={age:21,resident:false,student:false,member:false,guardianConsent:false,scholarship:false,submittedAt:'2034-08-31T12:00:00.000Z'};
const outcome=cents=>({accepted:cents!==null,feeCents:cents});
const row=(id,note,def,facts,fees)=>({id,note,attendee:{...def,...facts},expected:{baseline:outcome(fees[0]),repaired:outcome(fees[1]),unsafe:outcome(fees[2])}});
const A=(id,note,facts,fees)=>row(id,note,da,facts,fees);
const B=(id,note,facts,fees)=>row(id,note,db,facts,fees);
const aTests=[
A('a01','Minimum age still excludes a 14-year-old scholarship holder with consent',{age:14,resident:true,scholarship:true,guardianConsent:true},[null,null,null]),
A('a02','Unsafe wording newly admits a 15-year-old scholarship holder without consent',{age:15,resident:true,scholarship:true},[null,null,0]),
A('a03','Unsafe wording newly admits a 17-year-old scholarship member without consent',{age:17,member:true,scholarship:true},[null,null,0]),
A('a04','A student without scholarship still requires youth consent',{age:17,student:true},[null,null,null]),
A('a05','Eligible young scholarship resident receives intended waiver',{age:15,resident:true,scholarship:true,guardianConsent:true},[600,0,0]),
A('a06','Age 19 includes original scholarship rate',{age:19,resident:true,scholarship:true},[600,0,0]),
A('a07','Age 20 falls outside old scholarship rate but inside requested waiver',{age:20,resident:true,scholarship:true},[2100,0,0]),
A('a08','Older outsider scholarship holder is eligible and receives waiver',{age:27,scholarship:true},[2900,0,0]),
A('a09','Scholarship never waives the resident/member/student/age access requirement',{age:24,scholarship:true},[null,null,null]),
A('a10','Age 25 opens outsider access without changing ordinary fee',{age:25},[2900,2900,2900]),
A('a11','Age 25 outsider scholarship waiver',{age:25,scholarship:true},[2900,0,0]),
A('a12','Membership outranks simultaneous student and residency fees',{age:18,member:true,student:true,resident:true},[1100,1100,1100]),
A('a13','Student outranks resident fee',{age:18,student:true,resident:true},[1500,1500,1500]),
A('a14','Resident fee outside target group unchanged',{age:18,resident:true},[2100,2100,2100]),
A('a15','Adult outsider below 25 remains ineligible',{age:18},[null,null,null]),
A('a16','Original young scholarship rate outranks membership',{age:18,member:true,scholarship:true},[600,0,0]),
A('a17','Adult scholarship member gets intended waiver of member fee',{age:20,member:true,scholarship:true},[1100,0,0]),
A('a18','Scholarship priority over student fee at age 19',{age:19,student:true,scholarship:true},[600,0,0]),
A('a19','One millisecond before exclusive deadline remains eligible',{age:22,student:true,scholarship:true,submittedAt:'2033-05-14T18:29:59.999Z'},[1500,0,0]),
A('a20','Exact exclusive deadline remains closed',{age:22,student:true,scholarship:true,submittedAt:A_CLOSE},[null,null,null]),
A('a21','One millisecond after deadline remains closed',{age:22,student:true,scholarship:true,submittedAt:'2033-05-14T18:30:00.001Z'},[null,null,null]),
A('a22','Unsafe consent exception still does not waive deadline',{age:17,resident:true,scholarship:true,submittedAt:A_CLOSE},[null,null,null]),
A('a23','Upper supported age scholarship fee repair',{age:120,scholarship:true},[2900,0,0]),
A('a24','Lower supported age rejected despite category and consent',{age:0,member:true,scholarship:true,guardianConsent:true},[null,null,null]),
A('a25','Non-scholarship resident minor without consent remains denied',{age:17,resident:true},[null,null,null]),
A('a26','Consenting non-scholarship minor member fee unchanged',{age:17,member:true,guardianConsent:true},[1100,1100,1100]),
A('a27','Adult boundary removes consent need',{age:18,member:true},[1100,1100,1100]),
A('a28','Minimum-age consenting student without scholarship retains rate',{age:15,student:true,guardianConsent:true},[1500,1500,1500])];
const bTests=[
B('b01','Age floor cannot be waived by membership or consent',{age:15,member:true,guardianConsent:true},[null,null,null]),
B('b02','Minor member without consent remains ineligible',{age:16,member:true},[null,null,null]),
B('b03','Minimum-age consenting member receives intended waiver',{age:16,member:true,guardianConsent:true},[1400,0,0]),
B('b04','Already-free member scholarship recipient remains free',{age:17,member:true,scholarship:true,guardianConsent:true},[0,0,0]),
B('b05','Scholarship and member fees cannot waive consent',{age:17,member:true,scholarship:true},[null,null,null]),
B('b06','Adult member no longer needs consent',{age:18,member:true},[1400,0,0]),
B('b07','Nonmember age floor persists despite student, resident, consent',{age:20,student:true,resident:true,guardianConsent:true},[null,null,null]),
B('b08','Unsafe rewrite discounts an unrelated nonmember student',{student:true},[1200,1200,900]),
B('b09','One millisecond before early boundary uses early student fee',{student:true,submittedAt:'2034-08-31T23:59:59.999Z'},[1200,1200,900]),
B('b10','Exact exclusive early boundary uses ordinary student fee',{student:true,submittedAt:B_EARLY},[1800,1800,1800]),
B('b11','One millisecond after early boundary unchanged',{student:true,submittedAt:'2034-09-01T00:00:00.001Z'},[1800,1800,1800]),
B('b12','Nonmember scholarship fee outranks early student fee',{student:true,scholarship:true},[0,0,0]),
B('b13','Member and scholarship overlap remains free',{member:true,student:true,scholarship:true},[0,0,0]),
B('b14','Member fee precedence before early student discount',{member:true,student:true},[1400,0,0]),
B('b15','Unrelated resident fee unchanged',{resident:true},[1900,1900,1900]),
B('b16','Unrelated standard fee unchanged',{},[2600,2600,2600]),
B('b17','Membership permits age 20 and repair waives fee',{age:20,member:true,submittedAt:'2034-09-07T15:59:59.999Z'},[1400,0,0]),
B('b18','Exact inclusive closing instant admits ordinary student',{student:true,submittedAt:B_CLOSE},[1800,1800,1800]),
B('b19','Exact inclusive closing instant admits member with repaired fee',{member:true,submittedAt:B_CLOSE},[1400,0,0]),
B('b20','One millisecond after closing rejects member',{member:true,submittedAt:'2034-09-07T16:00:00.001Z'},[null,null,null]),
B('b21','One millisecond after closing rejects nonmember student',{student:true,submittedAt:'2034-09-07T16:00:00.001Z'},[null,null,null]),
B('b22','Upper age student/resident overlap still follows student fee',{age:120,student:true,resident:true},[1200,1200,900]),
B('b23','Lower supported age fails despite all fee waivers',{age:0,member:true,scholarship:true,guardianConsent:true},[null,null,null]),
B('b24','Consent flag does not change nonmember adult student fee',{student:true,guardianConsent:true},[1200,1200,900]),
B('b25','Ordinary student rate still outranks resident rate',{student:true,resident:true,submittedAt:'2034-09-02T00:00:00.000Z'},[1800,1800,1800]),
B('b26','Late member/resident overlap receives intended waiver',{member:true,resident:true,submittedAt:'2034-09-02T00:00:00.000Z'},[1400,0,0]),
B('b27','Residency does not waive nonmember age requirement',{age:18,resident:true},[null,null,null]),
B('b28','Nonmember adult scholarship holder remains free',{scholarship:true},[0,0,0])];
const providerInputs={schemaVersion:1,description:'Synthetic policies and proposed rewrites. No expected rules or verdicts are included in this provider-input file.',cases:[{id:CASE_A,title:'Lumen Archive online workshop',sourceTexts:{en:aEn,es:aEs},intent:{scopeFlag:'scholarship',feeCents:0},proposalText:{en:aRewriteEn,es:aRewriteEs}},{id:CASE_B,title:'Orbit Atlas remote mapping sprint',sourceTexts:{en:bEn,es:bEs},intent:{scopeFlag:'member',feeCents:0},proposalText:{en:bRewriteEn,es:bRewriteEs}}]};
const goldens={schemaVersion:1,expectedOnlyNeverSendToProvider:true,authoredBy:'independent Codex repair_holdout agent',cases:[{id:CASE_A,baselineRules:aRules,expectedRepairRules:aExpected,unsafeRules:aUnsafe,intendedWitnessId:'a07',unintendedWitnessId:'a02',expectedImpact:'blocked',failureKind:'admission broadened for scholarship minors without consent',testAttendees:aTests},{id:CASE_B,baselineRules:bRules,expectedRepairRules:bExpected,unsafeRules:bUnsafe,intendedWitnessId:'b03',unintendedWitnessId:'b08',expectedImpact:'blocked',failureKind:'fee changed for nonmember early students outside requested group',testAttendees:bTests}]};
for(const [name,data] of [['provider-inputs.json',providerInputs],['goldens.json',goldens]])await fs.writeFile(path.join(dir,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:2,manualAttendees:aTests.length+bTests.length,manualPhaseOutcomes:(aTests.length+bTests.length)*3}));
