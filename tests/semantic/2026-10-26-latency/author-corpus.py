"""Fresh synthetic holdout authoring. No production imports or remote calls.

The expected tuples below are authored explicitly, not obtained from a model
or the production interpreter. verify-corpus.py checks them independently.
"""
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent

def flag(field, value=True): return {"op": "flag", "field": field, "value": value}
def age(cmp, value): return {"op": "age", "cmp": cmp, "value": value}
def time(cmp, value): return {"op": "time", "cmp": cmp, "value": value}
def allof(*args): return {"op": "all", "args": list(args)}
def anyof(*args): return {"op": "any", "args": list(args)}
def neg(arg): return {"op": "not", "arg": arg}
def price(when, cents, label): return {"when": when, "cents": cents, "label": label}
def rules(eligibility, default, overrides):
    return {"eligibility": eligibility, "fee": {"currency": "USD", "defaultCents": default, "overrides": overrides}}

CUTOFF = "2031-11-02T01:30:00.000Z"
START = "2032-02-29T09:00:00.000Z"
END = "2032-03-01T09:00:00.000Z"
BEFORE = "2031-11-02T01:29:59.999Z"
NOON = "2032-02-29T12:00:00.000Z"

sources = [
    {
        "id": "lantern-nested-utc", "sequence": 1, "kind": "fresh-pair", "roomKey": "lantern",
        "title": "Paper-lantern workshop: youth exception and exact UTC cutoff",
        "alice": {"language": "en", "text": "Paper-lantern workshop. Only people aged 14 through 65, inclusive, may attend. Someone who is neither a resident nor a student is excluded unless they are a member. A person under 18 is excluded if they lack guardian consent; this youth exclusion alone does not apply when the person is both a resident and a scholarship recipient. A scholarship does not waive the age range or the resident/student/member requirement. Registration must be submitted strictly before 2031-11-02T01:30:00.000Z; the exact stated instant is too late. All prices are in USD and apply only after admission. Charge the first applicable price in this order: scholarship recipient, $0; member, $17; otherwise, $48. Prices do not stack. There are no other eligibility conditions or deadlines."},
        "bob": {"language": "es", "text": "Taller de farolillos de papel. Solo pueden participar personas de 14 a 65 años, ambos extremos incluidos. Quien no sea ni residente ni estudiante queda excluido, salvo que sea miembro. También queda excluida una persona menor de 18 años que no tenga consentimiento del tutor; esta exclusión de menores, y solo esta, no se aplica a quien sea residente y tenga una beca a la vez. Una beca no elimina el intervalo de edad ni el requisito de ser residente, estudiante o miembro. La inscripción debe enviarse antes de 2031-11-02T01:30:00.000Z o exactamente en ese instante; el instante indicado sí se acepta. Todos los precios son en USD y solo se aplican después de admitir a la persona. Se cobra el primer precio aplicable en este orden: persona con beca, $0; miembro, $17; en cualquier otro caso, $48. Los precios no se acumulan. No existen otras condiciones de admisión ni otros plazos."},
    },
    {
        "id": "mosaic-priority", "sequence": 2, "kind": "fresh-pair", "roomKey": "mosaic",
        "title": "Mosaic club: conflicting fee precedence with two price directions",
        "alice": {"language": "en", "text": "Mosaic club session. Admission requires age 16 through 80 inclusive and at least one of resident, student, or member status. Anyone under 18 must also have guardian consent; adults do not need it. Registration must be submitted at or after 2032-02-29T09:00:00.000Z and strictly before 2032-03-01T09:00:00.000Z. For admitted participants, select the first matching rule in the following priority order and stop: a member who has guardian consent pays $9 USD; otherwise a resident pays $16 USD; otherwise a student pays $14 USD; otherwise a scholarship recipient pays $0 USD; otherwise the price is $31 USD. Scholarship status never overrides an earlier matching price and never waives admission requirements. Do not combine prices. There are no other eligibility conditions or deadlines."},
        "bob": {"language": "es", "text": "Sesión del club de mosaicos. Para ser admitida, una persona debe tener entre 16 y 80 años, ambos incluidos, y ser residente, estudiante o miembro, con al menos una de esas condiciones. Si tiene menos de 18 años, además necesita consentimiento del tutor; las personas adultas no lo necesitan. La inscripción se admite desde 2032-02-29T09:00:00.000Z, incluido ese instante, hasta antes de 2032-03-01T09:00:00.000Z, excluido ese último instante. Para una persona admitida se usa únicamente la primera regla que corresponda, con esta prioridad: si tiene beca, $0 USD; en su defecto, si es estudiante, $14 USD; en su defecto, si es miembro y tiene consentimiento del tutor, $9 USD; en su defecto, si es residente, $16 USD; en cualquier otro caso, $31 USD. La beca no elimina los requisitos de admisión. No se combinan precios. No hay otras condiciones de admisión ni otros plazos."},
    },
    {
        "id": "mosaic-corrected", "sequence": 3, "kind": "correction", "roomKey": "mosaic",
        "corrects": "mosaic-priority", "changedEditors": ["alice"],
        "title": "Mosaic correction: equivalent independently phrased priority",
        "alice": {"language": "en", "text": "Mosaic club session. A participant is eligible exactly when their age is at least 16 and at most 80, they are not someone who is none of a resident, a student, and a member, and they are either at least 18 or have guardian consent. The submission instant must be no earlier than 2032-02-29T09:00:00.000Z and earlier than 2032-03-01T09:00:00.000Z; the opening instant is included and the closing instant is excluded. Apply fees only to admitted participants. A scholarship recipient pays nothing. Among people without a scholarship, every student pays $14 USD. Among the remaining people, members with guardian consent pay $9 USD; after that, remaining residents pay $16 USD; anyone still unmatched pays $31 USD. Each person receives only the first applicable price in that order. A scholarship does not waive any admission requirement. No other eligibility conditions or deadlines apply."},
        "bob": {"language": "es", "text": "Sesión del club de mosaicos. Para ser admitida, una persona debe tener entre 16 y 80 años, ambos incluidos, y ser residente, estudiante o miembro, con al menos una de esas condiciones. Si tiene menos de 18 años, además necesita consentimiento del tutor; las personas adultas no lo necesitan. La inscripción se admite desde 2032-02-29T09:00:00.000Z, incluido ese instante, hasta antes de 2032-03-01T09:00:00.000Z, excluido ese último instante. Para una persona admitida se usa únicamente la primera regla que corresponda, con esta prioridad: si tiene beca, $0 USD; en su defecto, si es estudiante, $14 USD; en su defecto, si es miembro y tiene consentimiento del tutor, $9 USD; en su defecto, si es residente, $16 USD; en cualquier otro caso, $31 USD. La beca no elimina los requisitos de admisión. No se combinan precios. No hay otras condiciones de admisión ni otros plazos."},
    },
    {
        "id": "watercolor-overlap", "sequence": 4, "kind": "fresh-pair", "roomKey": "watercolor",
        "title": "Watercolor circle: overlapping fees without a priority",
        "alice": {"language": "en", "text": "Watercolor circle. Admission is open exactly to people aged 18 through 72 inclusive who are residents or members, or both. Registration has no deadline. The standard admission price is $46 USD. Residents pay $14 USD. Students pay $7 USD. Scholarship recipients pay $0 USD. These are alternative whole prices, not amounts to add or subtract. There are no other eligibility conditions."},
        "bob": {"language": "es", "text": "Círculo de acuarela. Pueden participar exactamente las personas de 18 a 72 años, ambos inclusive, que sean residentes o miembros, o las dos cosas. La inscripción no tiene fecha límite. El precio normal de entrada es $46 USD. Las personas residentes pagan $14 USD. Las personas estudiantes pagan $7 USD. Las personas con beca pagan $0 USD. Son precios totales alternativos, no cantidades que se sumen o resten. No hay otras condiciones de admisión."},
    },
]

