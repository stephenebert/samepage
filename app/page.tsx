"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, Check, CheckCheck, CircleHelp, Clock3, Copy, ExternalLink, GitMerge, LoaderCircle, LockKeyhole, Radio, Send, Split, Users } from "lucide-react";
import type { ClientId, Issue, Language, RelayResponse, Room, RoomAction, RoomResponse } from "../lib/types";

type Draft = { text: string; baseVersion: number; dirty: boolean };
const PERSON = { alice: { name: "Alice", language: "en" as Language, initial: "A" }, bob: { name: "Bob", language: "es" as Language, initial: "B" } };

async function request<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(url, { method: data ? "POST" : "GET", headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined, cache: "no-store" });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The room could not be updated. Please try again.");
  return result;
}
function duration(ms: number) { const seconds = Math.round(ms / 1000); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function timeLabel(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function participant(eventId: string, room: Room) { const proposal = room.proposals.find(p => p.id === eventId); return proposal ? PERSON[proposal.clientId].name : "Proposal"; }

export default function Home() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [client, setClient] = useState<ClientId | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editorSections, setEditorSections] = useState<Record<ClientId, string>>({ alice: "admission", bob: "admission" });
  const [connected, setConnected] = useState(true);

  const receiveRoom = useCallback((incoming: Room) => setRoom(current => !current || current.id !== incoming.id || incoming.updatedAt >= current.updatedAt ? incoming : current), []);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setRoomId(params.get("room")); const value = params.get("client"); setClient(value === "alice" || value === "bob" ? value : null); setReady(true); }, []);
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let loadingRequest = false;
    const refresh = async () => { if (loadingRequest) return; loadingRequest = true; try { const data = await request<RoomResponse>(`/api/rooms/${encodeURIComponent(roomId)}`); if (!cancelled) { receiveRoom(data.room); setConnected(true); setError(""); } } catch (e) { if (!cancelled) { setConnected(false); setError(e instanceof Error ? e.message : "Unable to connect to room."); } } finally { loadingRequest = false; } };
    void refresh(); const interval = setInterval(refresh, 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomId, receiveRoom]);

  const createRoom = async () => { setLoading(true); setError(""); try { const data = await request<RoomResponse>("/api/rooms", {}); receiveRoom(data.room); setRoomId(data.room.id); window.history.replaceState({}, "", `?room=${encodeURIComponent(data.room.id)}`); } catch (e) { setError(e instanceof Error ? e.message : "Could not create room."); } finally { setLoading(false); } };
  const act = useCallback(async (action: RoomAction) => { if (!roomId) throw new Error("Create a room first."); const data = await request<RoomResponse>(`/api/rooms/${encodeURIComponent(roomId)}`, action); receiveRoom(data.room); return data.room; }, [roomId, receiveRoom]);
  const openIssues = room?.issues.filter(issue => issue.status === "open") || [];
  const pending = room?.proposals.filter(p => p.status === "pending" || p.status === "processing") || [];
  const latestJob = [...(room?.jobs || [])].reverse().find(job => job.status === "completed");
  const participants: ClientId[] = client ? [client] : ["alice", "bob"];
  const selectedSection = participants.every(id => editorSections[id] === editorSections[participants[0]]) ? editorSections[participants[0]] : null;

  return <main className="shell">
    <header className="masthead">
      <a className="wordmark" href="/" aria-label="SamePage home"><span className="logomark" aria-hidden="true"><span /><span /></span>SamePage</a>
      <div className="masthead-right"><span className="masthead-note mono">COLLABORATION / EXPERIMENT 01</span><span className="simulation-badge"><Users size={11} /> Simulation · two editors</span></div>
    </header>
    <section className="intro">
      <div><p className="eyebrow">A shared document, in your own words</p><h1>Two languages.<br />One <em>shared meaning.</em></h1><p className="intro-desc">Edit in English or Spanish. Keep the parts you agree on.<br className="desktop-break" /> When meaning diverges, find the exact difference—then decide together.</p></div>
      {room && <div className="room-tools"><p className="room-identity mono">ROOM {room.id.slice(0, 8).toUpperCase()} · REVISION {room.revision}</p><div className="link-row"><a className="small-link" href={`?room=${room.id}&client=alice`} target="_blank" rel="noreferrer">Alice’s editor <ExternalLink size={10} /></a><a className="small-link" href={`?room=${room.id}&client=bob`} target="_blank" rel="noreferrer">Bob’s editor <ExternalLink size={10} /></a>{client && <a className="small-link" href={`?room=${room.id}`}>Both editors</a>}</div></div>}
    </section>
    {error && <p role="alert" className="error-note">{error}</p>}
    {!ready || (roomId && !room && connected) ? <div className="loading"><LoaderCircle size={17} className="spin" /> Opening the shared room…</div> : !room ? <section className="empty-stage">
      <div className="empty-main"><p className="eyebrow">The live test</p><h2>Can two people disagree<br />without talking past each other?</h2><p>Start a real shared room with two fictional editors: Alice writes in English, Bob in Spanish. You can play both roles here, or open their separate browser tabs.</p><button className="primary-button" onClick={createRoom} disabled={loading}>{loading ? <LoaderCircle size={14} className="spin" /> : <Users size={14} />}{loading ? "Creating room…" : "Create a shared room"}<ArrowRight size={14} /></button></div>
      <div className="empty-aside"><div className="empty-step"><span className="step-number">01</span><div><h3>Make two real edits</h3><p>Both editors start from the same agreed text. Each draft keeps its own original version.</p></div></div><div className="empty-step"><span className="step-number">02</span><div><h3>Find the difference that matters</h3><p>A fresh Fable response checks meaning and provides a concrete counterexample when edits conflict.</p></div></div><div className="empty-step"><span className="step-number">03</span><div><h3>Agree, in both languages</h3><p>Compatible edits update the document. A conflict stays pending until both editors choose the same meaning.</p></div></div></div>
    </section> : <>
      <div className="status-strip" role="status"><div className="status-left">{pending.length ? <LoaderCircle size={15} className="spin" color="#9c7a42" /> : connected ? <Radio size={15} color="#6c8d58" /> : <CircleHelp size={15} />}<div><span className="status-title">{!connected ? "Reconnecting to the room" : pending.length ? `${pending.length} edit${pending.length === 1 ? "" : "s"} ${room.activeJobId ? "with Fable" : "waiting for the facilitator"}` : openIssues.length ? "Shared text preserved · a decision is needed" : "One shared document · both languages in sync"}</span><span className="status-copy">{pending.length ? " · No change is committed while meaning is being checked." : " · Room updates every second."}</span></div></div><span className="relay-badge">Fable relay · operator required</span></div>
      <div className="workspace-title"><h2>{room.title}</h2><span>Fictional event · real shared state</span></div>
      <nav className="section-nav" aria-label={client === "bob" ? "Revisar una sección" : client ? "Review a section" : "Review a section in both editors"}>{room.segments.map(segment => <button key={segment.id} className={`section-tab ${selectedSection === segment.id ? "active" : ""}`} onClick={() => setEditorSections({ alice: segment.id, bob: segment.id })} aria-pressed={selectedSection === segment.id}>{segment.label[client === "bob" ? "es" : "en"]}{openIssues.some(issue => issue.segmentId === segment.id) && <span className="section-pip" />}</button>)}</nav>
      {openIssues.filter(issue => issue.kind === "conflict").map(issue => <ConflictCard key={issue.id} issue={issue} room={room} participants={participants} act={act} />)}
      <div className={`editors ${client ? "single" : ""}`}>{participants.map(id => <Editor key={id} clientId={id} room={room} sectionId={editorSections[id]} onSectionChange={sectionId => setEditorSections(current => ({ ...current, [id]: sectionId }))} act={act} />)}</div>
      <div className="shared-bottom"><section className="activity"><h2 className="panel-label"><GitMerge size={13} /> Shared history</h2>{room.activity.length ? [...room.activity].reverse().slice(0, 6).map(item => <div key={item.id} className="activity-item"><span className="activity-icon">{item.kind.includes("conflict") ? <Split size={12} /> : <Check size={12} />}</span><span>{item.text}</span><time className="activity-time mono" dateTime={item.at}>{timeLabel(item.at)}</time></div>) : <p className="activity-empty">The next line is yours to write.</p>}</section><aside className="method-note"><h2 className="panel-label"><LockKeyhole size={12} /> What this test actually does</h2><p><strong>The room, drafts, versions and votes are live.</strong> Alice and Bob are simulated personas; their separate tabs share the same stored document.</p><p>Meaning checks use fresh Fable responses, transferred by a facilitator. There is no automatic model connection. The language model can make mistakes; its explanations and translations need review.</p>{latestJob?.processingMs !== undefined && <p className="mono">Last relay: {duration(latestJob.processingMs)} · includes operator time</p>}</aside></div>
      <Facilitator room={room} receiveRoom={receiveRoom} />
    </>}
    <footer className="footer"><span>SamePage / a bilingual collaboration experiment</span><span>English ↔ Español · {room ? "Private test room" : "Synthetic event document"}</span></footer>
  </main>;
}

