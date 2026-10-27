"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, FileCheck2, Globe2, LoaderCircle, LockKeyhole, RefreshCw, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { evaluateStudioPolicy } from "../../lib/studio-engine";
import type { StudioAction, StudioAttendee, StudioCandidate, StudioDecision, StudioEditor, StudioFlag, StudioRegistration, StudioRoom, StudioWitness } from "../../lib/studio-types";
import "./studio.css";

const PEOPLE = { alice: { name: "Alice", language: "en", label: "English" }, bob: { name: "Bob", language: "es", label: "Español" } } as const;
const FLAGS: { key: StudioFlag; label: string; negative: string }[] = [
  { key: "resident", label: "Resident", negative: "Nonresident" },
  { key: "student", label: "Student", negative: "Not a student" },
  { key: "member", label: "Member", negative: "Not a member" },
  { key: "guardianConsent", label: "Guardian consent", negative: "No guardian consent" },
  { key: "scholarship", label: "Scholarship", negative: "No scholarship" },
];
type Act = (action: StudioAction) => Promise<StudioRoom>;
type Transfer = { token: number; attendee: StudioAttendee };
type Fields = { age: string; time: string } & Record<StudioFlag, boolean>;
type ModelStatus = { provider: "Meta"; model: string; ready: boolean; mode: "automatic" | "disabled" | "unconfigured"; maxCalls: number };
type StudioResponse = { room: StudioRoom; model?: ModelStatus; automatic?: { status: string; error?: { code: string; message: string } }; error?: string };
class StudioRequestError extends Error {
  constructor(message: string, readonly data: Partial<StudioResponse>) { super(message); }
}
const INITIAL_FIELDS: Fields = { age: "20", time: "2026-11-05T17:00", resident: false, student: false, member: false, guardianConsent: false, scholarship: false };

function money(cents: number | null) { return cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100); }
function timeLabel(value: string) { return `${value.replace("T", " · ").replace(/\.000Z$/, "").replace(/Z$/, "")} UTC`; }
function toFields(attendee: StudioAttendee): Fields { return { ...attendee, age: String(attendee.age), time: attendee.submittedAt.replace(/Z$/, "") }; }
function toAttendee(fields: Fields): StudioAttendee | null {
  if (!/^\d{1,3}$/.test(fields.age) || Number(fields.age) > 120 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(fields.time)) return null;
  const date = new Date(`${fields.time}Z`);
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(fields.time)) return null;
  return { age: Number(fields.age), resident: fields.resident, student: fields.student, member: fields.member, guardianConsent: fields.guardianConsent, scholarship: fields.scholarship, submittedAt: date.toISOString() };
}
async function request(url: string, body?: unknown): Promise<StudioResponse> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as StudioResponse;
  if (!response.ok) throw new StudioRequestError(data.error || data.automatic?.error?.message || "The room could not be updated.", data);
  return data;
}
function outcomeLabel(decision: StudioDecision) { return decision.accepted ? `${money(decision.feeCents)} registration` : "Not eligible"; }
function witnessLabel(witness: StudioWitness) { return witness.kind === "price-only" ? `${money(Math.abs(witness.feeDeltaCents || 0))} fee difference` : "Different eligibility"; }