lantern_base = [
    age("gte", 14), age("lte", 65),
    neg(allof(neg(flag("resident")), neg(flag("student")), neg(flag("member")))),
    neg(allof(age("lte", 17), flag("guardianConsent", False), neg(allof(flag("resident"), flag("scholarship"))))),
]
lantern_a = rules(allof(*lantern_base, time("lt", CUTOFF)), 4800, [price(flag("scholarship"), 0, "scholarship first"), price(flag("member"), 1700, "member second")])
lantern_b = rules(allof(*lantern_base, time("lte", CUTOFF)), 4800, [price(flag("scholarship"), 0, "scholarship first"), price(flag("member"), 1700, "member second")])
mosaic_eligible = allof(age("gte", 16), age("lte", 80), anyof(flag("resident"), flag("student"), flag("member")), anyof(age("gte", 18), flag("guardianConsent")), time("gte", START), time("lt", END))
mosaic_a = rules(mosaic_eligible, 3100, [price(allof(flag("member"), flag("guardianConsent")), 900, "member with consent first"), price(flag("resident"), 1600, "resident second"), price(flag("student"), 1400, "student third"), price(flag("scholarship"), 0, "scholarship fourth")])
mosaic_b = rules(mosaic_eligible, 3100, [price(flag("scholarship"), 0, "scholarship first"), price(flag("student"), 1400, "student second"), price(allof(flag("member"), flag("guardianConsent")), 900, "member with consent third"), price(flag("resident"), 1600, "resident fourth")])
mosaic_corrected_a = rules(allof(age("gte", 16), age("lte", 80), neg(allof(flag("resident", False), flag("student", False), flag("member", False))), anyof(age("gte", 18), flag("guardianConsent")), time("gte", START), time("lt", END)), 3100, mosaic_b["fee"]["overrides"])