function Editor({ clientId, room, sectionId, onSectionChange, act }: { clientId: ClientId; room: Room; sectionId: string; onSectionChange: (sectionId: string) => void; act: (action: RoomAction) => Promise<Room> }) {
  const person = PERSON[clientId]; const es = person.language === "es";
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [cacheReady, setCacheReady] = useState(false);
  const [dismissedStaleId, setDismissedStaleId] = useState<string | null>(null);
  const cacheKey = `samepage-drafts:${room.id}:${clientId}`;
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          const safe = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value && typeof value === "object" && typeof (value as Draft).text === "string" && typeof (value as Draft).baseVersion === "number" && typeof (value as Draft).dirty === "boolean"));
          setDrafts(safe as Record<string, Draft>);
        }
      }
    } catch { /* The shared room still works when browser storage is unavailable. */ }
    setCacheReady(true);
  }, [cacheKey]);
  useEffect(() => { if (cacheReady) { try { sessionStorage.setItem(cacheKey, JSON.stringify(drafts)); } catch { /* Keep the in-memory draft. */ } } }, [cacheReady, cacheKey, drafts]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [justSent, setJustSent] = useState<string | null>(null);
  const sectionRef = useRef(sectionId); sectionRef.current = sectionId;
  const actRef = useRef(act); actRef.current = act;
  useEffect(() => { const update = () => { if (document.visibilityState === "visible") void actRef.current({ type: "presence", clientId, editingSegmentId: sectionRef.current }).catch(() => {}); }; update(); const timer = setInterval(update, 8000); document.addEventListener("visibilitychange", update); return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); }; }, [clientId]);
  useEffect(() => { void actRef.current({ type: "presence", clientId, editingSegmentId: sectionId }).catch(() => {}); }, [clientId, sectionId]);
  const segment = room.segments.find(s => s.id === sectionId) || room.segments[0];
  const stored = segment ? drafts[segment.id] : undefined;
  const draft = stored?.dirty ? stored : { text: segment?.[person.language] || "", baseVersion: segment?.version || 0, dirty: false };
  const ownProposals = room.proposals.filter(p => p.clientId === clientId && p.segmentId === segment?.id);
  const latest = ownProposals.at(-1);
  const queued = ownProposals.find(p => p.status === "pending" || p.status === "processing");
  const clarify = room.issues.find(issue => issue.kind === "clarify" && issue.status === "open" && issue.segmentId === segment?.id && issue.eventIds.some(id => ownProposals.some(p => p.id === id)));
  const stale = draft.dirty && draft.baseVersion !== segment?.version;
  const presence = room.presence[clientId];
  const online = presence && Date.now() - new Date(presence.seenAt).getTime() < 20000;
  if (!segment) return null;
  const change = (text: string) => setDrafts(prev => ({ ...prev, [segment.id]: { text, baseVersion: prev[segment.id]?.dirty ? prev[segment.id].baseVersion : segment.version, dirty: true } }));
  const reload = () => { setDismissedStaleId(latest?.id || null); setDrafts(prev => ({ ...prev, [segment.id]: { text: segment[person.language], baseVersion: segment.version, dirty: false } })); setError(""); };
  const send = async () => { setSending(true); setError(""); try { const id = crypto.randomUUID(); const result = await act({ type: "propose", id, clientId, segmentId: segment.id, baseVersion: draft.baseVersion, text: draft.text, ...(clarify ? { supersedesIssueId: clarify.id } : {}) }); const proposal = result.proposals.find(p => p.id === id); setJustSent(id); if (proposal?.status !== "stale") setDrafts(prev => ({ ...prev, [segment.id]: { text: draft.text, baseVersion: draft.baseVersion, dirty: false } })); } catch (e) { setError(e instanceof Error ? e.message : "Could not send edit."); } finally { setSending(false); } };
  const sent = room.proposals.find(p => p.id === justSent);
  return <section className="editor" aria-label={`${person.name} editor`} lang={person.language}>
    <header className="editor-heading"><div className="person"><span className={`avatar ${clientId}`}>{person.initial}</span><div><h3 className="person-name">{person.name}<span style={{ fontWeight: 400, color: "#88917e", fontSize: 10 }}> · {es ? "persona simulada" : "simulated persona"}</span></h3><p className="person-meta"><span className="tiny-dot" style={{ width: 5, height: 5, marginRight: 5, background: online ? "#7a9a6b" : "#b6bdb1" }} />{online ? es ? "Editor conectado" : "Editor connected" : es ? "Conectando…" : "Connecting…"}</p></div></div><span className="language-pill">{es ? "ES / ESPAÑOL" : "EN / ENGLISH"}</span></header>
    <div className="editor-body"><div className="document-label"><span>{es ? "Texto acordado" : "Agreed document"}</span><span className="revision mono">v{segment.version} <CheckCheck size={11} style={{ display: "inline", verticalAlign: "middle", marginLeft: 2 }} /></span></div><label className="hidden-label" htmlFor={`${clientId}-section`}>{person.name} section</label><select id={`${clientId}-section`} aria-label={`${person.name} section`} className="editor-section-select" value={segment.id} onChange={e => onSectionChange(e.target.value)}>{room.segments.map(s => <option key={s.id} value={s.id}>{s.label[person.language]}</option>)}</select><p className="agreed-copy" key={`${segment.id}-${segment.version}`}>{segment[person.language]}</p>
      <div className="draft-section"><label className="draft-label" htmlFor={`${clientId}-draft`}>{es ? "Tu propuesta" : "Your proposed edit"}<span className="mono">{es ? "desde" : "from"} v{draft.baseVersion}</span></label><textarea id={`${clientId}-draft`} aria-label={`${person.name} draft`} className="draft-input" value={draft.text} onChange={e => change(e.target.value)} spellCheck={false} />
        {stale && <p className="stale-note">{es ? "El texto compartido cambió mientras escribías. Tu borrador conserva su versión original." : "The shared text changed while you were writing. Your draft still refers to its original version."} <button className="quiet-button" onClick={reload}>{es ? "Recargar texto acordado" : "Reload agreed text"}</button></p>}
        <div className="draft-actions"><span className="draft-note">{es ? "Se verifica el significado antes de publicar." : "Meaning is checked before publishing."}</span><button className="primary-button" aria-label={`Send ${person.name} edit`} onClick={send} disabled={sending || !!queued || !draft.dirty || !draft.text.trim()}>{sending ? <LoaderCircle size={12} className="spin" /> : <Send size={12} />}{es ? "Enviar propuesta" : "Send proposed edit"}</button></div>
      </div>
      {error && <p className="proposal-state error" role="alert">{error}</p>}
      {queued && <div className="proposal-state pending" role="status"><strong><Clock3 size={11} style={{ display: "inline", marginRight: 5 }} />{queued.status === "processing" ? es ? "Fable está revisando tu propuesta" : "Fable is reviewing your proposal" : es ? "Esperando al facilitador" : "Waiting for the facilitator"}</strong><p>{queued.text}</p><p style={{ marginTop: 7, fontSize: 10 }}>{es ? "Tu propuesta está guardada. El texto acordado aún no cambia." : "Your proposal is saved. The agreed text has not changed yet."}</p></div>}
      {!queued && latest?.status === "stale" && latest.id !== dismissedStaleId && <div className="proposal-state error" role="alert"><strong>{es ? "No se aplicó: versión desactualizada" : "Not applied: draft is out of date"}</strong>{es ? "Recarga el texto acordado y vuelve a editar para conservar los cambios recientes." : "Reload the agreed text and edit again to preserve recent changes."} <button className="quiet-button" onClick={reload}>{es ? "Recargar texto acordado" : "Reload agreed text"}</button></div>}
      {clarify && <div className="clarification"><strong><CircleHelp size={12} style={{ display: "inline", marginRight: 5 }} />{es ? "Una aclaración antes de continuar" : "One clarification before this changes"}</strong><p>{clarify.clarificationQuestion?.[person.language] || clarify.explanation[person.language]}</p><p style={{ fontSize: 10, marginTop: 8 }}>{es ? "Edita tu propuesta para responder y envíala de nuevo." : "Edit your proposal to answer, then send it again."}</p></div>}
      {!queued && !draft.dirty && !stale && sent?.status === "applied" && sent.segmentId === segment.id && <div className="proposal-state" role="status"><strong><CheckCheck size={12} style={{ display: "inline", marginRight: 5 }} />{es ? "Aplicado en ambos idiomas" : "Applied in both languages"}</strong>{es ? "El documento compartido ahora incluye tu cambio." : "The shared document now includes your change."}</div>}
    </div>
  </section>;
}

