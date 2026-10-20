"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Circle, CircleHelp, Copy, ExternalLink, FileCheck2, GitCompareArrows, Globe2, Link2, LoaderCircle, LockKeyhole, Radio, RefreshCw, Send, ShieldCheck, SlidersHorizontal, UserRound, Users, XCircle } from "lucide-react";
import { evaluatePolicy, summarizePolicy } from "../../lib/consequences";
import type { ConsequencesAction, ConsequencesRoom, EditorId, PolicyAttendee, PolicyCandidate, PolicyDecision, PolicyRegistration, PolicyRules } from "../../lib/consequences-types";
import "./consequences.css";

const PEOPLE: Record<EditorId, { name: string; language: "en" | "es"; label: string }> = {
  alice: { name: "Alice", language: "en", label: "English" },
  bob: { name: "Bob", language: "es", label: "Español" },
};
const DEFAULT_TIME = "2026-11-05T17:00";
type RoomResponse = { room: ConsequencesRoom };
type Act = (action: ConsequencesAction) => Promise<ConsequencesRoom>;

async function request(url: string, body?: unknown): Promise<RoomResponse> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as RoomResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "The room could not be updated. Please try again.");
  return data as RoomResponse;
}

function attendeeFromFields(age: string, resident: string, time: string): PolicyAttendee | null {
  if (!/^\d{1,3}$/.test(age) || Number(age) > 120 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time)) return null;
  const date = new Date(`${time}Z`);
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(time)) return null;
  return { age: Number(age), resident: resident === "yes", submittedAt: date.toISOString() };
}

function displayTime(value: string) { return `${value.slice(0, 10)} · ${value.slice(11, 19)} UTC`; }
function personLabel(attendee: PolicyAttendee) { return `${attendee.age} years old · ${attendee.resident ? "neighborhood resident" : "nonresident"}`; }