def attendee(age_=27, resident=False, student=False, member=False, guardianConsent=False, scholarship=False, submittedAt=NOON):
    return {"age": age_, "resident": resident, "student": student, "member": member, "guardianConsent": guardianConsent, "scholarship": scholarship, "submittedAt": submittedAt}

def decision(cents):
    return {"accepted": cents is not None, "feeCents": cents}

def scenario(id_, why, a, left, right):
    return {"id": id_, "purpose": why, "attendee": a, "expected": {"alice": decision(left), "bob": decision(right)}}

def lantern(id_, why, left, right, **kwargs):
    return scenario(id_, why, attendee(submittedAt=BEFORE, **kwargs), left, right)

lantern_scenarios = [
    lantern("lantern-age-13", "Below lower age bound even with every exception", None, None, age_=13, resident=True, student=True, member=True, guardianConsent=True, scholarship=True),
    lantern("lantern-age-14-no-consent", "Inclusive lower age does not waive youth consent", None, None, age_=14, resident=True),
    lantern("lantern-youth-exempt", "Resident AND scholarship waive youth exclusion alone", 0, 0, age_=14, resident=True, scholarship=True),
    lantern("lantern-student-scholar-no-consent", "Scholarship without residency does not waive youth exclusion", None, None, age_=14, student=True, scholarship=True),
    lantern("lantern-age-17-consent", "Youth branch passes with consent", 4800, 4800, age_=17, student=True, guardianConsent=True),
    lantern("lantern-age-18-no-consent", "Adult boundary needs no consent", 4800, 4800, age_=18, student=True),
    lantern("lantern-age-65-member", "Upper inclusive age and member exception to neither resident nor student", 1700, 1700, age_=65, member=True),
    lantern("lantern-age-66", "Scholarship does not waive upper age", None, None, age_=66, resident=True, student=True, member=True, guardianConsent=True, scholarship=True),
    lantern("lantern-neither-and-not-member", "Nested exclusion denies no qualifying status", None, None),
    scenario("lantern-exact-cutoff-member", "Only Bob includes exact UTC cutoff", attendee(member=True, submittedAt=CUTOFF), None, 1700),
    scenario("lantern-exact-cutoff-scholar", "Exact UTC inclusion still applies before free fee", attendee(resident=True, scholarship=True, submittedAt=CUTOFF), None, 0),
    scenario("lantern-after-cutoff", "One millisecond after cutoff denied by both", attendee(resident=True, submittedAt="2031-11-02T01:30:00.001Z"), None, None),
    lantern("lantern-before-cutoff", "One millisecond before cutoff accepted", 4800, 4800, resident=True),
    lantern("lantern-young-member-scholar", "Membership does not replace youth consent; nonresident scholarship cannot waive it", None, None, age_=17, member=True, scholarship=True),
    lantern("lantern-young-member-consent-scholar", "Scholarship fee wins over member fee after consent passes", 0, 0, age_=17, member=True, guardianConsent=True, scholarship=True),
    lantern("lantern-age-120", "Maximum schema age still subject to policy upper bound", None, None, age_=120, resident=True, student=True, member=True, guardianConsent=True, scholarship=True),
    lantern("lantern-age-0", "Minimum schema age cannot use exceptions", None, None, age_=0, resident=True, student=True, member=True, guardianConsent=True, scholarship=True),
]

def mosaic(id_, why, left, right, **kwargs):
    return scenario(id_, why, attendee(**kwargs), left, right)

