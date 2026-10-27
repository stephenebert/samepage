"""Independent truth checks for the fresh held-out corpus.

Uses only Python's standard library and local frozen input files. Does not
import SamePage, call a model, read previous evidence, or access the network.
The direct hobby-policy oracle below does not use the golden rule ASTs.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import itertools
import json

HERE = Path(__file__).resolve().parent
FLAGS = ("resident", "student", "member", "guardianConsent", "scholarship")
CUTOFF = "2031-11-02T01:30:00.000Z"
START = "2032-02-29T09:00:00.000Z"
END = "2032-03-01T09:00:00.000Z"

def utc(value):
    parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
    assert parsed.microsecond % 1000 == 0
    assert parsed.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (parsed.microsecond // 1000) == value
    return parsed

def condition(c, person):
    op = c["op"]
    if op == "always": return True
    if op == "all": return all(condition(child, person) for child in c["args"])
    if op == "any": return any(condition(child, person) for child in c["args"])
    if op == "not": return not condition(c["arg"], person)
    if op == "flag": return person[c["field"]] == c["value"]
    if op == "age":
        return person["age"] >= c["value"] if c["cmp"] == "gte" else person["age"] <= c["value"]
    # Canonical, equal-width UTC timestamps order lexicographically. Dates are
    # validated separately; this implementation does not use JS Date parsing.
    x, y = person["submittedAt"], c["value"]
    return {"lt": x < y, "lte": x <= y, "gt": x > y, "gte": x >= y}[c["cmp"]]

def ast_decision(rule, person):
    if not condition(rule["eligibility"], person):
        return {"accepted": False, "feeCents": None}
    cents = rule["fee"]["defaultCents"]
    for override in rule["fee"]["overrides"]:
        if condition(override["when"], person):
            cents = override["cents"]
            break
    return {"accepted": True, "feeCents": cents}

def direct_oracle(stage, editor, p):
    """Direct arithmetic/boolean truth from the authored natural-language policy.

    Deliberately independent of recursive AST execution. Returns the complete
    admission + price result, preserving that rejected people have no fee.
    """
    n, r, s, m, g, h, t = (p[k] for k in ("age",) + FLAGS + ("submittedAt",))
    if stage == "lantern-nested-utc":
        has_status = r or s or m
        youth_is_allowed = n >= 18 or g or (r and h)
        in_time = t < CUTOFF if editor == "alice" else t <= CUTOFF
        admitted = 14 <= n <= 65 and has_status and youth_is_allowed and in_time
        cents = 0 if h else 1700 if m else 4800
    elif stage in ("mosaic-priority", "mosaic-corrected"):
        admitted = 16 <= n <= 80 and (r or s or m) and (n >= 18 or g) and START <= t < END
        if stage == "mosaic-priority" and editor == "alice":
            cents = 900 if m and g else 1600 if r else 1400 if s else 0 if h else 3100
        else:
            cents = 0 if h else 1400 if s else 900 if m and g else 1600 if r else 3100
    else:
        raise AssertionError("The unresolved policy has no executable truth oracle.")
    return {"accepted": bool(admitted), "feeCents": cents if admitted else None}

def validate_rules(rule):
    assert set(rule) == {"eligibility", "fee"}
    node_count = 0
    def check(c, depth=1):
        nonlocal node_count
        node_count += 1
        assert node_count <= 128 and depth <= 8
        op = c["op"]
        if op == "always": assert set(c) == {"op"}
        elif op in ("all", "any"):
            assert set(c) == {"op", "args"} and 1 <= len(c["args"]) <= 16
            for child in c["args"]: check(child, depth + 1)
        elif op == "not":
            assert set(c) == {"op", "arg"}
            check(c["arg"], depth + 1)
        elif op == "age":
            assert set(c) == {"op", "cmp", "value"}
            assert c["cmp"] in ("gte", "lte") and type(c["value"]) is int and 0 <= c["value"] <= 120
        elif op == "flag":
            assert set(c) == {"op", "field", "value"}
            assert c["field"] in FLAGS and type(c["value"]) is bool
        elif op == "time":
            assert set(c) == {"op", "cmp", "value"}
            assert c["cmp"] in ("lt", "lte", "gt", "gte")
            utc(c["value"])
        else: raise AssertionError("Unsupported golden condition")
    check(rule["eligibility"])
    f = rule["fee"]
    assert set(f) == {"currency", "defaultCents", "overrides"} and f["currency"] == "USD"
    assert type(f["defaultCents"]) is int and 0 <= f["defaultCents"] <= 1000000
    assert len(f["overrides"]) <= 16
    for override in f["overrides"]:
        assert set(override) == {"when", "cents", "label"}
        assert type(override["cents"]) is int and 0 <= override["cents"] <= 1000000
        assert 0 < len(override["label"]) <= 160
        check(override["when"])
    return node_count

def validate_attendee(p):
    assert set(p) == {"age", *FLAGS, "submittedAt"}
    assert type(p["age"]) is int and 0 <= p["age"] <= 120
    assert all(type(p[f]) is bool for f in FLAGS)
    utc(p["submittedAt"])

def epoch_samples(boundaries):
    # Every constant truth region is represented, including the isolated exact
    # boundaries, adjacent milliseconds, distant past/future, and each gap.
    bs = sorted(utc(b) for b in boundaries)
    ts = {datetime(1900, 1, 1, tzinfo=timezone.utc), datetime(9998, 12, 31, tzinfo=timezone.utc)}
    for b in bs: ts.update((b - timedelta(milliseconds=1), b, b + timedelta(milliseconds=1)))
    for left, right in zip(bs, bs[1:]):
        if (right - left).total_seconds() > .002:
            middle = left + (right - left) / 2
            ts.add(middle.replace(microsecond=middle.microsecond // 1000 * 1000))
    return [t.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (t.microsecond // 1000) for t in sorted(ts)]

def witness_id(a, b):
    if a["accepted"] and not b["accepted"]: return "admission-left", None
    if b["accepted"] and not a["accepted"]: return "admission-right", None
    if a["accepted"] and b["accepted"] and a["feeCents"] != b["feeCents"]:
        d = a["feeCents"] - b["feeCents"]
        return ("price-left-higher" if d > 0 else "price-right-higher"), abs(d)
    return None, None

def main():
    corpus = json.loads((HERE / "corpus.json").read_text())
    assert json.loads((HERE / "sources.json").read_text())["sources"] == corpus["sources"]
    assert json.loads((HERE / "goldens.json").read_text())["goldens"] == corpus["goldens"]
    assert [s["sequence"] for s in corpus["sources"]] == [1, 2, 3, 4]
    assert [s["id"] for s in corpus["sources"]] == [g["id"] for g in corpus["goldens"]]
    assert sum(s["kind"] == "fresh-pair" for s in corpus["sources"]) == 3
    assert sum(s["kind"] == "correction" for s in corpus["sources"]) == 1
    assert corpus["sources"][1]["bob"]["text"] == corpus["sources"][2]["bob"]["text"]
    reports, decision_assertions, abstentions, complete_checks = [], 0, 0, 0
    for source, golden in zip(corpus["sources"], corpus["goldens"]):
        assert all(0 < len(source[e]["text"]) <= 6000 for e in ("alice", "bob"))
        stage = source["id"]
        candidate_rules = {e: golden["expectedCandidates"][e]["rules"] for e in ("alice", "bob")}
        if stage == "watercolor-overlap":
            assert all(r is None for r in candidate_rules.values())
            assert golden["discovery"] == {"status": "unresolved", "witnessIdsExactSet": [], "issuesExpected": True, "checkedCases": 0}
            for row in golden["scenarios"]:
                p = row["attendee"]
                validate_attendee(p)
                assert 18 <= p["age"] <= 72 and (p["resident"] or p["member"])
                possible = sorted(set(price for f, price in (("resident", 1400), ("student", 700), ("scholarship", 0)) if p[f]))
                assert possible == row["conflictingWholePricesCents"] and len(possible) >= 2
                for e in ("alice", "bob"):
                    assert row["expected"][e] == {"accepted": None, "feeCents": None, "executable": False}
                    assert golden["expectedCandidates"][e]["requiresIssues"] is True
                    abstentions += 1
            reports.append({"id": stage, "status": "unresolved", "ambiguousOverlapWitnesses": len(golden["scenarios"]), "bothWholeRulesNull": True})
            continue

        nodes = {e: validate_rules(r) for e, r in candidate_rules.items()}
        for row in golden["scenarios"]:
            validate_attendee(row["attendee"])
            for editor, r in candidate_rules.items():
                expected = row["expected"][editor]
                assert expected == direct_oracle(stage, editor, row["attendee"]), (stage, row["id"], editor, "direct oracle")
                assert expected == ast_decision(r, row["attendee"]), (stage, row["id"], editor, "golden AST")
                assert golden["expectedCandidates"][editor]["requiresIssues"] is False
                decision_assertions += 1

        times = epoch_samples([CUTOFF] if stage == "lantern-nested-utc" else [START, END])
        found, max_deltas, domain_rows = set(), {}, 0
        for n, bits, t in itertools.product(range(121), itertools.product([False, True], repeat=5), times):
            p = {"age": n, **dict(zip(FLAGS, bits)), "submittedAt": t}
            outcomes = []
            for editor, r in candidate_rules.items():
                direct = direct_oracle(stage, editor, p)
                assert ast_decision(r, p) == direct, (stage, editor, p)
                outcomes.append(direct)
                complete_checks += 1
            found_id, delta = witness_id(*outcomes)
            if found_id:
                found.add(found_id)
                if delta is not None: max_deltas[found_id] = max(delta, max_deltas.get(found_id, 0))
            domain_rows += 1
        expected_discovery = golden["discovery"]
        assert found == set(expected_discovery["witnessIdsExactSet"]), (stage, found)
        assert expected_discovery["status"] == ("different" if found else "equivalent")
        assert expected_discovery["issuesExpected"] is False
        if "maxFeeDeltaCentsByWitnessId" in expected_discovery:
            assert expected_discovery["maxFeeDeltaCentsByWitnessId"] == max_deltas
        reports.append({"id": stage, "status": expected_discovery["status"], "authoredScenarioRows": len(golden["scenarios"]), "allIntegerAgesChecked": 121, "allBooleanCombinationsChecked": 32, "utcRepresentativesChecked": len(times), "domainRows": domain_rows, "goldenRuleNodeCounts": nodes, "witnessIds": sorted(found), "maxFeeDeltaCentsByWitnessId": max_deltas})

    journey = corpus["journey"]
    validate_attendee(journey["attendee"])
    assert direct_oracle("mosaic-priority", "alice", journey["attendee"]) == journey["expectedInitialDecision"] == {"accepted": True, "feeCents": 1600}
    assert direct_oracle("mosaic-corrected", "alice", journey["attendee"]) == journey["expectedNewDecision"] == {"accepted": True, "feeCents": 0}
    assert decision_assertions == corpus["assertionCounts"]["executableDecisionAssertions"] == 118
    assert abstentions == corpus["assertionCounts"]["ambiguousDecisionAbstentions"] == 8
    report = {"passed": True, "verifier": "standalone Python standard library; direct formulas compared with independent AST evaluator", "productionImports": False, "modelOrNetworkCalls": 0, "corpusSha256": hashlib.sha256((HERE / "corpus.json").read_bytes()).hexdigest(), "explicitDecisionAssertions": decision_assertions, "ambiguityAbstentionAssertions": abstentions, "exhaustiveGoldenVsDirectOracleDecisions": complete_checks, "stages": reports, "limitation": "The oracle validates the frozen synthetic goldens and semantic regions. It does not certify future model interpretations, translations, or live application behavior. No API or live app was exercised."}
    (HERE / "truth-verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__": main()