export default function ConsequencesPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorId | null>(null);
  const [room, setRoom] = useState<ConsequencesRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [age, setAge] = useState("17");
  const [resident, setResident] = useState("no");
  const [time, setTime] = useState(DEFAULT_TIME);
  const attendee = attendeeFromFields(age, resident, time);
  const participants: EditorId[] = editor ? [editor] : ["alice", "bob"];

  const receiveRoom = useCallback((incoming: ConsequencesRoom) => setRoom(current => !current || (current.id === incoming.id && incoming.revision >= current.revision) ? incoming : current), []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoomId(params.get("room"));
    const persona = params.get("editor");
    setEditor(persona === "alice" || persona === "bob" ? persona : null);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try { const data = await request(`/api/consequences/${encodeURIComponent(roomId)}`); if (!cancelled) { receiveRoom(data.room); setConnected(true); } }
      catch (e) { if (!cancelled) { setConnected(false); setError(e instanceof Error ? e.message : "Unable to connect to the room."); } }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(refresh, 1200);
    return () => { cancelled = true; clearInterval(timer); };
  }, [roomId, receiveRoom]);

  const createRoom = async () => {
    setCreating(true); setError(""); setNotice("");
    try {
      const data = await request("/api/consequences", {});
      setRoom(data.room); setRoomId(data.room.id); setEditor(null); setConnected(true);
      window.history.replaceState({}, "", `/consequences?room=${encodeURIComponent(data.room.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create a room."); }
    finally { setCreating(false); }
  };

  const act: Act = useCallback(async action => {
    if (!roomId) throw new Error("Create a room first.");
    setError("");
    try { const data = await request(`/api/consequences/${encodeURIComponent(roomId)}`, action); receiveRoom(data.room); return data.room; }
    catch (e) { setError(e instanceof Error ? e.message : "The action could not be saved."); throw e; }
  }, [roomId, receiveRoom]);

  const requestReview = async () => {
    setWorking(true); setNotice("");
    try { await act({ type: "requestReview" }); setNotice("Review prompt is ready. Open Agent relay below to transfer it to a fresh agent, then import the response."); }
    catch { /* The shared error is shown above the workspace. */ }
    finally { setWorking(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/consequences?room=${roomId}`); setNotice("Shared room link copied. Both editor tabs use this same room."); }
    catch { setNotice("Copy the room address from your browser to share this private room."); }
  };

  const publishedDecision = room && attendee ? evaluatePolicy(room.published.rules, attendee) : null;
  const review = room?.review;
  const candidateDecisions = review?.candidates.map(candidate => candidate.rules && !candidate.issues.length && attendee ? evaluatePolicy(candidate.rules, attendee) : null) || [];
  const hasDifference = candidateDecisions.length > 1 && candidateDecisions.every(Boolean) && candidateDecisions.some(decision => decision!.accepted !== candidateDecisions[0]!.accepted);

  return <main className="sp3">
    <header className="sp3-topbar">
      <a href="/" className="sp3-brand" aria-label="SamePage home"><span className="sp3-brand-mark" aria-hidden="true"><i /><i /></span>SamePage</a>
      <div className="sp3-topbar-right"><span className="sp3-experiment">MEANING → CONSEQUENCES / 03</span><span className="sp3-badge"><Users size={11} /> Two simulated editors</span></div>
    </header>
    <section className="sp3-hero">
      <div><p className="sp3-kicker">A shared policy. A real consequence.</p><h1>One word changes<br /><em>who gets through.</em></h1><p className="sp3-hero-copy">Write together in two languages. See what each interpretation would do to the same person. Agree on the meaning—and the registration form follows.</p></div>
      {room && <div className="sp3-room-tools"><span className="sp3-room-code">ROOM {room.id.replace(/^consequence-/, "").slice(0, 8).toUpperCase()} · REV {room.revision}</span><div className="sp3-links"><a className="sp3-link" href={`/consequences?room=${room.id}&editor=alice`} target="_blank" rel="noreferrer">Alice · EN <ExternalLink size={10} /></a><a className="sp3-link" href={`/consequences?room=${room.id}&editor=bob`} target="_blank" rel="noreferrer">Bob · ES <ExternalLink size={10} /></a>{editor ? <a className="sp3-link" href={`/consequences?room=${room.id}`}>Both editors</a> : <button className="sp3-link" onClick={copyLink} aria-label="Copy shared room link"><Link2 size={12} /></button>}</div></div>}
    </section>
    {error && <p className="sp3-error" role="alert">{error}</p>}
    {notice && (!notice.startsWith("Review prompt is ready") || room?.activeJob) && <p className="sp3-notice" role="status">{notice}</p>}
    {!ready || (roomId && !room && connected) ? <div className="sp3-loading"><LoaderCircle size={17} className="sp3-spin" /> Opening the shared room…</div> : !room ? <section className="sp3-empty">
      <div className="sp3-empty-main"><p className="sp3-kicker">The consequences experiment</p><h2>Translation is only<br />the beginning.</h2><p>Alice and Bob are writing the rules for a neighborhood workshop. One says “and.” The other says “or.” That tiny difference changes who can register.</p><button className="sp3-btn" onClick={createRoom} disabled={creating}>{creating ? <LoaderCircle className="sp3-spin" size={14} /> : <Users size={14} />}{creating ? "Creating room…" : "Create a consequences room"}<ArrowRight size={14} /></button></div>
      <div className="sp3-empty-demo"><p className="sp3-example-person">Meet our attendee.<br />17 years old. Not a resident.</p><div className="sp3-example-line"><span>16 or older <b>and</b> a resident</span><strong className="sp3-fail-fill">REJECTED</strong></div><div className="sp3-example-line"><span>16 or older <b>or</b> a resident</span><strong className="sp3-pass-fill">ACCEPTED</strong></div><p className="sp3-example-foot">Illustrative example, before the deadline. In the live room, fresh agent responses produce proposed rules. Both editors must confirm before the working form changes.</p></div>
    </section> : <>
      <div className="sp3-status" role="status"><div className="sp3-status-main"><Radio size={14} /><span><strong>{!connected ? "Connection interrupted" : review?.status === "published" ? `Both editors agreed · form now uses version ${room.published.version}` : room.activeJob ? "Review requested · waiting for manual agent relay" : review ? "Two interpretations · a shared decision is needed" : "Shared room is live · propose the next policy"}</strong><span>{!connected ? " · Your unsent text is preserved." : ` · Published policy v${room.published.version}`}</span></span></div><span>Model connection: manual</span></div>

      <section className="sp3-lab" aria-label="Consequence comparison">
        <div className="sp3-lab-header"><div><p className="sp3-kicker">01 / See the difference</p><h2>{hasDifference ? "Same attendee. Different outcome." : review ? "Try the rule on a real edge case." : "Who would your words let in?"}</h2><p>{review ? "Change this attendee’s details. Each proposed rule is evaluated immediately; the live form still uses the last agreed policy." : "Set up a synthetic attendee, then review both editors’ policies. You’ll see the consequences side by side."}</p></div><span className={`sp3-lab-state ${publishedDecision && !publishedDecision.accepted ? "warn" : ""}`}>{publishedDecision?.accepted ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}Live form v{room.published.version}{publishedDecision ? ` · ${publishedDecision.accepted ? "accepts" : "rejects"}` : ""}</span></div>
        <div className="sp3-attendee"><div className="sp3-attendee-intro"><span className="sp3-person-icon"><UserRound size={18} /></span><div><strong>Your test attendee</strong><p>Change any detail. This preview saves no registration.</p></div></div><div className="sp3-attendee-fields"><label className="sp3-field"><span>Age</span><input aria-label="Test attendee age" type="number" min="0" max="120" step="1" value={age} onChange={e => setAge(e.target.value)} /></label><label className="sp3-field"><span>Neighborhood resident</span><select aria-label="Test attendee residency" value={resident} onChange={e => setResident(e.target.value)}><option value="no">No · nonresident</option><option value="yes">Yes · resident</option></select></label><label className="sp3-field"><span>Registration time · UTC</span><input aria-label="Test attendee registration time UTC" type="datetime-local" step="1" value={time} onChange={e => setTime(e.target.value)} /></label></div></div>
        {!attendee && <p className="sp3-fields-error">Enter a whole-number age from 0 to 120 and a valid date and time in UTC.</p>}
        {review ? <>
          <div className="sp3-outcomes">{review.candidates.map((candidate, index) => <Outcome key={candidate.id} candidate={candidate} decision={candidateDecisions[index]} />)}</div>
          <div className="sp3-lab-explainer"><CircleHelp size={13} /><span>{hasDifference ? "The wording looks similar, but this person gets a different answer. Compare the executable rules and both translations before you confirm." : "Matching results for one attendee do not make the policies equivalent. Try younger ages, a different residency status, or the deadline boundary."} {review.candidates.some(candidate => candidate.issues.length || !candidate.rules) ? "Unresolved clauses cannot be approved or executed." : ""}</span></div>
          {review.status === "open" ? <div className={`sp3-consensus ${editor ? "single" : ""}`}>{participants.map(person => <Voter key={person} editor={person} room={room} act={act} />)}</div> : <div className="sp3-published-banner"><CheckCircle2 size={20} /><div><strong>Both editors confirmed the same meaning.</strong><br />The English policy, Spanish policy, and working form now share version {room.published.version}.</div></div>}
        </> : <div className="sp3-lab-placeholder"><div><h3>Start with the words.<br />Then make the difference visible.</h3><p>{room.activeJob ? "The review prompt is ready in Agent relay below. Import a fresh response to compare the two proposed meanings." : "Send Alice’s English policy and Bob’s Spanish policy below, then request a fresh review. Existing registrations keep their original policy version."}</p></div><div className="sp3-current-outcome"><span>Published rule · version {room.published.version}</span><strong className={publishedDecision?.accepted ? "sp3-pass" : "sp3-fail"}>{publishedDecision ? publishedDecision.accepted ? "Accepted" : "Rejected" : "Complete attendee details"}</strong><p>{summarizePolicy(room.published.rules)}</p></div></div>}
      </section>

      <div className="sp3-bottom-grid"><section><div className="sp3-section-heading"><h2><Globe2 size={13} /> 02 / Write in your language</h2><span>{editor ? `${PEOPLE[editor].name}’s simulated editor` : "Two editors · one room"}</span></div><div className={`sp3-editors ${editor ? "single" : ""}`}>{participants.map(person => <DraftEditor key={`${room.id}-${person}`} editor={person} room={room} act={act} />)}</div><div className="sp3-editor-tools"><p>Only saved drafts enter the review. Changing either draft resets prior votes. Supported: age, residency and a deadline in UTC.</p><button className="sp3-btn-secondary" onClick={requestReview} disabled={working || Boolean(room.activeJob) || Boolean(room.review)}>{working ? <LoaderCircle size={12} className="sp3-spin" /> : <GitCompareArrows size={12} />}{room.activeJob ? "Review prompt ready" : room.review ? "Edit a draft to review again" : "Request a fresh review"}</button></div></section><RegistrationForm key={room.id} room={room} act={act} /></div>

      <section aria-label="Published policy in both languages"><div className="sp3-section-heading"><h2><FileCheck2 size={13} /> Published policy</h2><span>Version {room.published.version} · this is what the form enforces</span></div><div className="sp3-published-docs"><article lang="en"><h3>English · agreed</h3><p>{room.published.en}</p></article><article lang="es"><h3>Español · acordado</h3><p>{room.published.es}</p></article></div></section>

      <section className="sp3-audit" aria-label="Registration audit"><div className="sp3-section-heading"><h2><ShieldCheck size={13} /> Registration receipts</h2><span>{room.registrations.length} saved · decisions keep their original version</span></div>{room.registrations.length ? <div className="sp3-audit-list">{[...room.registrations].reverse().slice(0, 6).map(registration => <article className="sp3-audit-item" key={registration.id}><div><strong>{registration.label}</strong><span className={registration.decision.accepted ? "sp3-pass" : "sp3-fail"}>{registration.decision.accepted ? "Accepted" : "Rejected"}</span></div><p>{personLabel(registration)}<br />{displayTime(registration.submittedAt)}</p><small>Policy v{registration.policyVersion} · receipt {registration.id}</small></article>)}</div> : <p className="sp3-audit-empty">No registrations yet. Submit the working form to save a versioned result.</p>}</section>
      <AgentRelay room={room} act={act} requestReview={requestReview} working={working} />
      <div className="sp3-section-heading"><span><LockKeyhole size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Private prototype · synthetic attendees · no emails are sent</span><button className="sp3-btn-quiet" onClick={createRoom} disabled={creating}><RefreshCw size={10} /> Start a new room</button></div>
    </>}
    <footer className="sp3-footer"><span>SamePage / a bilingual collaboration experiment<br />AI proposes the interpretation. People confirm it. Code evaluates the agreed rule.</span><span>Age · residency · UTC deadline<br /><a href="/">Open the document collaboration lab</a></span></footer>
  </main>;
}