mosaic_scenarios = [
    mosaic("mosaic-age-15", "Below lower age despite all flags", None, None, age_=15, resident=True, student=True, member=True, guardianConsent=True, scholarship=True),
    mosaic("mosaic-age-16-no-consent", "Scholarship never waives youth admission", None, None, age_=16, resident=True, scholarship=True),
    mosaic("mosaic-age-16-consent", "Inclusive lower age with consent", 1600, 1600, age_=16, resident=True, guardianConsent=True),
    mosaic("mosaic-age-17-member-student", "Member-consent priority versus student priority", 900, 1400, age_=17, member=True, student=True, guardianConsent=True),
    mosaic("mosaic-age-18-default", "Adult member without consent reaches default", 3100, 3100, age_=18, member=True),
    mosaic("mosaic-age-80-overlap", "Inclusive upper age; resident/student price overlap", 1600, 1400, age_=80, resident=True, student=True),
    mosaic("mosaic-age-81", "Above upper age despite all flags", None, None, age_=81, resident=True, student=True, member=True, guardianConsent=True, scholarship=True),
    mosaic("mosaic-paid-to-free", "Frozen registration journey: Alice charges resident before scholarship", 1600, 0, resident=True, student=True, scholarship=True),
    mosaic("mosaic-member-consent-scholar", "Alice earlier member price blocks free scholarship", 900, 0, member=True, guardianConsent=True, scholarship=True),
    mosaic("mosaic-member-only-scholar", "Alice scholarship can match when earlier rules fail", 0, 0, member=True, scholarship=True),
    mosaic("mosaic-student-scholar", "Alice student rule blocks scholarship", 1400, 0, student=True, scholarship=True),
    mosaic("mosaic-member-resident-consent", "Member consent beats resident in both", 900, 900, member=True, resident=True, guardianConsent=True),
    mosaic("mosaic-resident-only", "Resident fee without competing flags", 1600, 1600, resident=True),
    mosaic("mosaic-student-only", "Student fee without competing flags", 1400, 1400, student=True),
    mosaic("mosaic-scholar-with-no-status", "Scholarship alone never supplies admission status", None, None, scholarship=True),
    mosaic("mosaic-before-opening", "Opening minus one millisecond", None, None, resident=True, submittedAt="2032-02-29T08:59:59.999Z"),
    mosaic("mosaic-exact-opening", "Opening instant is included", 1600, 1600, resident=True, submittedAt=START),
    mosaic("mosaic-before-closing", "Closing minus one millisecond is admitted", 1600, 1600, resident=True, submittedAt="2032-03-01T08:59:59.999Z"),
    mosaic("mosaic-exact-closing", "Closing instant is excluded", None, None, resident=True, submittedAt=END),
    mosaic("mosaic-after-closing", "Closing plus one millisecond is excluded", None, None, resident=True, submittedAt="2032-03-01T09:00:00.001Z"),
    mosaic("mosaic-youth-student-no-consent", "Student status does not waive consent", None, None, age_=17, student=True),
]

# Explicit correction results, corresponding one-for-one to the preceding
# authored scenarios. These are not generated by executing the expected rules.
corrected_cents = [None, None, 1600, 1400, 3100, 1400, None, 0, 0, 0, 0, 900, 1600, 1400, None, None, 1600, 1600, None, None, None]
assert len(mosaic_scenarios) == len(corrected_cents)
corrected_scenarios = [scenario("corrected-" + s["id"], s["purpose"], s["attendee"], cents, cents) for s, cents in zip(mosaic_scenarios, corrected_cents)]

ambiguity_scenarios = [
    {"id": "watercolor-resident-student", "attendee": attendee(age_=20, resident=True, student=True), "conflictingWholePricesCents": [700, 1400]},
    {"id": "watercolor-student-scholar-member", "attendee": attendee(age_=20, member=True, student=True, scholarship=True), "conflictingWholePricesCents": [0, 700]},
    {"id": "watercolor-resident-scholar", "attendee": attendee(age_=20, resident=True, scholarship=True), "conflictingWholePricesCents": [0, 1400]},
    {"id": "watercolor-three-way", "attendee": attendee(age_=20, resident=True, student=True, scholarship=True), "conflictingWholePricesCents": [0, 700, 1400]},
]
for s in ambiguity_scenarios:
    s["expected"] = {who: {"accepted": None, "feeCents": None, "executable": False} for who in ["alice", "bob"]}
    s["purpose"] = "Eligible overlapping fee witness; WHOLE policy remains unresolved, so no admission or price decision may be manufactured."

def expected_candidate(rule): return {"rules": rule, "requiresIssues": rule is None}
def discovery(status, ids, deltas=None):
    result = {"status": status, "witnessIdsExactSet": ids, "issuesExpected": status == "unresolved"}
    if deltas is not None: result["maxFeeDeltaCentsByWitnessId"] = deltas
    if status == "unresolved": result["checkedCases"] = 0
    return result