export default function StudioPage() {
  const [ready, setReady] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<StudioRoom | null>(null);
  const latestRoom = useRef<StudioRoom | null>(null);
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [editor, setEditor] = useState<StudioEditor | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirtyEditors, setDirtyEditors] = useState<Partial<Record<StudioEditor, boolean>>>({});
  const [selection, setSelection] = useState<{ reviewId: string; index: number } | null>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [relayOpen, setRelayOpen] = useState(false);
  const [clock, setClock] = useState(0);
  const participants: StudioEditor[] = editor ? [editor] : ["alice", "bob"];
  const review = room?.review;
  const discovery = review?.discovery;
  const selectedIndex = selection && selection.reviewId === review?.id ? selection.index : 0;
  const witness = discovery?.witnesses[selectedIndex] || discovery?.witnesses[0];
  const dirty = Object.values(dirtyEditors).some(Boolean);
  const simulation = room?.simulation === "studio-fee-v1";
  const automatic = room?.automaticReview;
  const leaseExpired = automatic?.status === "running" && clock >= Date.parse(automatic.leaseExpiresAt);
  const modelRunning = automatic?.status === "running" && !leaseExpired;
  const needsRetry = automatic?.status === "failed" || leaseExpired;
  const callsRemaining = Math.max(0, (model?.maxCalls ?? 5) - (room?.modelCallCount ?? 0));
  const onDirty = useCallback((person: StudioEditor, value: boolean) => setDirtyEditors(current => current[person] === value ? current : { ...current, [person]: value }), []);
  const receive = useCallback((data: Partial<StudioResponse>) => {
    const current = latestRoom.current, incoming = data.room;
    if (incoming && current && (current.id !== incoming.id || incoming.revision < current.revision)) return false;
    if (incoming) { latestRoom.current = incoming; setRoom(incoming); }
    if (data.model) setModel(data.model);
    setClock(Date.now());
    return true;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoomId(params.get("room"));
    const person = params.get("editor");
    setEditor(person === "alice" || person === "bob" ? person : null);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false, polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try { const incoming = await request(`/api/studio/${encodeURIComponent(roomId)}`); if (!cancelled) { receive(incoming); setConnected(true); } }
      catch (e) { if (!cancelled) { setConnected(false); setError(e instanceof Error ? e.message : "Unable to connect."); } }
      finally { polling = false; }
    };
    void refresh();
    const timer = setInterval(refresh, 1300);
    return () => { cancelled = true; clearInterval(timer); };
  }, [roomId, receive]);
  const createRoom = async (kind: "blank" | "demo" | "simulation") => {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request("/api/studio", kind === "simulation" ? { simulation: true } : kind === "demo" ? { demo: true } : {}), incoming = data.room;
      latestRoom.current = incoming; setRoom(incoming); setModel(data.model ?? null); setRoomId(incoming.id); setEditor(null); setConnected(true); setTransfer(null); setSelection(null); setDirtyEditors({}); setDraftsOpen(kind !== "demo"); setRelayOpen(false); setClock(Date.now());
      window.history.replaceState({}, "", `/studio?room=${encodeURIComponent(incoming.id)}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create the room."); }
    finally { setBusy(false); }
  };
  const act: Act = useCallback(async action => {
    if (!roomId) throw new Error("Open a room first.");
    setError("");
    try { const incoming = await request(`/api/studio/${encodeURIComponent(roomId)}`, action); receive(incoming); return incoming.room; }
    catch (e) { if (latestRoom.current?.id === roomId && (!(e instanceof StudioRequestError) || receive(e.data))) setError(e instanceof Error ? e.message : "The change could not be saved."); throw e; }
  }, [roomId, receive]);
  const prepareReview = async () => {
    setBusy(true); setNotice("");
    try { await act({ type: "requestReview" }); setRelayOpen(true); setNotice("The saved drafts are ready for agent interpretation. No API request was made."); }
    catch { /* Shared alert displays the error. */ }
    finally { setBusy(false); }
  };
  const analyze = async () => {
    if (!roomId || busy || dirty || modelRunning || review) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request(`/api/studio/${encodeURIComponent(roomId)}/review`, { ...(simulation ? { simulation: true } : {}), ...(needsRetry ? { retry: true } : {}) });
      if (!receive(data)) return;
      if (data.automatic?.status === "superseded") setNotice("The drafts changed during review. That response was discarded; analyze the current saved drafts.");
      else if (data.automatic?.status === "completed") { setNotice(simulation ? "Simulated response validated through the adapter. Consequences computed; no external API calls or approvals." : "Meta’s interpretation passed validation. Review the consequences together before approving."); setDraftsOpen(false); }
    } catch (e) { if (latestRoom.current?.id === roomId && (!(e instanceof StudioRequestError) || receive(e.data))) setError(e instanceof Error ? e.message : "The review could not be completed. Retry explicitly when ready."); }
    finally { setBusy(false); }
  };
  const testWitness = () => {
    if (!witness) return;
    setTransfer(current => ({ token: (current?.token || 0) + 1, attendee: { ...witness.attendee } }));
    document.getElementById("studio-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const goTo = (id: string) => {
    if (id === "studio-drafts") setDraftsOpen(true);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const voteValues = review ? Object.values(review.votes) : [];
  const held = voteValues.length === 2 && voteValues[0] !== voteValues[1];
  const status = !connected ? "Reconnecting · local edits kept" : modelRunning ? (simulation ? "Simulated adapter review running" : "Meta is interpreting saved drafts") : leaseExpired ? "Review interrupted · explicit retry needed" : automatic?.status === "failed" ? "Review failed · published form unchanged" : review?.status === "published" ? `Agreed · live form v${room?.published.version}` : held ? "Different choices · publication held" : voteValues.length === 1 ? "One approval · waiting for the other editor" : review ? discovery?.status === "unresolved" ? "Clarification needed · publication held" : discovery?.status === "equivalent" ? "Same supported outcomes · both editors decide" : "Consequence found · both editors decide" : room?.activeJob ? "Saved draft snapshot ready for review" : "Write two policy drafts";

  return <main className="sps">
    <header className="sps-header"><a className="sps-brand" href="/studio"><span aria-hidden="true"><i /><i /></span>SamePage</a><div className="sps-header-meta"><span>Words → consequences</span><span className="sps-private"><LockKeyhole size={11} /> Private prototype</span></div></header>
    <div className="sps-intro"><div><p className="sps-eyebrow">Agree on what happens.</p><h1>The same words.<br className="sps-mobile-break" /> <em>A different outcome.</em></h1><p>Find who your policies treat differently. Resolve the meaning together. See the form change.</p></div>{room && <div className="sps-roomlinks" aria-label="Simulated editors"><span><Users size={12} /> Two simulated editors</span><div><a href={`/studio?room=${room.id}&editor=alice`} target="_blank" rel="noreferrer">Alice · EN <ExternalLink size={10} /></a><a href={`/studio?room=${room.id}&editor=bob`} target="_blank" rel="noreferrer">Bob · ES <ExternalLink size={10} /></a>{editor && <a href={`/studio?room=${room.id}`}>Combined view</a>}</div></div>}</div>
    {error && <p className="sps-alert error" role="alert">{error}</p>}
    {notice && <p className="sps-alert" role="status">{notice}</p>}
    {!ready || (roomId && !room && connected) ? <div className="sps-loading"><LoaderCircle size={18} className="sps-spin" /> Opening your room…</div> : !room ? <section className="sps-welcome">
      <div><p className="sps-eyebrow">A difference translation can miss</p><h2>Both people get in.<br />Only one gets the waiver.</h2><p>Eligibility is only half the story. A scholarship, a member discount, or the order of exceptions can change what someone actually pays.</p><button className="sps-button" disabled={busy} onClick={() => void createRoom("simulation")}>{busy ? <LoaderCircle size={15} className="sps-spin" /> : <Users size={15} />}Test with simulated editors <ArrowRight size={15} /></button><span className="sps-demo-note">Controlled model response through the adapter. No external API calls.</span><div className="sps-welcome-options"><button className="sps-textbutton" disabled={busy} onClick={() => void createRoom("blank")}>Start with your own policies <ArrowRight size={12} /></button><button className="sps-textbutton" disabled={busy} onClick={() => void createRoom("demo")}>Open the recorded demo <ArrowRight size={12} /></button></div></div>
      <div className="sps-welcome-visual" aria-label="Illustrative fee disagreement"><span className="sps-example-label">ONE PERSON · TWO INTERPRETATIONS</span><div className="sps-example-person"><UserRound size={23} /><div><strong>An adult with a scholarship</strong><span>Same application. Same facts.</span></div></div><div className="sps-example-prices"><div><span>English interpretation</span><strong>$80</strong><small>Youth-only waiver</small></div><div><span>Spanish interpretation</span><strong>$0</strong><small>All scholarship recipients</small></div></div><p>Illustrative consequence · the demo searches for an actual witness, then asks both editors which meaning they intended.</p></div>
    </section> : <>
      <nav className="sps-steps" aria-label="Demo steps"><div>{[{ label: "Write", id: "studio-drafts", done: Boolean(review) }, { label: "Discover", id: "studio-discovery", done: Boolean(discovery) }, { label: "Agree", id: "studio-agree", done: review?.status === "published" }, { label: "Try the form", id: "studio-form", done: room.registrations.length > 0 }].map((step, index) => <button key={step.id} onClick={() => goTo(step.id)}><span className={step.done ? "done" : ""}>{step.done ? <Check size={11} /> : index + 1}</span>{step.label}</button>)}</div><span className={`sps-connection ${held ? "held" : ""}`} role="status"><i />{status}</span></nav>
      <details className="sps-drafts" id="studio-drafts" open={draftsOpen || !review} onToggle={e => setDraftsOpen(e.currentTarget.open)}><summary><span><Globe2 size={15} /><strong>Two policies. One shared intent.</strong><small>{editor ? `${PEOPLE[editor].name}’s editor` : "English ↔ Español"}</small></span><ChevronDown size={15} /></summary><div className="sps-drafts-body"><div className={`sps-editor-grid ${editor ? "single" : ""}`}>{participants.map(person => <DraftEditor key={`${room.id}-${person}`} person={person} room={room} act={act} onDirty={onDirty} />)}</div><div className="sps-draft-actions"><div><p>{dirty ? "Save your edits before analyzing the policies." : simulation ? "This fixed example uses a controlled model response through the adapter. New wording needs live Meta or manual review; the simulation cannot interpret it." : "Meta interprets the words. The rule checker finds changed outcomes. Both editors decide what gets published."}</p><span className="sps-model-status">{simulation ? "Simulation · no credit use" : !model ? "Checking model availability…" : model.mode === "disabled" ? "Meta calls are paused on this site." : model.mode === "unconfigured" ? "Meta is not connected yet. A server API key is required." : `${model.model} · ${callsRemaining} of ${model.maxCalls} room requests remaining`}</span></div><button className="sps-button" disabled={busy || dirty || Boolean(review) || modelRunning || (!simulation && (!model?.ready || callsRemaining === 0))} onClick={() => void analyze()}>{busy || modelRunning ? <LoaderCircle size={13} className="sps-spin" /> : needsRetry ? <RefreshCw size={13} /> : <Search size={13} />}{modelRunning ? "Reviewing saved drafts…" : review ? "Edit a draft to review again" : needsRetry ? simulation ? "Retry simulated review" : "Retry with Meta" : simulation ? "Run simulated review" : "Analyze with Meta"}</button></div>{!simulation && model && !model.ready && <p className="sps-model-help">The site owner can connect Meta in Settings → Environment variables. Until live calls are enabled, use a simulation or the manual review tools below. No API calls are made by saving or opening a room.</p>}{!simulation && model?.ready && callsRemaining === 0 && <p className="sps-model-help">This room has reached its request limit. The limit counts attempts, including failures; it is not an account spending cap.</p>}{automatic?.status === "failed" && <p className="sps-review-problem" role="status">{automatic.error?.message || "The review failed. Your saved drafts and published form are unchanged."} No automatic retry will run.</p>}{leaseExpired && <p className="sps-review-problem" role="status">The review did not finish in time. An explicit retry starts a new request; a late response cannot update the form.</p>}{automatic?.status === "superseded" && !review && <p className="sps-model-help" role="status">An earlier review was discarded because the drafts changed. Analyze the latest saved versions.</p>}</div></details>
      <div className="sps-workspace">
        <section className="sps-finding" id="studio-discovery" aria-label="Discovered consequences"><div className="sps-finding-head"><p className="sps-eyebrow"><Search size={12} />{discovery?.status === "different" ? "A consequence you didn’t supply" : "Compare the consequences"}</p><h2>{witness?.kind === "price-only" ? `Eligible either way. ${money(Math.abs(witness.feeDeltaCents || 0))} apart.` : witness ? "Same person. Different answer." : discovery?.status === "equivalent" ? "Different wording. Same outcomes." : discovery?.status === "unresolved" ? "A question before a decision." : "Start with the words."}</h2><p>{witness?.kind === "price-only" ? "A yes/no check would miss this. The interpretations agree on admission and disagree on the fee." : witness ? "SamePage found this person by comparing the interpreted rules. You don’t have to know which edge case to ask about." : discovery?.status === "equivalent" ? "The interpreted rules agree within this prototype’s supported conditions. Both editors still need to confirm the meaning." : discovery?.status === "unresolved" ? "A condition is ambiguous or unsupported. Clarify it before publishing; the current form stays unchanged." : "Save both drafts and run a review. The rule engine will then search for differences in admission and fees."}</p><span className="sps-provenance">{review?.provenance === "meta-model" ? `Meta interpretation · ${automatic?.model || model?.model || "configured model"}` : review?.provenance === "simulated-model" ? "Simulated provider response · adapter validated · no external API calls" : review?.provenance === "fixture-replay" ? "Recorded demo interpretation · no API calls" : review ? "Manual agent relay · no site API calls" : simulation ? "Simulation ready · no external API calls" : "Waiting for a validated interpretation"}</span></div>
          {discovery && discovery.witnesses.length > 1 && <div className="sps-witness-tabs" aria-label="Discovered people">{discovery.witnesses.map((item, index) => <button key={item.id} className={index === selectedIndex ? "selected" : ""} aria-pressed={index === selectedIndex} onClick={() => setSelection({ reviewId: review!.id, index })}>{index + 1}<span>{witnessLabel(item)}</span></button>)}</div>}
          {witness && <><div className="sps-person"><div className="sps-person-head"><span className="sps-person-icon"><UserRound size={21} /></span><div><span className="sps-overline">The person SamePage found</span><h3>{witness.attendee.age}-year-old {witness.attendee.resident ? "resident" : "nonresident"}</h3></div></div><div className="sps-chips">{FLAGS.filter(flag => flag.key !== "resident").map(flag => <span className={witness.attendee[flag.key] ? "positive" : ""} key={flag.key}>{witness.attendee[flag.key] ? <Check size={10} /> : null}{witness.attendee[flag.key] ? flag.label : flag.negative}</span>)}</div><span className="sps-person-time">Applied {timeLabel(witness.attendee.submittedAt)}</span></div><div className="sps-outcomes">{review!.candidates.slice(0, 2).map((candidate, index) => <Outcome key={candidate.id} candidate={candidate} decision={index === 0 ? witness.left : witness.right} />)}</div><p className="sps-explanation">{witness.explanation.en}</p><div className="sps-transfer"><span>Put exactly this person through the working form.</span><button className="sps-button secondary" onClick={testWitness}>Use this person <ArrowRight size={13} /></button></div></>}
          {discovery?.status === "unresolved" && <div className="sps-unresolved">{discovery.issues.map((issue, index) => <p key={index}>{issue}</p>)}{review?.candidates.map(candidate => <div key={candidate.id}><strong>{PEOPLE[candidate.editor].name}’s interpretation</strong>{candidate.issues.map((issue, index) => <p key={index}>{issue}</p>)}</div>)}</div>}
          {!witness && review && discovery?.status !== "unresolved" && <div className="sps-equivalent"><ShieldCheck size={25} /><p>No difference was found in eligibility or fees across the supported rule domain.</p></div>}
          {!review && <div className="sps-waiting"><Globe2 size={29} /><p>{modelRunning ? "Interpreting the saved draft snapshot. You can keep editing; any response for an older version will be discarded." : room.activeJob ? "The saved draft snapshot is ready. Run the review above, or use the manual review tools below." : "Your current published policy stays in force while the new wording is reviewed."}</p>{room.activeJob && !modelRunning && <button className="sps-textbutton" onClick={() => { setRelayOpen(true); goTo("studio-tools"); }}>Open agent review tools <ArrowRight size={12} /></button>}</div>}
          {review && <section className="sps-agreement" id="studio-agree" aria-label="Joint approval"><div className="sps-agreement-title"><h3><Users size={15} />Which meaning do you both intend?</h3><span>{review.status === "published" ? `Published as v${room.published.version}` : `Form held at v${room.published.version}`}</span></div>{review.status === "published" ? <div className="sps-published"><CheckCircle2 size={19} /><div><strong>Both editors approved the same interpretation.</strong><p>The bilingual policy and registration form now use version {room.published.version}. Existing receipts keep their original version.</p></div></div> : <><details className="sps-meaning"><summary>Read both interpretations before approving</summary>{review.candidates.map(candidate => <article key={candidate.id}><strong>{PEOPLE[candidate.editor].name}’s meaning</strong><p lang="en">{candidate.en}</p><p lang="es">{candidate.es}</p></article>)}</details><div className={`sps-voters ${editor ? "single" : ""}`}>{participants.map(person => <Voter key={person} person={person} room={room} act={act} />)}</div><p className={`sps-hold ${held ? "conflict" : ""}`} role="status"><LockKeyhole size={12} />{review.discovery.status === "unresolved" ? "Clarify the unresolved conditions before either editor can approve." : held ? "Different choices. Nothing publishes until both choose the same interpretation." : voteValues.length === 1 ? "One approval received. The form is unchanged until the other editor agrees." : "Both editors must choose the same interpretation. No automatic publication."}</p></>}</section>}
        </section>
        <RegistrationForm key={room.id} room={room} act={act} transfer={transfer} />
      </div>
      <details className="sps-inspect"><summary><FileCheck2 size={13} /> Inspect the agreed policy, rule trace, and search scope <ChevronDown size={13} /></summary><div className="sps-inspect-body"><div className="sps-published-docs"><article><h3>English · policy v{room.published.version}</h3><p>{room.published.en}</p></article><article lang="es"><h3>Español · política v{room.published.version}</h3><p>{room.published.es}</p></article></div>{discovery && <p className="sps-scope">Checked {discovery.checkedCases.toLocaleString()} representative cases across {discovery.coverage.agePartitions} age partitions, {discovery.coverage.flagCombinations} flag combinations, and {discovery.coverage.timePartitions} time partitions. {discovery.coverage.scope}</p>}<p className="sps-scope">Supported: nested eligibility conditions; age; residency, student, membership, guardian-consent and scholarship flags; explicit UTC times; fixed USD fees and ordered fee exceptions. Capacity, household rules, real payments, and unrestricted policy language are outside this prototype. Agent interpretation still needs human review.</p>{witness && <div className="sps-traces">{[{ name: "English interpretation", decision: witness.left }, { name: "Spanish interpretation", decision: witness.right }].map(item => <article key={item.name}><h3>{item.name}</h3>{item.decision.trace.map((trace, index) => <p key={index} className={trace.passed ? "pass" : "fail"}>{trace.passed ? "✓" : "×"} {trace.en}</p>)}</article>)}</div>}</div></details>
      <AgentTools room={room} act={act} open={relayOpen} setOpen={setRelayOpen} busy={busy} dirty={dirty} prepareReview={prepareReview} />
      <div className="sps-room-footer"><span>Synthetic attendees · fee simulation only · no payments or emails</span><button className="sps-textbutton" disabled={busy} onClick={() => void createRoom("simulation")}><RefreshCw size={11} />New simulated test</button><button className="sps-textbutton" disabled={busy} onClick={() => void createRoom("demo")}>New recorded demo</button><button className="sps-textbutton" disabled={busy} onClick={() => void createRoom("blank")}>New blank room <ArrowRight size={11} /></button></div>
    </>}
    <footer className="sps-footer"><span>SamePage / meaning made testable</span><span><a href="/consequences">Earlier policy lab</a><a href="/">Document collaboration</a></span></footer>
  </main>;
}

function DraftEditor({ person, room, act, onDirty }: { person: StudioEditor; room: StudioRoom; act: Act; onDirty: (person: StudioEditor, dirty: boolean) => void }) {
  const saved = room.drafts[person];
  const [draft, setDraft] = useState({ text: saved.text, baseVersion: saved.version, dirty: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(current => current.dirty ? current : { text: saved.text, baseVersion: saved.version, dirty: false }); }, [saved.text, saved.version]);
  useEffect(() => { onDirty(person, draft.dirty); }, [person, draft.dirty, onDirty]);
  const save = async () => {
    const sent = draft; setSaving(true);
    try { const incoming = await act({ type: "draft", editor: person, baseVersion: sent.baseVersion, text: sent.text }); const currentSaved = incoming.drafts[person]; setDraft(current => current.text === sent.text ? { text: currentSaved.text, baseVersion: currentSaved.version, dirty: false } : { ...current, baseVersion: currentSaved.version }); }
    catch { /* Shared alert displays the error. */ }
    finally { setSaving(false); }
  };
  return <article className="sps-editor" lang={PEOPLE[person].language}><header><span className={`sps-avatar ${person}`}>{PEOPLE[person].name[0]}</span><div><strong>{PEOPLE[person].name}</strong><span>{PEOPLE[person].label} · simulated editor</span></div><small>Draft {saved.version}</small></header><label className="sps-sr-only" htmlFor={`studio-${person}-draft`}>{PEOPLE[person].name} policy draft</label><textarea id={`studio-${person}-draft`} value={draft.text} onChange={e => setDraft(current => ({ ...current, text: e.target.value, dirty: true }))} spellCheck={false} /><div className="sps-editor-foot"><span>{draft.dirty ? "Unsaved changes · kept while others edit" : "Saved to shared room"}</span><button className="sps-button secondary" onClick={() => void save()} disabled={saving || !draft.dirty || !draft.text.trim()}>{saving ? <LoaderCircle size={12} className="sps-spin" /> : <Check size={12} />}Save {PEOPLE[person].name} draft</button></div>{draft.dirty && draft.baseVersion !== saved.version && !saving && <p className="sps-stale">This saved draft changed in another tab. Copy your local text before <button onClick={() => setDraft({ text: saved.text, baseVersion: saved.version, dirty: false })}>reloading the saved draft</button>.</p>}</article>;
}

function Outcome({ candidate, decision }: { candidate: StudioCandidate; decision: StudioDecision }) {
  return <article className={`sps-outcome ${decision.accepted ? "accepted" : "rejected"}`}><header><span>{PEOPLE[candidate.editor].name}’s interpretation</span><small>{PEOPLE[candidate.editor].label}</small></header><div className="sps-outcome-main"><span className="sps-admission">{decision.accepted ? <CheckCircle2 size={13} /> : <LockKeyhole size={13} />}{decision.accepted ? "Eligible" : "Not eligible"}</span><strong>{decision.accepted ? money(decision.feeCents) : "No admission"}</strong><span>{decision.accepted ? "Fee under this policy · USD" : "Registration cannot proceed"}</span></div><p>{decision.accepted ? decision.feeReason.en : decision.reasons.map(reason => reason.en).join(" ")}</p><details><summary>Read the interpreted policy</summary><p>{candidate.en}</p><p lang="es">{candidate.es}</p></details></article>;
}

function Voter({ person, room, act }: { person: StudioEditor; room: StudioRoom; act: Act }) {
  const [busy, setBusy] = useState(false);
  const review = room.review!;
  const choice = review.votes[person];
  const vote = async (candidateId: string) => { setBusy(true); try { await act({ type: "vote", editor: person, reviewId: review.id, candidateId }); } catch { /* Shared alert displays the error. */ } finally { setBusy(false); } };
  return <article className="sps-voter"><header><strong>{PEOPLE[person].name}’s approval</strong><span>{choice ? "Choice saved" : "No choice yet"}</span></header><div>{review.candidates.map(candidate => <button key={candidate.id} aria-label={`${PEOPLE[person].name} approve ${PEOPLE[candidate.editor].name} interpretation`} aria-pressed={choice === candidate.id} className={choice === candidate.id ? "selected" : ""} disabled={busy || review.discovery.status === "unresolved" || !candidate.rules || Boolean(candidate.issues.length)} onClick={() => void vote(candidate.id)}>{choice === candidate.id ? <CheckCircle2 size={13} /> : <span className="sps-choice-dot" />}<span>{PEOPLE[candidate.editor].name}’s meaning<small>{review.discovery.status !== "unresolved" && candidate.rules && !candidate.issues.length ? (person === "bob" ? candidate.es : candidate.en) : "Needs clarification"}</small></span></button>)}</div></article>;
}

function RegistrationForm({ room, act, transfer }: { room: StudioRoom; act: Act; transfer: Transfer | null }) {
  const [fields, setFields] = useState<Fields>(INITIAL_FIELDS);
  const [label, setLabel] = useState("Demo attendee");
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const pendingRegistration = useRef<Extract<StudioAction, { type: "register" }> | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  useEffect(() => { if (transfer) { setFields(toFields(transfer.attendee)); setLabel("Discovered attendee"); pendingRegistration.current = null; setRetryPending(false); } }, [transfer]);
  const attendee = toAttendee(fields);
  const preview = attendee ? evaluateStudioPolicy(room.published.rules, attendee) : null;
  const receipt = room.registrations.find(item => item.id === receiptId);
  const lastReceipts = [...room.registrations].reverse().slice(0, 3);
  const edit = <K extends keyof Fields>(field: K, value: Fields[K]) => { setFields(current => ({ ...current, [field]: value })); pendingRegistration.current = null; setRetryPending(false); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!attendee || busy) return; setBusy(true);
    const submitted = pendingRegistration.current || { type: "register" as const, requestId: crypto.randomUUID(), policyVersion: room.published.version, label: label.trim() || "Demo attendee", ...attendee };
    pendingRegistration.current = submitted;
    try {
      const incoming = await act(submitted);
      setReceiptId(incoming.registrations.find(item => item.requestId === submitted.requestId)?.id || null);
      if (pendingRegistration.current === submitted) { pendingRegistration.current = null; setRetryPending(false); }
    } catch {
      // Keep every submitted field stable across a lost response and later policy changes.
      if (pendingRegistration.current === submitted) setRetryPending(true);
    } finally { setBusy(false); }
  };
  return <aside className="sps-form-column" id="studio-form"><form className="sps-form" onSubmit={event => void submit(event)}><header><div><p className="sps-overline">The working registration form</p><h2>What actually happens.</h2></div><span className="sps-version">{room.published.reviewId ? "LIVE" : "EXAMPLE"} v{room.published.version}</span></header><div className="sps-form-body"><p className="sps-form-note">{room.published.reviewId ? "Uses the jointly approved policy. Every result saves its policy version." : "Initial example policy: everyone eligible, no fee. Joint approval replaces it."}</p><div className="sps-form-row"><label><span>Attendee label</span><input value={label} onChange={e => { setLabel(e.target.value); pendingRegistration.current = null; setRetryPending(false); }} maxLength={80} aria-label="Registration attendee label" /></label><label className="sps-age"><span>Age</span><input type="number" min="0" max="120" step="1" value={fields.age} onChange={e => edit("age", e.target.value)} aria-label="Registration age" /></label></div><div className="sps-flags">{FLAGS.map(flag => <label key={flag.key}><input type="checkbox" checked={fields[flag.key]} onChange={e => edit(flag.key, e.target.checked)} /><span>{flag.label}</span></label>)}</div><label className="sps-date"><span>Application time · UTC</span><input type="datetime-local" step="0.001" value={fields.time} onChange={e => edit("time", e.target.value)} aria-label="Registration time UTC" /></label>{!attendee && <p className="sps-form-error">Use a whole-number age from 0 to 120 and a valid UTC date and time.</p>}<div className="sps-form-preview"><span>{room.published.reviewId ? "Agreed policy" : "Initial example policy"} v{room.published.version}</span><strong>{preview ? outcomeLabel(preview) : "Complete the attendee details"}</strong><small>{preview ? preview.accepted ? preview.feeReason.en : preview.reasons.map(reason => reason.en).join(" ") : "Preview only; submit to save a receipt."}</small></div><>{retryPending && pendingRegistration.current && <p className="sps-retry-note" role="status">This submission is not confirmed. Retry checks the same request under policy v{pendingRegistration.current.policyVersion}. Edit attendee details to start a new test.</p>}</><button className="sps-submit" type="submit" disabled={busy || !attendee}>{busy ? <LoaderCircle size={14} className="sps-spin" /> : <FileCheck2 size={14} />}{retryPending ? "Retry this submission" : "Submit test registration"} <ArrowRight size={14} /></button><span className="sps-no-payment">Simulation only · no payment is taken</span>{receipt && <div className={`sps-receipt-confirm ${receipt.decision.accepted ? "" : "rejected"}`} role="status"><CheckCircle2 size={15} /><div><strong>Receipt saved · policy v{receipt.policyVersion}</strong><span>{outcomeLabel(receipt.decision)}{receipt.policyVersion !== room.published.version ? " · earlier policy preserved" : ""}</span></div></div>}</div></form><section className="sps-receipts" aria-label="Versioned registration receipts"><h3>Receipts keep the evidence.<span>{room.registrations.length} saved</span></h3>{lastReceipts.length ? lastReceipts.map(item => <Receipt key={item.id} receipt={item} />) : <p>Use the discovered person before and after joint approval to compare real form outcomes.</p>}</section></aside>;
}
function Receipt({ receipt }: { receipt: StudioRegistration }) { return <article className="sps-receipt"><div><strong>{receipt.label}</strong><span>v{receipt.policyVersion}</span></div><p className={receipt.decision.accepted ? "pass" : "fail"}>{outcomeLabel(receipt.decision)}</p><small>{receipt.age} years · {receipt.resident ? "resident" : "nonresident"} · {timeLabel(receipt.submittedAt)}</small><details><summary>Attendee facts and receipt</summary><p>{FLAGS.map(flag => `${flag.label}: ${receipt[flag.key] ? "yes" : "no"}`).join(" · ")}</p><span>Simulation · no payment</span><code>{receipt.id}</code></details></article>; }

function AgentTools({ room, act, open, setOpen, busy, dirty, prepareReview }: { room: StudioRoom; act: Act; open: boolean; setOpen: (open: boolean) => void; busy: boolean; dirty: boolean; prepareReview: () => Promise<void> }) {
  const [response, setResponse] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const complete = async () => { setImporting(true); setError(""); setMessage(""); try { const parsed: unknown = JSON.parse(response); await act({ type: "completeReview", response: parsed }); setResponse(""); setMessage("Interpretation validated. Consequences were computed from the rules; no votes were cast."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to import the response."); } finally { setImporting(false); } };
  const copy = async () => { if (!room.activeJob) return; try { await navigator.clipboard.writeText(room.activeJob.prompt); setMessage("Exact prompt copied."); } catch { setMessage("Select and copy the exact prompt below."); } };
  return <details className="sps-tools" id="studio-tools" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Advanced review tools · manual relay <ChevronDown size={13} /></summary><div><p>Manual fallback: give the exact saved-draft prompt to an agent and import its fresh JSON response. These controls make no model API calls. Importing a response supersedes any in-flight automatic review; approval remains a separate step.</p>{!room.activeJob && !room.review && <button className="sps-button secondary" disabled={busy || dirty} onClick={() => void prepareReview()}>Prepare exact review prompt</button>}{room.activeJob && <><label htmlFor="studio-review-prompt">Exact agent prompt</label><textarea id="studio-review-prompt" readOnly value={room.activeJob.prompt} /><button className="sps-textbutton" onClick={() => void copy()}><Copy size={12} />Copy prompt</button><label htmlFor="studio-review-response">Fresh agent JSON response</label><textarea id="studio-review-response" value={response} onChange={e => setResponse(e.target.value)} spellCheck={false} placeholder='{"jobId":"…","candidates":[…]}' /><button className="sps-button secondary" disabled={importing || !response.trim()} onClick={() => void complete()}>{importing ? <LoaderCircle size={12} className="sps-spin" /> : <Check size={12} />}Validate interpretation & find consequences</button></>}{error && <p role="alert" className="sps-tool-error">{error}</p>}{message && <p role="status">{message}</p>}</div></details>;
}
