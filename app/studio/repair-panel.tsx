"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert, Globe2, History, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles, Users } from "lucide-react";
import { evaluateStudioPolicy } from "../../lib/studio-engine";
import { realisticStudioWitness } from "../../lib/studio-witness";
import { reconcileRepairBaseline } from "../../lib/studio-repair-controls";
import { studioRepairPresentation } from "../../lib/studio-repair-presentation";
import PolicySummary from "./policy-summary";
import ChangeExplanation from "./change-explanation";
import type { StudioAction, StudioAttendee, StudioDecision, StudioEditor, StudioFlag, StudioRepair, StudioRepairIntent, StudioRoom, StudioWitness } from "../../lib/studio-types";

type ModelStatus = { provider: "Meta"; model: string; ready: boolean; mode: "automatic" | "disabled" | "unconfigured"; maxCalls: number };
type Reply = { room?: StudioRoom; model?: ModelStatus; error?: string; automatic?: { status: string; error?: { code: string; message: string } } };
type Props = {
  room: StudioRoom; editor: StudioEditor | null; busy: boolean; dirty: boolean; model: ModelStatus | null;
  act: (action: StudioAction) => Promise<StudioRoom>;
  receive: (data: Reply) => boolean;
  setBusy: (busy: boolean) => void;
  useAttendee: (attendee: StudioAttendee) => void;
};
const PEOPLE = { alice: "Alice", bob: "Bob" };
const GROUPS: { value: StudioFlag; label: string; negative: string }[] = [
  { value: "scholarship", label: "Scholarship recipients", negative: "No scholarship" },
  { value: "student", label: "Students", negative: "Not a student" },
  { value: "member", label: "Members", negative: "Not a member" },
  { value: "resident", label: "Residents", negative: "Nonresident" },
  { value: "guardianConsent", label: "People with guardian consent", negative: "No guardian consent" },
];
const groupName = (flag: StudioFlag) => GROUPS.find(group => group.value === flag)!.label;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const outcome = (decision: StudioDecision) => decision.accepted ? `${money(decision.feeCents!)} fee` : "Not eligible";
const time = (value: string) => `${value.replace("T", " · ").replace(/\.000Z$/, "").replace(/Z$/, "")} UTC`;
function feeValue(value: string): number | null {
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 1000000 ? cents : null;
}
function titleFor(witness: StudioWitness, repair: StudioRepair) {
  if (!witness.left.accepted && witness.right.accepted) return "This rewrite admits someone who should still be excluded.";
  if (witness.left.accepted && !witness.right.accepted) return "This rewrite excludes someone who should still be eligible.";
  const person = { scholarship: "scholarship recipient", student: "student", member: "member", resident: "resident", guardianConsent: "person with guardian consent" }[repair.job.intent.scopeFlag];
  return witness.attendee[repair.job.intent.scopeFlag]
    ? `This eligible ${person} would pay ${money(witness.right.feeCents!)} instead of ${money(witness.left.feeCents!)}.`
    : "This rewrite also changes a fee outside the selected group.";
}