function RuleSummary({ rules }: { rules: PolicyRules }) {
  const hasAge = rules.minAge !== null;
  return <div className="sp3-outcome-rule">{hasAge ? <span>Age {rules.minAge}+</span> : null}{hasAge && rules.residentRequired ? <span className="sp3-operator">{rules.join === "all" ? "AND" : "OR"}</span> : null}{rules.residentRequired ? <span>Neighborhood resident</span> : null}{!hasAge && !rules.residentRequired ? "No age or residency restriction" : null}<small>{rules.deadline ? `${rules.deadlineInclusive ? "On or before" : "Before"} ${displayTime(rules.deadline)}` : "No registration deadline"}</small></div>;
}

function Outcome({ candidate, decision }: { candidate: PolicyCandidate; decision: PolicyDecision | null | undefined }) {
  const held = !candidate.rules || candidate.issues.length > 0;
  return <article className="sp3-outcome" aria-label={`${PEOPLE[candidate.editor].name} proposed outcome`}><div className="sp3-outcome-header"><strong>{PEOPLE[candidate.editor].name}’s interpretation</strong><span>{candidate.editor === "alice" ? "EN → ES" : "ES → EN"} · DRAFT {candidate.sourceVersion}</span></div><div className={`sp3-outcome-result ${held ? "sp3-hold" : decision?.accepted ? "sp3-pass" : "sp3-fail"}`}>{held ? <CircleHelp size={23} /> : decision?.accepted ? <CheckCircle2 size={23} /> : <XCircle size={23} />}<strong>{held ? "Unresolved" : decision ? decision.accepted ? "Accepted" : "Rejected" : "Check details"}</strong></div><ul className="sp3-outcome-reasons">{held ? <li>One or more clauses need a shared clarification.</li> : decision ? decision.reasons.map((reason, index) => <li key={index}>{reason}</li>) : <li>Complete the test attendee details above.</li>}</ul>{candidate.rules && !held && <RuleSummary rules={candidate.rules} />}<details className="sp3-outcome-source"><summary>Read both language versions</summary><p lang="en"><strong>EN</strong> · {candidate.en}</p><p lang="es"><strong>ES</strong> · {candidate.es}</p></details>{candidate.issues.map((issue, index) => <p className="sp3-issue" key={index}>{issue}</p>)}</article>;
}