function ConflictCard({ issue, room, participants, act }: { issue: Issue; room: Room; participants: ClientId[]; act: (action: RoomAction) => Promise<Room> }) {
  const [busy, setBusy] = useState<ClientId | null>(null); const [error, setError] = useState("");
  const segment = room.segments.find(s => s.id === issue.segmentId);
  const dual = participants.length > 1;
  const language = dual ? "en" : PERSON[participants[0]].language;
  const es = language === "es";
  const vote = async (clientId: ClientId, candidateEventId: string) => { setBusy(clientId); setError(""); try { await act({ type: "vote", clientId, issueId: issue.id, candidateEventId }); } catch (e) { setError(e instanceof Error ? e.message : es ? "No se pudo guardar la elección." : "Could not save choice."); } finally { setBusy(null); } };
  return <section className="conflict" lang={language} aria-label={`${es ? "Diferencia de significado" : "Meaning conflict"}: ${segment?.label[language] || issue.segmentId}`}>
    <div className="conflict-top"><span className="conflict-icon"><Split size={17} /></span><div><p className="conflict-kicker">{es ? "El significado cambió" : "Meaning diverged"} / {segment?.label[language]}</p><h3>{es ? "Estas propuestas describen situaciones distintas." : "These edits describe different worlds."}</h3><p className="conflict-desc">{issue.explanation[language]}</p></div><span className="conflict-top-right"><LockKeyhole size={12} style={{ display: "inline", marginRight: 4 }} />{es ? "Texto acordado conservado en" : "Agreed text held at"} v{issue.baseVersion}<br />{es ? "Ambos deciden qué cambia." : "Both people decide what changes."}</span></div>
    {issue.witness && <div className="witness"><div className="witness-question"><span className="witness-label">{es ? "La diferencia, con un ejemplo concreto" : "The difference, made concrete"}</span><p>{issue.witness.question[language]}</p>{dual && <span lang="es" style={{ fontSize: 11, color: "#987b55", lineHeight: 1.5, marginTop: 7 }}>{issue.witness.question.es}</span>}</div>{issue.candidates.map(candidate => <div className="witness-answer" key={candidate.eventId}><div className="witness-person">{es ? `Con la versión de ${participant(candidate.eventId, room)}` : `With ${participant(candidate.eventId, room)}’s version`}</div><p>{issue.witness?.answers[candidate.eventId]?.[language] || (es ? "No se proporcionó una respuesta" : "No answer supplied")}</p>{dual && <p lang="es" style={{ fontWeight: 400, fontSize: 11, color: "#947b58", marginTop: 6 }}>{issue.witness?.answers[candidate.eventId]?.es || ""}</p>}</div>)}</div>}
    <div className="vote-area"><p className="vote-intro"><Users size={13} />{es ? "Elige el significado que quieres expresar. El documento cambia solo cuando ambos eligen la misma versión." : "Choose the meaning you intend. The document changes only when both editors choose the same version."}</p>{error && <p className="error-note" role="alert">{error}</p>}<div className={`vote-grid ${dual ? "" : "single"}`}>{participants.map(clientId => { const person = PERSON[clientId]; const es = person.language === "es"; return <section key={clientId} className="vote-panel" lang={person.language}><h4 className="vote-panel-title">{es ? "La decisión de Bob" : "Alice’s decision"}<span style={{ fontWeight: 400, fontSize: 10 }}>{issue.votes[clientId] ? es ? "Elección guardada" : "Choice saved" : es ? "Sin elegir" : "No choice yet"}</span></h4><div className="vote-options">{issue.candidates.map(candidate => <button key={candidate.eventId} aria-label={`${person.name} choose ${participant(candidate.eventId, room)} proposal`} className={`vote-button ${issue.votes[clientId] === candidate.eventId ? "selected" : ""}`} aria-pressed={issue.votes[clientId] === candidate.eventId} disabled={busy !== null} onClick={() => vote(clientId, candidate.eventId)}><span className="vote-dot" /><span>{candidate[person.language]}<span style={{ display: "block", marginTop: 5, fontSize: 9, opacity: .7 }}>{participant(candidate.eventId, room)} · {es ? "propuesta" : "proposal"}</span></span></button>)}</div>{issue.votes[clientId] && <p className="vote-status">{es ? "Esperando que ambos elijan el mismo significado." : "Waiting for both editors to choose the same meaning."}</p>}</section>; })}</div></div>
  </section>;
}