export default function RepairPanel({ room, editor, busy, dirty, model, act, receive, setBusy, useAttendee }: Props) {
  const repair = room.repair;
  const [baselineId, setBaselineId] = useState(repair?.job.intent.baselineCandidateId ?? "");
  const [scopeFlag, setScopeFlag] = useState<StudioFlag>(repair?.job.intent.scopeFlag ?? "scholarship");
  const [fee, setFee] = useState(repair ? String(repair.job.intent.feeCents / 100) : "0");
  const [customOpen, setCustomOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(repair?.status !== "published");
  const [historyOpen, setHistoryOpen] = useState(repair?.status === "published");
  const [proposalEn, setProposalEn] = useState(repair?.job.proposalText?.en ?? "");
  const [proposalEs, setProposalEs] = useState(repair?.job.proposalText?.es ?? "");
  const [localStartedAt, setLocalStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState("");
  const [voting, setVoting] = useState(false);
  const [editedSinceCheck, setEditedSinceCheck] = useState(false);
  const candidates = room.review?.discovery.status !== "unresolved" ? room.review?.candidates.filter(candidate => candidate.rules && !candidate.issues.length) ?? [] : [];
  const candidateIdsKey = JSON.stringify(candidates.map(candidate => candidate.id));
  const baseline = candidates.find(candidate => candidate.id === baselineId);
  const cents = feeValue(fee);
  const automatic = room.automaticRepair;
  const expired = automatic?.status === "running" && clock >= Date.parse(automatic.leaseExpiresAt);
  const running = (repair?.status === "running" && !expired) || localStartedAt !== null;
  const startedAt = automatic?.status === "running" ? Date.parse(automatic.startedAt) : localStartedAt;
  const elapsed = startedAt ? Math.max(0, Math.floor((clock - startedAt) / 1000)) : 0;
  const callsRemaining = Math.max(0, (model?.maxCalls ?? 5) - (room.modelCallCount ?? 0));
  const canRequest = Boolean(!room.fullDemo && baseline && cents !== null && !busy && !dirty && !running && model?.ready && callsRemaining > 0 && repair?.status !== "published");
  const currentRepair = repair && repair.status !== "superseded" ? repair : null;
  const previousBlocked = [...(room.repairHistory ?? [])].reverse().find(item => item.status === "blocked" && item.impact?.verification.witnesses.length);
  const presentationKey = JSON.stringify([currentRepair, room.registrations]);
  const presentation = useMemo(() => studioRepairPresentation(currentRepair, room.registrations), [presentationKey]);
  const intendedWitness = presentation.witness;
  useEffect(() => { if (repair?.status === "published") { setSetupOpen(false); setHistoryOpen(true); } }, [repair?.status]);
  const participants: StudioEditor[] = editor ? [editor] : ["alice", "bob"];
  const hasCollateralChange = currentRepair?.impact?.verification.witnesses.some(witness => witness.left.accepted !== witness.right.accepted || !witness.attendee[currentRepair.job.intent.scopeFlag]) ?? false;
  const restoreCheckedRequest = () => {
    if (!repair || repair.status === "superseded") return;
    setBaselineId(repair.job.intent.baselineCandidateId); setScopeFlag(repair.job.intent.scopeFlag); setFee(String(repair.job.intent.feeCents / 100));
    setProposalEn(repair.job.proposalText?.en ?? ""); setProposalEs(repair.job.proposalText?.es ?? ""); setEditedSinceCheck(false);
  };
  // Restore or invalidate once: separate effects could clear a newly restored ID
  // using the previous render's empty selection when a remote check arrived.
  useEffect(() => {
    const next = reconcileRepairBaseline(baselineId, editedSinceCheck, repair, room.review?.id, candidates.map(candidate => candidate.id));
    if (next.restoreSavedRequest) restoreCheckedRequest();
    else if (next.baselineId !== baselineId) setBaselineId(next.baselineId);
  }, [repair?.id, repair?.status, editedSinceCheck, room.review?.id, candidateIdsKey, baselineId]);

  useEffect(() => {
    if (!running) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const submit = async (custom: boolean) => {
    if (!canRequest || cents === null) return;
    setBusy(true); setError(""); setLocalStartedAt(Date.now()); setClock(Date.now());
    const intent: StudioRepairIntent = { baselineCandidateId: baselineId, scopeFlag, feeCents: cents };
    try {
      const response = await fetch(`/api/studio/${encodeURIComponent(room.id)}/repair`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, ...(custom ? { proposalText: { en: proposalEn, es: proposalEs } } : {}), ...(automatic?.status === "failed" || expired || repair?.status === "blocked" || repair?.status === "ready" ? { retry: true } : {}) }),
      });
      const data = await response.json() as Reply;
      if (!receive(data)) return;
      if (!response.ok) throw new Error(data.error || data.automatic?.error?.message || "The repair could not be checked. Nothing was published.");
      setEditedSinceCheck(false);
    } catch (e) { setError(e instanceof Error ? e.message : "The repair could not be checked. Nothing was published."); }
    finally { setLocalStartedAt(null); setBusy(false); }
  };
  const approve = async (person: StudioEditor) => {
    if (!repair || repair.status !== "ready" || dirty || busy || voting || editedSinceCheck) return;
    setVoting(true); setError("");
    try { await act({ type: "voteRepair", editor: person, repairId: repair.id }); }
    catch (e) { setError(e instanceof Error ? e.message : "Approval could not be saved."); }
    finally { setVoting(false); }
  };

  if (!room.review && !repair && !previousBlocked) return null;
  const loadRecordedRepair = async () => {
    if (!room.fullDemo || !repair || repair.status !== "blocked" || busy || dirty) return;
    setBusy(true); setError("");
    try { await act({ type: "loadDemoRepair", repairId: repair.id }); }
    catch (e) { setError(e instanceof Error ? e.message : "The recorded repair could not be loaded."); }
    finally { setBusy(false); }
  };
  return <section className="sps-repair" id="studio-repair" aria-label="Repair and impact check">
    <header><p className="sps-eyebrow"><ShieldCheck size={13} /> Change the policy. Keep the promise.</p><h2>{currentRepair?.status === "published" ? <>A focused repair.<br /><em>Its impact, checked.</em></> : <>Fix one thing.<br /><em>Check everything it touches.</em></>}</h2><p>{currentRepair?.status === "published" ? "Follow the saved evidence: the requested change, the impact check, and both editors’ approval." : room.fullDemo ? "Follow the unintended change, inspect its cause, then agree on the recorded repair." : "Choose a fee change. SamePage checks whether the rewrite also changes admission or anyone else’s fee."}</p>{currentRepair?.status === "published" && <div className="sps-repair-story"><span><CheckCircle2 size={13} /> {money(currentRepair.job.intent.feeCents)} for eligible {groupName(currentRepair.job.intent.scopeFlag).toLowerCase()}</span>{previousBlocked && <span className="caught"><ShieldCheck size={13} /> Earlier rewrite blocked</span>}<span><Users size={13} /> Both editors approved</span><span>Form v{currentRepair.publishedVersion}</span></div>}</header>
    {!room.fullDemo && <details className="sps-repair-setup" open={setupOpen} onToggle={event => setSetupOpen(event.currentTarget.open)}><summary>{currentRepair?.status === "published" ? "Inspect the saved repair request" : "Set the change and what must stay the same"}<ChevronDown size={14} /></summary><div className="sps-repair-controls">
      <label className="sps-repair-baseline"><span>Preserve this interpretation</span><select aria-label="Repair baseline interpretation" value={baselineId} onChange={event => { setBaselineId(event.target.value); setEditedSinceCheck(true); }} disabled={running || busy || !candidates.length}><option value="">Choose the meaning to preserve…</option>{candidates.map(candidate => <option value={candidate.id} key={candidate.id}>{PEOPLE[candidate.editor]}’s {candidate.editor === "alice" ? "English" : "Spanish"} interpretation · draft v{candidate.sourceVersion}</option>)}</select></label>
      <div className="sps-repair-intent"><div><span className="sps-overline">Change this</span><div className="sps-repair-fields"><label><span>Eligible people in this group</span><select aria-label="Repair target group" value={scopeFlag} onChange={event => { setScopeFlag(event.target.value as StudioFlag); setEditedSinceCheck(true); }} disabled={running || busy}>{GROUPS.map(group => <option value={group.value} key={group.value}>{group.label}</option>)}</select></label><label className="sps-repair-fee"><span>Pay this fee · USD</span><div><span>$</span><input aria-label="Repair target fee USD" value={fee} onChange={event => { setFee(event.target.value); setEditedSinceCheck(true); }} inputMode="decimal" disabled={running || busy} maxLength={8} /></div></label></div>{cents === null && <p className="sps-repair-input-error">Enter $0–$10,000, with at most two decimal places.</p>}</div><div className="sps-repair-protected"><span className="sps-overline"><LockKeyhole size={12} /> Keep these unchanged</span><p><Check size={13} /> Every admission rule and deadline</p><p><Check size={13} /> Fees outside the selected group</p><p><Check size={13} /> Earlier registration receipts</p></div></div>
      {baseline && <details className="sps-repair-source"><summary>Read the baseline being preserved <ChevronDown size={12} /></summary><p lang="en">{baseline.en}</p><p lang="es">{baseline.es}</p></details>}
      <div className="sps-repair-actions"><button type="button" className="sps-button" disabled={!canRequest} onClick={() => void submit(false)}>{running ? <LoaderCircle size={14} className="sps-spin" /> : <Sparkles size={14} />}Propose repair with Meta <ArrowRight size={13} /></button><span>{dirty ? "Save your draft edits first." : repair?.status === "published" ? "Edit and review the policy drafts to start another repair." : !candidates.length ? "Both drafts need a complete interpretation before repair." : !baseline ? "Choose a baseline first; no policy is selected for you." : !model?.ready ? model?.mode === "disabled" ? "Live Meta calls are paused. Saved checks remain available." : "Meta must be connected before proposing or checking a rewrite." : callsRemaining === 0 ? "This room has reached its model request limit." : "A proposal uses one model request. It never publishes itself."}</span></div>
      <details className="sps-repair-custom" open={customOpen} onToggle={event => setCustomOpen(event.currentTarget.open)}><summary>Already have a rewrite? Check its impact <ChevronDown size={13} /></summary><p>Paste the complete proposed policy in both languages. Meta interprets the wording; the same impact check compares it with the change you requested above.</p><div className="sps-repair-texts"><label><span>Proposed English policy</span><textarea aria-label="Proposed English repair" value={proposalEn} onChange={event => { setProposalEn(event.target.value); setEditedSinceCheck(true); }} maxLength={6000} disabled={running || busy} placeholder="Complete eligibility, deadlines, and fees…" /></label><label><span>Política propuesta en español</span><textarea aria-label="Proposed Spanish repair" lang="es" value={proposalEs} onChange={event => { setProposalEs(event.target.value); setEditedSinceCheck(true); }} maxLength={6000} disabled={running || busy} placeholder="Requisitos, plazos y tarifas completos…" /></label></div><button type="button" className="sps-button secondary" disabled={!canRequest || !proposalEn.trim() || !proposalEs.trim()} onClick={() => void submit(true)}><ShieldCheck size={14} />Check my rewrite</button></details>
    </div></details>}
    {room.fullDemo && <div className="sps-demo-intent"><strong>The request: eligible students pay $19.</strong><p>Keep admission, deadlines, and everyone else’s fees unchanged.</p><span>Saved {room.fullDemo.model} results · the impact check runs again in this room</span></div>}
    {error && <p className="sps-repair-error" role="alert">{error}</p>}
    {running ? <div className="sps-repair-running" aria-busy="true"><LoaderCircle size={22} className="sps-spin" /><div><strong>Meta is {repair?.job.proposalText ? "interpreting the proposed rewrite" : "drafting a focused repair"}.</strong><p>Then SamePage checks the interpreted rules against your intent. The current form stays on v{room.published.version}.</p></div><span className="sps-elapsed"><strong>{elapsed}<small>s</small></strong><span>elapsed</span></span></div> : expired ? <p className="sps-repair-error" role="status">The repair request did not finish before its lease expired. Nothing was published. Propose or check again to explicitly retry.</p> : null}
    {previousBlocked && <details className="sps-repair-history" open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary><History size={14} /> Earlier: a rewrite was stopped before publication <ChevronDown size={13} /></summary><p>{previousBlocked.job.proposalText ? "This supplied rewrite" : "This earlier proposal"} did not satisfy the saved intent. It never changed the live form.</p><RepairWitness repair={previousBlocked} witness={previousBlocked.impact!.verification.witnesses[0]} preferred={room.registrations.find(receipt => receipt.policyVersion === previousBlocked.job.basePolicyVersion)} useAttendee={useAttendee} historical /></details>}
    {currentRepair && currentRepair.status !== "running" && <div className={`sps-repair-result ${currentRepair.status === "blocked" ? "blocked" : currentRepair.status === "ready" || currentRepair.status === "published" ? "passed" : ""}`}>
      <div className="sps-repair-result-head">{currentRepair.status === "blocked" ? <CircleAlert size={22} /> : currentRepair.status === "ready" || currentRepair.status === "published" ? <ShieldCheck size={22} /> : <LockKeyhole size={22} />}<div><span className="sps-overline">{currentRepair.status === "published" ? `Jointly approved · live form v${currentRepair.publishedVersion}` : currentRepair.status === "ready" ? "Impact check passed · waiting for agreement" : currentRepair.status === "blocked" ? "Publication blocked" : "Repair not completed"}</span><h3>{currentRepair.status === "blocked" ? currentRepair.impact?.verification.witnesses.length ? hasCollateralChange ? "The rewrite changes more than you asked." : "The rewrite does not match the agreed change." : "The rewrite needs clarification." : currentRepair.status === "published" ? "The checked repair is now the working policy." : currentRepair.status === "ready" ? "A focused repair, ready for agreement." : "The working form is unchanged."}</h3></div></div>
      <p className="sps-repair-checked-intent"><strong>Checked intent:</strong> Eligible {groupName(currentRepair.job.intent.scopeFlag).toLowerCase()} pay {money(currentRepair.job.intent.feeCents)}. Preserve {PEOPLE[currentRepair.job.baseline.editor]}’s admission rules and everyone else’s fees.</p>
      {automatic?.jobId === currentRepair.id && <p className="sps-repair-provenance">{automatic.source === "meta" ? `Meta · ${automatic.model}` : "Controlled response · no API call"}{automatic.durationMs !== undefined ? ` · ${(automatic.durationMs / 1000).toFixed(1)}s` : ""}{currentRepair.job.proposalText ? " · supplied rewrite checked" : " · generated repair checked"}</p>}
      {currentRepair.status === "failed" && <p className="sps-repair-error" role="status">{automatic?.error?.message || "No complete proposal was accepted. Retry explicitly when ready."}</p>}
      {currentRepair.impact && <>
        {currentRepair.impact.verification.witnesses.map(witness => <RepairWitness key={witness.id} repair={currentRepair} witness={witness} preferred={room.registrations.find(receipt => receipt.policyVersion === currentRepair.job.basePolicyVersion)} useAttendee={useAttendee} />)}
        {currentRepair.status !== "blocked" && currentRepair.impact.status === "pass" && <><div className="sps-repair-checks"><span><CheckCircle2 size={15} /> Admission and deadlines preserved</span><span><CheckCircle2 size={15} /> Selected group receives the requested fee</span><span><CheckCircle2 size={15} /> All other fees preserved</span></div>{intendedWitness ? <div className="sps-repair-intended"><span className="sps-overline">{presentation.receiptChange ? "The intended effect · same attendee as the receipts" : "The intended effect · synthetic example attendee"}</span><div><strong><small>Selected baseline</small>{outcome(intendedWitness.left)}</strong><ArrowRight size={17} /><strong><small>{currentRepair.status === "published" ? "Approved repair" : "Proposed repair"}</small>{outcome(intendedWitness.right)}</strong></div><p>For this {intendedWitness.attendee.age}-year-old {intendedWitness.attendee.resident ? "resident" : "nonresident"} in the selected group. Admission stays the same.</p><p>{currentRepair.status === "published" ? `The form now uses the approved repair, v${currentRepair.publishedVersion}.` : `The current form still uses policy v${room.published.version} until both editors approve.`}</p><div className="sps-repair-person">{GROUPS.map(group => <span key={group.value} className={intendedWitness.attendee[group.value] ? "positive" : ""}>{intendedWitness.attendee[group.value] ? group.value === "guardianConsent" ? "Guardian consent" : group.value === "scholarship" ? "Scholarship" : group.value === "resident" ? "Resident" : group.value === "student" ? "Student" : "Member" : group.negative}</span>)}</div><p>Applied {time(intendedWitness.attendee.submittedAt)}</p>{currentRepair.job.baseline.rules && currentRepair.proposal?.rules && <ChangeExplanation baselineRules={currentRepair.job.baseline.rules} expectedRules={currentRepair.impact.expectedRules} proposedRules={currentRepair.proposal.rules} attendee={intendedWitness.attendee} scopeFlag={currentRepair.job.intent.scopeFlag} />}<button type="button" className="sps-button secondary" onClick={() => useAttendee(intendedWitness.attendee)}>Try this exact attendee in the form <ArrowRight size={12} /></button></div> : <p className="sps-repair-note">The baseline already produces the requested outcomes. No admission or fee change was found.</p>}</>}
        {currentRepair.impact.issues.length > 0 && <div className="sps-repair-issues">{currentRepair.impact.issues.map((issue, index) => <p key={index}>{issue}</p>)}</div>}
        <p className="sps-repair-scope">{currentRepair.impact.verification.checkedCases.toLocaleString()} representative cases checked across the supported rule domain. This checks the interpreted rules; both editors still need to review the wording.</p>
      </>}
      {room.fullDemo && currentRepair.status === "blocked" && <div className="sps-demo-load"><button type="button" className="sps-button" onClick={() => void loadRecordedRepair()} disabled={busy || dirty}><ArrowRight size={14} />Load the recorded repair</button><p>Use the saved Meta proposal and check it against the same request. This does not make an API call or approve anything.</p></div>}
      {currentRepair.proposal?.rules ? (currentRepair.status === "blocked" ? <details className="sps-repair-proposal"><summary>Inspect the blocked wording <ChevronDown size={13} /></summary><PolicySummary rules={currentRepair.proposal.rules} en={currentRepair.proposal.en} es={currentRepair.proposal.es} mode="reading" title="The blocked rewrite, in both languages" /></details> : <PolicySummary rules={currentRepair.proposal.rules} en={currentRepair.status === "published" && room.published.wordingSource === "checked-rules-v1" ? room.published.en : currentRepair.proposal.en} es={currentRepair.status === "published" && room.published.wordingSource === "checked-rules-v1" ? room.published.es : currentRepair.proposal.es} originalWording={currentRepair.status === "published" ? room.published.originalWording : undefined} mode={currentRepair.status === "published" ? room.published.wordingSource === "checked-rules-v1" ? "published" : "reading" : currentRepair.status === "ready" && currentRepair.wordingSource === "checked-rules-v1" ? "approval" : "reading"} title={currentRepair.status === "published" ? "The agreed policy, in both languages" : "Review the policy before approving"} />) : currentRepair.proposal && <details className="sps-repair-proposal"><summary><Globe2 size={13} /> Original proposal · clarification needed <ChevronDown size={13} /></summary><article><strong>English</strong><p lang="en">{currentRepair.proposal.en}</p></article><article><strong>Español</strong><p lang="es">{currentRepair.proposal.es}</p></article>{currentRepair.proposal.issues.map((issue, index) => <p className="sps-repair-note" key={index}>{issue}</p>)}</details>}
      {currentRepair.status === "ready" && editedSinceCheck && <div className="sps-repair-edited" role="status"><p>Your local repair request has changed since this check. Recheck the changes or restore the checked request before approving.</p><button type="button" className="sps-textbutton" onClick={restoreCheckedRequest}>Restore the checked request</button></div>}
      {(currentRepair.status === "ready" || currentRepair.status === "published") && <div className="sps-repair-agreement"><h3><Users size={15} /> Both editors approve this exact repair</h3><div className="sps-repair-votes">{(["alice", "bob"] as StudioEditor[]).map(person => <div key={person} className={currentRepair.votes[person] ? "approved" : ""}><span className={`sps-avatar ${person}`}>{PEOPLE[person][0]}</span><div><strong>{PEOPLE[person]}</strong><span>{currentRepair.votes[person] ? "Approved this repair" : "Approval needed"}</span></div>{currentRepair.votes[person] ? <CheckCircle2 size={16} /> : <span className="sps-choice-dot" />}</div>)}</div>{currentRepair.status === "ready" && <div className="sps-repair-approve">{participants.map(person => <button type="button" className="sps-button secondary" key={person} disabled={busy || voting || dirty || editedSinceCheck || Boolean(currentRepair.votes[person])} onClick={() => void approve(person)}>{currentRepair.votes[person] ? <CheckCircle2 size={13} /> : <Check size={13} />}{PEOPLE[person]}: {currentRepair.votes[person] ? "approved" : "approve checked repair"}</button>)}</div>}<p><LockKeyhole size={12} />{currentRepair.status === "published" ? "Both approvals saved. Earlier receipts retain their original results." : editedSinceCheck ? "The earlier check does not cover your local request changes. Restore it or run a new check." : dirty ? "Save your draft edits first. Any saved policy edit invalidates this repair." : Object.keys(currentRepair.votes).length === 1 ? "One approval received. The form will change only after the other editor agrees." : "No publication until both editors approve. A saved draft change invalidates this check."}</p></div>}
      {currentRepair.status === "blocked" && <p className="sps-repair-block-note"><LockKeyhole size={13} /> {room.fullDemo ? "Neither editor can publish this rewrite. Load the recorded repair to continue." : "Neither editor can publish this repair. Revise the wording or ask Meta for a new proposal."}</p>}
    </div>}
    {repair?.status === "superseded" && <p className="sps-repair-note sps-repair-stale">The drafts changed. The earlier repair and approvals are no longer valid; interpret the current drafts before proposing again.</p>}

  </section>;
}

function RepairWitness({ repair, witness: originalWitness, preferred, useAttendee, historical = false }: { repair: StudioRepair; witness: StudioWitness; preferred?: StudioAttendee; useAttendee: (attendee: StudioAttendee) => void; historical?: boolean }) {
  const key = JSON.stringify([repair.impact?.expectedRules, repair.proposal?.rules, originalWitness, preferred, repair.job.intent.scopeFlag]);
  const witness = useMemo(() => realisticStudioWitness(repair.impact?.expectedRules ?? null, repair.proposal?.rules ?? null, originalWitness, preferred, repair.job.intent.scopeFlag), [key]);
  const before = evaluateStudioPolicy(repair.job.baseline.rules!, witness.attendee);
  return <article className="sps-repair-witness"><strong>{titleFor(witness, repair)}</strong><p className="sps-repair-example-label">Synthetic example attendee · evaluated under both rules</p><div className="sps-repair-person"><span>{witness.attendee.age} years old</span>{GROUPS.map(group => <span key={group.value} className={witness.attendee[group.value] ? "positive" : ""}>{witness.attendee[group.value] ? group.value === "guardianConsent" ? "Guardian consent" : group.value === "scholarship" ? "Scholarship" : group.value === "resident" ? "Resident" : group.value === "student" ? "Student" : "Member" : group.negative}</span>)}</div><p className="sps-repair-time">Applied {time(witness.attendee.submittedAt)}</p><div className="sps-repair-outcomes"><div><span>Baseline</span><strong>{outcome(before)}</strong></div><div><span>Your requested outcome</span><strong>{outcome(witness.left)}</strong></div><div className="unexpected"><span>{historical ? "Blocked rewrite" : "Proposed rewrite"}</span><strong>{outcome(witness.right)}</strong></div></div>{repair.job.baseline.rules && repair.impact?.expectedRules && repair.proposal?.rules && <ChangeExplanation baselineRules={repair.job.baseline.rules} expectedRules={repair.impact.expectedRules} proposedRules={repair.proposal.rules} attendee={witness.attendee} scopeFlag={repair.job.intent.scopeFlag} />}<button type="button" className="sps-textbutton" onClick={() => useAttendee(witness.attendee)}>Load these facts into the current form <ArrowRight size={12} /></button></article>;
}