goldens = [
    {"id": "lantern-nested-utc", "expectedCandidates": {"alice": expected_candidate(lantern_a), "bob": expected_candidate(lantern_b)}, "discovery": discovery("different", ["admission-right"]), "scenarios": lantern_scenarios, "interpretationNotes": ["The resident AND scholarship exception applies only to youth consent, never age or status.", "Alice excludes and Bob includes the exact UTC cutoff.", "Scholarship fee is first and does not create eligibility."]},
    {"id": "mosaic-priority", "expectedCandidates": {"alice": expected_candidate(mosaic_a), "bob": expected_candidate(mosaic_b)}, "discovery": discovery("different", ["price-left-higher", "price-right-higher"], {"price-left-higher": 1600, "price-right-higher": 500}), "scenarios": mosaic_scenarios, "interpretationNotes": ["Admission is identical and both UTC endpoints are explicit.", "Alice's scholarship is fourth and cannot override a prior match.", "Bob's scholarship is first; student priority can nevertheless be more expensive than Alice's member-with-consent price when scholarship is false."]},
    {"id": "mosaic-corrected", "expectedCandidates": {"alice": expected_candidate(mosaic_corrected_a), "bob": expected_candidate(mosaic_b)}, "discovery": discovery("equivalent", []), "scenarios": corrected_scenarios, "interpretationNotes": ["Alice's negated none-of status expression is equivalent to Bob's at-least-one expression.", "Alice's successive remaining-people clauses express the same first-match fee order as Bob.", "Bob's original Spanish source is preserved byte for byte from mosaic-priority."]},
    {"id": "watercolor-overlap", "expectedCandidates": {"alice": expected_candidate(None), "bob": expected_candidate(None)}, "discovery": discovery("unresolved", []), "scenarios": ambiguity_scenarios, "issueRequirements": {"requiredMeaning": "Two or more resident/student/scholarship prices overlap, with no stated priority or unique whole price; ask which price prevails.", "mustNotInvent": ["source-order priority", "lowest-price priority", "scholarship always wins", "stacking or subtraction", "a partially executable admission-only policy"]}},
]

corpus = {
    "schemaVersion": "samepage-independent-holdout-v1",
    "name": "fresh-synthetic-hobby-bilingual-2026-10-26",
    "authorship": {"mode": "fresh-held-out", "readScope": ["production lib/studio-engine.ts", "production lib/studio-types.ts", "production lib/studio.ts"], "excluded": ["prior evaluation corpora", "prior model outputs", "network or provider calls"], "sourceOnlyForProvider": "Send only sources[].alice.text and sources[].bob.text through the production prompt. Never send goldens, scenarios, notes, oracle code, or freeze metadata."},
    "sources": sources,
    "goldens": goldens,
    "journey": {"roomKey": "mosaic", "initialStage": "mosaic-priority", "initialJointPublishCandidate": "alice", "registrationScenarioId": "mosaic-paid-to-free", "attendee": attendee(resident=True, student=True, scholarship=True), "expectedInitialDecision": decision(1600), "correctionStage": "mosaic-corrected", "correctionChangesOnly": "alice", "expectedNewDecision": decision(0), "requiredInvariants": ["Neither first review nor one editor vote publishes.", "Two votes for initial Alice candidate publish the $16 policy.", "The initial receipt remains accepted at 1600 cents under its original policy version after correction.", "Editing Alice invalidates the previous review, and a vote with that stale review ID is rejected.", "Fresh correction review is equivalent; two votes for the same fresh candidate publish the free policy.", "A new registration uses the new policy version and receives feeCents 0.", "No vote can publish either ambiguous watercolor candidate."]},
    "assertionCounts": {"concreteScenarioRows": sum(len(g["scenarios"]) for g in goldens), "executableDecisionAssertions": 2 * (len(lantern_scenarios) + len(mosaic_scenarios) + len(corrected_scenarios)), "ambiguousDecisionAbstentions": 2 * len(ambiguity_scenarios), "discoveryStatusAssertions": len(goldens)},
}

for filename, data in [("corpus.json", corpus), ("sources.json", {"schemaVersion": corpus["schemaVersion"], "sources": sources}), ("goldens.json", {"schemaVersion": corpus["schemaVersion"], "goldens": goldens, "journey": corpus["journey"], "assertionCounts": corpus["assertionCounts"]})]:
    (HERE / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"files": ["corpus.json", "sources.json", "goldens.json"], **corpus["assertionCounts"]}))
