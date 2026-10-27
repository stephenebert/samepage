# Post-live bilingual AI audit

**Finding present.** All six attempted provider stages passed their frozen compiled-rule gates (240 concrete checks; 573,056 oracle checks; zero recorded mismatches). Case A passed the separate bilingual AI review. Case B has a material Spanish scope ambiguity. The remaining one-call ambiguity test was intentionally **not run** after this finding.

Two independent AI reviewers agreed on the wording concern. This was not a human bilingual study. The original source, prompts, holdouts, responses, and preflight audit were not changed. All 47 frozen suite files and17 preflight-reviewed file hashes remain unchanged. No additional provider/network calls were made by either reviewer.

## Case A

Both source translations preserve the intended distinction: Alice’s late resident-student consent exception requires member AND scholarship; Bob’s version allows member OR scholarship. The separate late nonresident exception remains AND. All deadlines and fee priorities are faithful.

The generated English and Spanish repair preserve Alice’s admission, put member1800 first even above scholarship0, retain nonmember fee tiers, and remove only the unreachable old member2600 fee. The authored unsafe rewrite was preserved exactly and blocked. No operative prose defect was found.

## Case B finding: Spanish adult-age scope

Both Alice’s baseline Spanish translation and the generated Spanish repair say:

> (2) tiene al menos 18 años, y es residente sin beca, o es estudiante que cumple al menos una de estas dos condiciones: ser miembro, o no tener beca.

The same text is stored in the final published Spanish field. See [baseline output](../case-b/stages/hard-b-window-and-resident-fee-baseline/after.json), [repair output](../case-b/stages/hard-b-window-and-resident-fee-generate-repair/after.json), and [final room](../case-b/case-final.json).

The source clearly requires age18+ for both adult alternatives. The generated wording drops that explicit grouping and permits a plausible reading equivalent to “(age18+ and resident without scholarship) OR (student satisfying member/no-scholarship)”. Under that reading, the student alternative escapes the age requirement. A reader can also infer the intended grouping, so the finding is **ambiguity**, not an unequivocal mistranslation or a demonstrated executable-rule error.

Golden **B18** is the concrete counter-reading witness: age17, nonresident, student, member, guardian consent present, no scholarship, submitted at2026-11-15T12:00:00.000Z. The intended and compiled policy reject this attendee. The loose Spanish reading could admit them through the student/member alternative, charging3600 cents.

The English repair, timestamps, resident4200 first-priority fee, and retained nonresident student4800 fee are correct. The original unsafe rewrite’s stronger Spanish grouping was preserved, and its deliberate4800→5100 fee change was blocked. The retained6400 fallback is unreachable after the resident override, but harmless to outcomes.

The frozen presentation formatter puts parentheses around AST all/any children. An AST-derived reading view can therefore show the correct grouping, which mitigates that display. It does not change the original Muse wording retained in candidate, repair, and published text fields.

## Outcome and limits

Case B does **not** receive an unqualified bilingual-fidelity pass. The run stopped before the ambiguity test; it supplies no evidence about clarification behavior for that final case. No code/prompt fix or retest was made within this frozen run. A future change/test should require explicit Spanish grouping of alternative clauses.

This audit separates correct executable outcomes from ambiguous natural-language prose. Its finding rests on two AI reviewers’ linguistic judgment, not a human study or proof that all readers choose the loose interpretation. Full evidence hashes, field locations, and the witness are recorded in [post-live-bilingual.json](post-live-bilingual.json).