function Facilitator({ room, receiveRoom }: { room: Room; receiveRoom: (room: Room) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [response, setResponse] = useState(""); const [copied, setCopied] = useState(false); const [notice, setNotice] = useState("");
  const job = room.jobs.find(item => item.id === room.activeJobId);
  const waiting = room.proposals.filter(p => p.status === "pending");
  const claim = async () => { setBusy(true); setError(""); setNotice(""); try { const result = await request<RelayResponse>(`/api/rooms/${room.id}/relay`, { type: "claim" }); receiveRoom(result.room); if (!result.job) setNotice("There are no queued proposals to relay."); } catch (e) { setError(e instanceof Error ? e.message : "Could not claim batch."); } finally { setBusy(false); } };
  const complete = async () => { if (!job) return; setBusy(true); setError(""); setNotice(""); try { const result = await request<RelayResponse>(`/api/rooms/${room.id}/relay`, { type: "complete", jobId: job.id, response }); receiveRoom(result.room); setResponse(""); setNotice("Response validated and recorded. The shared document and any decisions are now visible above."); } catch (e) { setError(e instanceof Error ? e.message : "Response could not be accepted."); } finally { setBusy(false); } };
  const copy = async () => { if (!job) return; try { await navigator.clipboard.writeText(job.prompt); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError("Clipboard access is unavailable. Select and copy the prompt below."); } };
  return <details className="facilitator"><summary>Facilitator controls · fresh Fable relay {job ? "in progress" : waiting.length ? `· ${waiting.length} queued` : ""}</summary><div className="facilitator-body"><p>Submit both editors’ proposals before claiming a batch to test concurrent changes. Copy this exact prompt into Fable, then paste its complete JSON response. This step is manual.</p>{error && <p className="error-note" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}<div className="facilitator-controls"><button className="secondary-button" disabled={busy || !!job || !waiting.length} onClick={claim}><ArrowDownLeft size={12} />Claim {waiting.length || "queued"} edit{waiting.length === 1 ? "" : "s"}</button>{job && <span className="mono" style={{ fontSize: 10 }}>Batch {job.id.slice(0, 8)} · {job.proposals.length} proposals · awaiting Fable</span>}</div>{job && <><label className="relay-field-label" htmlFor="relay-prompt">Exact Fable prompt</label><textarea id="relay-prompt" className="relay-prompt" aria-label="Exact Fable prompt" readOnly value={job.prompt} /><button style={{ marginTop: 7 }} className="secondary-button" onClick={copy}><Copy size={11} />{copied ? "Copied" : "Copy prompt"}</button><label className="relay-field-label" htmlFor="relay-response">Paste Fable’s JSON response</label><textarea id="relay-response" className="relay-response" value={response} onChange={e => setResponse(e.target.value)} placeholder='{"jobId":"…","decisions":[…]}' spellCheck={false} /><div className="facilitator-controls"><button className="primary-button" disabled={busy || !response.trim()} onClick={complete}>{busy ? <LoaderCircle size={12} className="spin" /> : <GitMerge size={12} />}Validate and apply response</button></div></>}</div></details>;
}