function Voter({ editor, room, act }: { editor: EditorId; room: ConsequencesRoom; act: Act }) {
  const [busy, setBusy] = useState(false);
  const review = room.review!;
  const selected = review.votes[editor];
  const other: EditorId = editor === "alice" ? "bob" : "alice";
  const es = editor === "bob";
  const choose = async (candidate: PolicyCandidate) => {
    setBusy(true);
    try { await act({ type: "vote", editor, reviewId: review.id, candidateId: candidate.id }); }
    catch { /* The shared error is shown above the workspace. */ }
    finally { setBusy(false); }
  };
  return <div className="sp3-voter" lang={es ? "es" : "en"}><div className="sp3-voter-title">{PEOPLE[editor].name}{es ? " confirma" : " confirms"}<span>{selected ? es ? "Voto guardado" : "Vote saved" : es ? "Sin confirmar" : "Not confirmed"}</span></div><div className="sp3-vote-options">{review.candidates.map(candidate => <button className={`sp3-vote ${selected === candidate.id ? "selected" : ""}`} key={candidate.id} onClick={() => choose(candidate)} disabled={busy || !candidate.rules || candidate.issues.length > 0} aria-label={`${PEOPLE[editor].name} confirms ${PEOPLE[candidate.editor].name}'s rule`} aria-pressed={selected === candidate.id}>{selected === candidate.id ? <CheckCircle2 size={13} /> : <Circle size={13} />}<span>{es ? "Confirmar regla de " : "Confirm "}{PEOPLE[candidate.editor].name}{es ? "" : "’s rule"}</span></button>)}</div><p className="sp3-vote-state">{selected && review.votes[other] && selected !== review.votes[other] ? es ? "Las elecciones no coinciden. El formulario sigue igual." : "Your choices differ. The live form is unchanged." : selected ? es ? `Falta la misma confirmación de ${PEOPLE[other].name}.` : `Waiting for ${PEOPLE[other].name} to confirm the same rule.` : es ? "Al confirmar, apruebas ambas traducciones y la regla ejecutable." : "Confirmation approves both translations and the executable rule shown above."}</p></div>;
}

