# Independent bilingual audit — fresh SamePage test

The operative policies and recorded gate decisions pass this AI source-to-output review. Three low-severity wording/localization notes remain; none changes admission or fee meaning. This is a post-run AI review, not a human bilingual or usability study.

Before live calls, the reviewer independently recalculated all **120 outcomes for 30 attendees across four policy stages**, with zero mismatches, and reviewed the direct oracle. The baseline texts differ exactly in the intended resident **AND** member versus resident **OR** member teen consent exception. The unsafe rewrite applies the requested student fee and introduces exactly the 30-minute closing extension.

The live output preserves Alice's English and Bob's Spanish source text exactly. Alice's generated Spanish keeps the AND condition; Bob's generated English keeps the OR condition. Dates, age thresholds, consent, first-match fees, USD amounts, independent flags, and null denied fees are faithful. The unsafe proposal's English and Spanish each match the frozen input exactly.

The generated repair preserves every non-fee paragraph of the Alice baseline pair in both languages. Placing Student/Estudiante at 3250 cents first in the ordered fee list makes it override scholarships and every other tier. Remaining tiers preserve all nonstudent fees. The original 02:15Z exclusive deadline and all admission conditions remain intact. The final published English and Spanish match the generated repair.

The gate decisions are supported by the source meanings: the initial disagreement is real, the unsafe proposal is correctly blocked, and the repair is correctly accepted and subsequently published with both simulated votes. The unsafe witness is an otherwise eligible nonstudent at the original closing instant, denied under the intended policy but admitted for 6350 cents by the unsafe extension.

The inspected evidence contains **3 provider attempts**, all ending naturally with `stop`, **120 concrete checks**, and **185,856 oracle checks**, with zero mismatches. The reviewer separately cross-checked every concrete report outcome against the frozen goldens. The oracle totals are recorded run results; this audit made no further provider calls and did not rerun the app evaluator. Read-only git checks confirmed source commit `def141d7b93f12709db9b264d104584303ff4bf4` with no tracked changes after the run.

Text observations:

- Generated Spanish changes the proper event name from **Open Bench** to **Banco Abierto**. This is a name-consistency issue, with no policy-rule effect.
- Generated Spanish uses **exclusive** rather than the frozen source's plainer **sin incluir ese instante**. The following sentence explicitly says a submission at closing is late, preserving the exclusion. This is a clarity/style note.
- Ancillary Spanish fee explanations retain English labels, such as **Agreed student fee** and **Scholarship**. The Spanish policy itself translates the tiers and gives the correct amounts.

These observations were recorded without changing outputs, prompts, source, or frozen inputs. No retries or tuning were performed by this reviewer.

This single run does not establish general model reliability, human comprehension, or real multiuser security. The direct oracle covers all 121 ages and 32 flag combinations at selected time boundaries and interval representatives; it does not enumerate every possible timestamp. The app's rule checks do not by themselves prove translation fidelity. The separate AI language review supplies additional evidence for this specific case. The unsafe rewrite was authored for the test, so its rejection is not evidence of a spontaneous model error rate.

Exact source checks, evidence hashes, locations for text observations, and provenance are recorded in `bilingual-review.json`.