function DraftEditor({ editor, room, act }: { editor: EditorId; room: ConsequencesRoom; act: Act }) {
  const draft = room.drafts[editor];
  const [local, setLocal] = useState<{ text: string; baseVersion: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const es = editor === "bob";
  const stale = local !== null && local.baseVersion !== draft.version;
  const value = local?.text ?? draft.text;
  const changed = value !== draft.text;
  const save = async () => {
    if (!local || stale) return;
    const sent = { ...local };
    setBusy(true);
    try { await act({ type: "draft", editor, baseVersion: sent.baseVersion, text: sent.text }); setLocal(current => current?.text === sent.text && current.baseVersion === sent.baseVersion ? null : current); }
    catch { /* Keep the unsent draft visible when the server rejects it. */ }
    finally { setBusy(false); }
  };
  return <article className="sp3-editor" lang={es ? "es" : "en"}><div className="sp3-editor-head"><div className="sp3-editor-person"><span className={`sp3-avatar ${editor}`}>{PEOPLE[editor].name[0]}</span><div><strong>{PEOPLE[editor].name}</strong><small>{es ? "Editor simulado" : "Simulated editor"}</small></div></div><span className="sp3-language">{PEOPLE[editor].label}</span></div><div className="sp3-editor-body"><div className="sp3-editor-label"><span>{es ? "Propuesta completa" : "Complete proposed policy"}</span><span>v{draft.version}</span></div><textarea aria-label={`${PEOPLE[editor].name} policy draft`} value={value} maxLength={3000} onChange={e => setLocal(current => ({ text: e.target.value, baseVersion: current?.baseVersion ?? draft.version }))} /><div className="sp3-editor-actions"><span className="sp3-draft-state">{stale ? es ? "Hay una versión nueva. Tu texto sin enviar sigue aquí." : "A newer draft exists. Your unsent text is preserved." : busy ? es ? "Guardando…" : "Saving…" : changed ? es ? "Cambios locales · aún no enviados" : "Local changes · not sent yet" : es ? "Borrador guardado · listo para revisar" : "Saved draft · ready for review"}</span>{stale ? <button className="sp3-btn-secondary" onClick={() => setLocal(null)}>{es ? "Cargar la nueva versión" : "Load the newer draft"}</button> : <button className="sp3-btn" onClick={save} disabled={busy || !changed || !value.trim()} aria-label={`Save ${PEOPLE[editor].name} policy draft`}>{busy ? <LoaderCircle size={12} className="sp3-spin" /> : <Send size={12} />}{es ? "Guardar propuesta" : "Save proposed policy"}</button>}</div></div></article>;
}

function RegistrationForm({ room, act }: { room: ConsequencesRoom; act: Act }) {
  const [label, setLabel] = useState("Attendee 01");
  const [age, setAge] = useState("17");
  const [resident, setResident] = useState("no");
  const [time, setTime] = useState(DEFAULT_TIME);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<PolicyRegistration | null>(null);
  const attendee = attendeeFromFields(age, resident, time);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attendee || !label.trim()) return;
    setBusy(true);
    const requestId = crypto.randomUUID();
    try { const updated = await act({ type: "register", requestId, policyVersion: room.published.version, label: label.trim(), ...attendee }); setReceipt(updated.registrations.find(registration => registration.requestId === requestId) || null); }
    catch { /* The shared error states whether a newer policy requires a retry. */ }
    finally { setBusy(false); }
  };
  return <section className="sp3-registration" aria-label="Working registration form"><div className="sp3-registration-head"><div><p className="sp3-registration-kicker">03 / Feel the consequence</p><h2>Workshop registration</h2></div><span className="sp3-live-badge"><span className="sp3-dot" />LIVE · v{room.published.version}</span></div><div className="sp3-registration-body"><p className="sp3-registration-policy">{summarizePolicy(room.published.rules)}</p><form onSubmit={submit}><div className="sp3-registration-grid"><label className="sp3-field sp3-span-two"><span>Synthetic attendee label</span><input aria-label="Registration attendee label" value={label} onChange={e => setLabel(e.target.value)} maxLength={80} required autoComplete="off" /></label><label className="sp3-field"><span>Age</span><input aria-label="Registration age" type="number" min="0" max="120" step="1" value={age} onChange={e => setAge(e.target.value)} required /></label><label className="sp3-field"><span>Neighborhood resident</span><select aria-label="Registration residency" value={resident} onChange={e => setResident(e.target.value)}><option value="no">No · nonresident</option><option value="yes">Yes · resident</option></select></label><label className="sp3-field sp3-span-two"><span>Simulated submission time · UTC</span><input aria-label="Registration submission time UTC" type="datetime-local" step="1" value={time} onChange={e => setTime(e.target.value)} required /></label></div><p className="sp3-registration-note">This is a working prototype form. The server saves a synthetic registration and evaluates it using the published policy. No payment or email.</p><button className="sp3-registration-submit" type="submit" disabled={busy || !attendee || !label.trim()}>{busy ? <LoaderCircle size={14} className="sp3-spin" /> : <ArrowRight size={14} />}{busy ? "Checking the agreed policy…" : "Submit registration"}</button></form>{receipt && <div className={`sp3-receipt ${receipt.decision.accepted ? "" : "rejected"}`} role="status">{receipt.decision.accepted ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<div><strong>{receipt.decision.accepted ? "Registration accepted" : "Registration rejected"}</strong><p>{receipt.label} · {personLabel(receipt)}<br />{receipt.decision.reasons.join(" ")}</p><p>Saved against policy v{receipt.policyVersion}{receipt.policyVersion !== room.published.version ? ` · current form is v${room.published.version}` : ""}<br /><code>Receipt {receipt.id}</code></p></div></div>}</div></section>;
}

function AgentRelay({ room, act, requestReview, working }: { room: ConsequencesRoom; act: Act; requestReview: () => Promise<void>; working: boolean }) {
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const importResponse = async () => {
    setBusy(true); setNote("");
    const sent = response;
    try { await act({ type: "completeReview", response: sent }); setResponse(current => current === sent ? "" : current); setNote("Fresh review imported. Compare the proposals above; both editors must confirm before publication."); }
    catch { /* Keep the response for correction when validation fails. */ }
    finally { setBusy(false); }
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(room.activeJob?.prompt || ""); setCopied(true); }
    catch { setNote("Select and copy the review prompt from the text box."); }
  };
  return <details className="sp3-relay"><summary>Agent relay (manual) · review prompts and responses</summary><div className="sp3-relay-body"><p>A facilitator transfers these saved drafts to a fresh Codex agent and imports its JSON response. There is no automatic model connection. AI proposes bilingual text and structured rules; both simulated editors review and confirm them. Unsupported conditions stay unresolved.</p><div className="sp3-relay-controls"><button className="sp3-btn-secondary" onClick={requestReview} disabled={working || Boolean(room.activeJob) || Boolean(room.review)}>{working ? <LoaderCircle className="sp3-spin" size={12} /> : <SlidersHorizontal size={12} />}{room.activeJob ? "Review prompt ready" : room.review ? "Edit a draft to review again" : "Prepare review prompt"}</button><span>{room.activeJob ? `Review ${room.activeJob.id.slice(0, 8)} · based on policy v${room.activeJob.basePolicyVersion}` : "Save any local draft changes before preparing a review."}</span></div>{room.activeJob && <><label htmlFor="sp3-review-prompt">Fresh agent review prompt</label><textarea id="sp3-review-prompt" aria-label="Fresh agent review prompt" value={room.activeJob.prompt} readOnly /><div className="sp3-relay-actions"><button className="sp3-btn-secondary" onClick={copyPrompt}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Prompt copied" : "Copy review prompt"}</button></div><label htmlFor="sp3-review-response">Agent JSON response</label><textarea id="sp3-review-response" aria-label="Agent JSON response" value={response} onChange={e => setResponse(e.target.value)} placeholder="Paste the fresh agent’s complete JSON response." /><div className="sp3-relay-actions"><button className="sp3-btn" onClick={importResponse} disabled={busy || !response.trim()}>{busy ? <LoaderCircle className="sp3-spin" size={12} /> : <CheckCircle2 size={12} />}{busy ? "Validating response…" : "Import agent review"}</button></div></>}{note && <p style={{ marginTop: 12 }} role="status">{note}</p>}</div></details>;
}
