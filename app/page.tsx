"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, FileText, LoaderCircle, Plus, ShieldCheck, Users, X } from "lucide-react";
import type { StudioAttendee, StudioCandidate, StudioEditor, StudioFlag, StudioRepair, StudioRoom, StudioRules, StudioText, StudioWitness } from "../lib/studio-types";
import { evaluateStudioPolicy } from "../lib/studio-engine";
import { realisticStudioWitness } from "../lib/studio-witness";
import { summarizeAdmissionFailure } from "../lib/studio-admission-summary";
import { studioIntroducedFlagEffect } from "../lib/studio-repair-presentation";
import "./workspace.css";

type Actor = "owner" | StudioEditor;
type WorkspaceRoom = StudioRoom & { workspace: { kind: "samepage-workspace-v1"; title: string } };
type Invitation = { editor: StudioEditor; token: string; roomId: string };
type Snapshot = { room: WorkspaceRoom | null; actor: Actor; hasPublished: boolean; liveAvailable: boolean; budget: { sessionRemaining: number; globalRemaining: number }; invitation?: Invitation; error?: string; code?: string };
type Action = Record<string, unknown> & { action: string };
type Auth = { roomId: string; token: string } | null;
type Tab = "policies" | "review" | "form";
type Confirmation = { title: string; message: string };
const SAMPLE: { title: string; drafts: StudioText } = {
  title: "Community workshop",
  drafts: {
    en: "The workshop accepts applications from 2026-11-10T09:00:00.000Z through 2026-11-12T17:00:00.000Z, including both endpoints. Applicants must be at least 18 years old. There are two alternative admission routes. Community route: the applicant must be a local resident. Campus route: the applicant must be both a student and a club member. An applicant who meets either route, the age requirement and the application window is admitted. All other applicants are rejected. Guardian consent and scholarships do not affect admission. Attendance is free for every admitted applicant.",
    es: "El taller acepta solicitudes desde 2026-11-10T09:00:00.000Z hasta 2026-11-12T17:00:00.000Z, incluidos ambos extremos. Las personas solicitantes deben tener al menos 18 años. Hay dos vías alternativas de admisión. Vía comunitaria: la persona solicitante debe ser residente local y estudiante. Vía del campus: la persona solicitante debe ser estudiante y miembro del club. Se admite a toda persona que cumpla cualquiera de las dos vías, el requisito de edad y el plazo de solicitud. Se rechazan todas las demás solicitudes. El consentimiento del tutor y las becas no afectan la admisión. La asistencia es gratuita para todas las personas admitidas."
  }
};
const EMPTY: StudioText = { en: "", es: "" };
const EDITORS = ["alice", "bob"] as const;
const reviewerName = (actor: StudioEditor) => actor === "alice" ? "English reviewer" : "Spanish reviewer";
const languageName = (actor: StudioEditor) => actor === "alice" ? "English" : "Spanish";
const flags: { key: StudioFlag; label: string }[] = [{ key: "resident", label: "Resident" }, { key: "student", label: "Student" }, { key: "member", label: "Member" }, { key: "guardianConsent", label: "Guardian consent" }, { key: "scholarship", label: "Scholarship" }];
const modelActions = new Set(["analyze", "checkRewrite", "repair"]);
const currency = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const readableTime = (value: string) => value.replace("T", " ").replace(/\.000Z$/, " UTC").replace(/Z$/, " UTC");

class WorkspaceRequestError extends Error { constructor(message: string, readonly snapshot?: Snapshot) { super(message); } }
async function fetchWorkspace(auth: Auth, action?: Action): Promise<Snapshot> {
  const headers: Record<string, string> = {};
  if (auth) { headers["X-SamePage-Reviewer"] = auth.token; headers["X-SamePage-Room"] = auth.roomId; }
  if (action) headers["Content-Type"] = "application/json";
  const response = await fetch("/api/workspace", { method: action ? "POST" : "GET", headers, ...(action ? { body: JSON.stringify(action) } : {}), cache: "no-store", signal: AbortSignal.timeout(action && modelActions.has(action.action) ? 100_000 : 15_000) });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new WorkspaceRequestError("The service returned an unexpected response. Check the latest saved state before retrying.");
  let data: Snapshot;
  try { data = await response.json() as Snapshot; }
  catch { throw new WorkspaceRequestError("The service response could not be read. Check the latest saved state before retrying."); }
  if (!response.ok) throw new WorkspaceRequestError(data.error || "The workspace could not be updated.", data);
  return data;
}

export default function SamePageWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const [title, setTitle] = useState(""), [drafts, setDrafts] = useState<StudioText>(EMPTY), [dirty, setDirty] = useState(false);
  const [newReview, setNewReview] = useState(false), [tab, setTab] = useState<Tab>("policies");
  const [proposal, setProposal] = useState<StudioText>(EMPTY), [candidateId, setCandidateId] = useState("");
  const [reviewExample, setReviewExample] = useState<StudioWitness | null>(null);
  const [about, setAbout] = useState(false), [shareOpen, setShareOpen] = useState(false);
  const [invitations, setInvitations] = useState<Partial<Record<StudioEditor, Invitation>>>({});
  const [copyNotice, setCopyNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationResolver = useRef<((accepted: boolean) => void) | null>(null);
  const confirmationTrigger = useRef<HTMLElement | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null), [elapsed, setElapsed] = useState(0);
  const auth = useRef<Auth>(null), actionLock = useRef(false), generation = useRef(0), started = useRef(0), latestSnapshot = useRef<Snapshot | null>(null);
  const hydrated = useRef<{ id: string; revision: number; enVersion: number; esVersion: number; title: string } | null>(null);
  const localDirty = useRef(false), localNew = useRef(false);
  const room = newReview ? null : snapshot?.room ?? null;
  const actor = snapshot?.actor ?? "owner", owner = actor === "owner";
  const activeRequests = [room?.automaticReview, room?.automaticRepair].filter(request => request?.status === "running");
  const running = activeRequests.some(request => Date.parse(request!.leaseExpiresAt) > Date.now());
  const interruptedRequest = activeRequests.find(request => !Number.isFinite(Date.parse(request!.leaseExpiresAt)) || Date.parse(request!.leaseExpiresAt) <= Date.now());
  const waiting = Boolean(activeAction || running);
  const hasPublished = Boolean(room && snapshot?.hasPublished);
  const usageAvailable = Boolean(snapshot?.liveAvailable);
  const draftsComplete = Boolean(drafts.en.trim() && drafts.es.trim());
  const proposalComplete = Boolean(proposal.en.trim() && proposal.es.trim());
  const staleDrafts = Boolean(room && dirty && hydrated.current && (hydrated.current.id !== room.id || room.drafts.alice.version !== hydrated.current.enVersion || room.drafts.bob.version !== hydrated.current.esVersion || room.workspace.title !== hydrated.current.title));

  const confirmAction = useCallback((message: string, heading: string): Promise<boolean> => new Promise(resolve => {
    if (confirmationResolver.current) { resolve(false); return; }
    confirmationResolver.current = resolve;
    confirmationTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmation({ title: heading, message });
  }), []);
  const settleConfirmation = useCallback((accepted: boolean) => {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(accepted);
  }, []);
  useEffect(() => () => { confirmationResolver.current?.(false); confirmationResolver.current = null; }, []);

  const update = useCallback((value: Snapshot) => {
    if (!value || !value.budget || !value.actor) return;
    const previous = latestSnapshot.current;
    if (previous?.room && value.room && previous.room.id === value.room.id && value.room.revision < previous.room.revision) return;
    latestSnapshot.current = value; setSnapshot(value);
    if (previous?.room?.id !== value.room?.id) { setInvitations({}); setCopyNotice(""); setShareOpen(false); }
    if (value.invitation) setInvitations(previous => ({ ...previous, [value.invitation!.editor]: value.invitation }));
    if (value.room && !localDirty.current && !localNew.current) {
      setTitle(value.room.workspace.title); setDrafts({ en: value.room.drafts.alice.text, es: value.room.drafts.bob.text });
      hydrated.current = { id: value.room.id, revision: value.room.revision, enVersion: value.room.drafts.alice.version, esVersion: value.room.drafts.bob.version, title: value.room.workspace.title };
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const url = new URL(window.location.href), token = new URLSearchParams(url.hash.slice(1)).get("reviewer"), roomId = url.searchParams.get("room");
    if (token || roomId) {
      if (!token || !/^[a-f0-9]{64}$/.test(token) || !roomId || !/^[a-zA-Z0-9_-]+$/.test(roomId)) { setError("This reviewer link is incomplete. Ask the workspace owner for a new link."); setLoaded(true); return; }
      auth.current = { token, roomId };
    }
    fetchWorkspace(auth.current).then(value => { if (mounted) { update(value); if (value.room?.review || value.room?.repair) setTab("review"); } }).catch(err => { if (mounted) setError(err.message); }).finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, [update]);
  useEffect(() => {
    if (!loaded || !snapshot?.room) return;
    const timer = setInterval(() => {
      if (actionLock.current) return;
      const currentGeneration = generation.current;
      fetchWorkspace(auth.current).then(value => { if (currentGeneration === generation.current) update(value); }).catch(() => { /* A foreground action reports failures. */ });
    }, 3500);
    return () => clearInterval(timer);
  }, [loaded, snapshot?.room?.id, update]);
  useEffect(() => {
    if (!waiting) { setElapsed(0); return; }
    const at = started.current || Date.now();
    const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - at) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [waiting]);
  useEffect(() => {
    const current = room?.review;
    const previousVote = actor !== "owner" ? current?.votes[actor] : undefined;
    const sharedCandidate = current?.discovery.status === "equivalent" ? current.candidates.find(candidate => candidate.editor === "alice" && candidate.rules && !candidate.issues.length) : undefined;
    setCandidateId(sharedCandidate?.id ?? previousVote ?? "");
  }, [room?.review?.id, room?.review?.discovery.status, actor, actor !== "owner" ? room?.review?.votes[actor] : undefined]);
  useEffect(() => { if (shareOpen) document.getElementById("workspace-reviewer-links")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [shareOpen]);
  useEffect(() => { setProposal(EMPTY); }, [room?.id]);

  const execute = useCallback(async (action: Action): Promise<Snapshot | null> => {
    if (actionLock.current) return null;
    actionLock.current = true; generation.current++; started.current = Date.now(); setActiveAction(action.action); setError("");
    try { const value = await fetchWorkspace(auth.current, action); update(value); return value; }
    catch (cause) {
      if (cause instanceof WorkspaceRequestError && cause.snapshot) update(cause.snapshot);
      setError(cause instanceof Error && cause.name === "TimeoutError" ? "This request took longer than expected. Its current status will refresh here; no automatic retry is made." : cause instanceof Error ? cause.message : "The action did not finish.");
      try { update(await fetchWorkspace(auth.current)); } catch { /* Keep the current work visible. */ }
      return null;
    } finally { generation.current++; actionLock.current = false; started.current = 0; setActiveAction(null); }
  }, [update]);

  const markDirty = () => { localDirty.current = true; setDirty(true); };
  const loadSample = async () => {
    if ((drafts.en.trim() || drafts.es.trim()) && !await confirmAction("Replace these source drafts with the sample policy?", "Replace source drafts")) return;
    setTitle(SAMPLE.title); setDrafts({ ...SAMPLE.drafts }); markDirty();
  };
  const beginNewReview = async () => {
    if ((room || dirty) && !await confirmAction(room ? "Creating a new review will replace this active workspace and invalidate its reviewer links. Its records will no longer be available here." : "Discard the unsaved text and start a new review?", "Start a new review")) return;
    if (room && latestSnapshot.current?.room?.id !== room.id) { setError("The active workspace changed. Review its latest state before starting a new review."); return; }
    localNew.current = true; localDirty.current = false; setNewReview(true); setDirty(false); setTitle(""); setDrafts(EMPTY); setProposal(EMPTY); setInvitations({}); setTab("policies"); setShareOpen(false); setError(""); hydrated.current = null;
  };
  const restoreDrafts = () => {
    if (!room) return;
    localDirty.current = false; setDirty(false); update(snapshot!);
  };
  const save = async (): Promise<Snapshot | null> => {
    const current = latestSnapshot.current?.room;
    const isCreate = !room;
    const base = hydrated.current;
    if (!isCreate && (!current || !base || current.id !== base.id || current.drafts.alice.version !== base.enVersion || current.drafts.bob.version !== base.esVersion || current.workspace.title !== base.title)) {
      setError("The saved policies changed elsewhere. Your unsaved text is still here. Reload the saved drafts before updating them.");
      return null;
    }
    const action: Action = isCreate
      ? { action: "create", title: title.trim() || "Untitled policy", drafts, ...(current ? { roomId: current.id, revision: current.revision } : {}) }
      : { action: "saveDrafts", roomId: room.id, revision: current!.revision, title: title.trim() || "Untitled policy", drafts };
    const result = await execute(action);
    if (result?.room) { localNew.current = false; localDirty.current = false; setNewReview(false); setDirty(false); update(result); }
    return result;
  };
  const analyze = async (retry = false) => {
    let current = snapshot;
    if (!room || dirty) current = await save();
    if (!current?.room) return;
    setTab("review");
    await execute({ action: "analyze", roomId: current.room.id, revision: current.room.revision, ...(retry ? { retry: true } : {}) });
  };
  const invite = async (editor: StudioEditor) => {
    if (!room || !await confirmAction("This replaces any previous link for this role and clears its pending approval.", `Create ${languageName(editor)} reviewer link`)) return;
    const current = latestSnapshot.current?.room;
    if (!current || current.id !== room.id) { setError("The active workspace changed. Review its latest state before creating a reviewer link."); return; }
    await execute({ action: "invite", roomId: current.id, revision: current.revision, editor });
  };
  const returnToReview = async () => {
    if (dirty && !await confirmAction("Discard these unsaved drafts and return to the current review?", "Return to current review")) return;
    const current = latestSnapshot.current;
    if (!current?.room) return;
    localNew.current = false; localDirty.current = false; setNewReview(false); setDirty(false); update(current);
  };
  const invitationUrl = (invitation: Invitation) => `${window.location.origin}/?room=${encodeURIComponent(invitation.roomId)}#reviewer=${invitation.token}`;
  const copyInvitation = async (invitation: Invitation) => {
    try { await navigator.clipboard.writeText(invitationUrl(invitation)); setCopyNotice(`${reviewerName(invitation.editor)} link copied`); }
    catch { setCopyNotice("Copy was unavailable. Open the reviewer view and copy its address."); }
  };
  const checkRewrite = async (retry = false) => {
    if (!room) return;
    await execute({ action: "checkRewrite", roomId: room.id, revision: room.revision, proposalText: retry ? room.repair?.job.proposalText ?? proposal : proposal, ...(retry ? { retry: true } : {}) });
  };
  const repair = async (retry = false) => { if (room) await execute({ action: "repair", roomId: room.id, revision: room.revision, ...(retry ? { retry: true } : {}) }); };
  const review = room?.review, repairResult = room?.repair && room.repair.status !== "superseded" ? room.repair : undefined;
  const baselineCurrent = review?.status === "published" && review.publishedVersion === room?.published.version && review.candidates.some(candidate => candidate.id === room?.published.candidateId);
  const reviewUnresolved = review?.discovery.status === "unresolved";
  const sourcesChanged = !room || drafts.en !== room.drafts.alice.text || drafts.es !== room.drafts.bob.text;
  const unchangedPublished = Boolean(baselineCurrent && !sourcesChanged);
  const liveDisabledReason = !snapshot ? "" : snapshot.budget.sessionRemaining <= 0 ? "The workspace’s Meta request allowance has been used." : snapshot.budget.globalRemaining <= 0 ? "The site’s Meta request allowance has been used." : !snapshot.liveAvailable ? "Live Meta requests are unavailable. You can still save drafts." : "";
  const reviewDisabledReason = !draftsComplete ? "Add both language drafts to review." : liveDisabledReason || (unchangedPublished ? "Edit the source drafts to review another revision." : "");
  const votes = Object.values(review?.votes ?? {});
  const inForce = hasPublished ? `Version ${room!.published.version} remains in force.` : "No policy is published.";
  const workspaceState = !room ? "Add English and Spanish registration policies to begin." : waiting && (activeAction && modelActions.has(activeAction) || running) ? `Reviewing with Meta. ${inForce}` : repairResult?.status === "blocked" ? `Rewrite blocked. ${inForce}` : repairResult?.status === "ready" ? `Rewrite awaiting approval (${Object.keys(repairResult.votes).length}/2). ${inForce}` : reviewUnresolved ? `Drafts need clarification. ${inForce}` : review && review.status !== "published" ? votes.length === 2 && votes[0] !== votes[1] ? `Reviewers selected different interpretations. ${inForce}` : `Waiting for reviewer approvals (${votes.length}/2). ${inForce}` : dirty ? `Unsaved source drafts. ${inForce}` : hasPublished ? `Version ${room!.published.version} in force.` : "Source drafts awaiting review.";
  const startRevision = () => { if (!room) return; setDrafts({ en: room.published.originalWording?.en ?? room.published.en, es: room.published.originalWording?.es ?? room.published.es }); markDirty(); setTab("policies"); };
  const failedRequest = interruptedRequest ?? (room?.automaticRepair?.status === "failed" ? room.automaticRepair : room?.automaticReview?.status === "failed" ? room.automaticReview : null);
  const progressText = activeAction === "repair" || room?.automaticRepair?.status === "running" && !room.repair?.job.proposalText ? "Drafting a checked repair with Meta" : activeAction === "checkRewrite" || room?.automaticRepair?.status === "running" ? "Checking the rewrite with Meta" : activeAction === "analyze" || room?.automaticReview?.status === "running" ? "Interpreting policies with Meta" : "Saving changes";
  const lastRequest = [room?.automaticReview, room?.automaticRepair].filter(Boolean).sort((a, b) => Date.parse(b!.startedAt) - Date.parse(a!.startedAt))[0];

  return <div className="workspace-app">
    <header className="wp-header" inert={Boolean(confirmation)} aria-hidden={confirmation ? true : undefined}><div className="wp-header-inner"><a className="wp-brand" href="/" aria-label="SamePage home"><span aria-hidden="true"><i /><i /></span>SamePage</a><nav aria-label="Workspace actions"><button className="wp-text-button" aria-expanded={about} onClick={() => setAbout(value => !value)}>About</button>{owner && room && <button className="wp-text-button" onClick={beginNewReview} disabled={waiting}><Plus size={18} />New review</button>}</nav></div></header>
    <main className="wp-main" inert={Boolean(confirmation)} aria-hidden={confirmation ? true : undefined}>
      {about && <section className="wp-about"><div className="wp-section-title"><h2>About SamePage</h2><button className="wp-icon-button" onClick={() => setAbout(false)} aria-label="Close About"><X size={22} /></button></div><p>Review English and Spanish registration policies, find people whose eligibility or fees would change, and check a rewrite before it is published.</p><p>Meta interprets the policy wording. SamePage compares the resulting rules, requires both reviewer roles to approve, and applies the approved rules to the registration form.</p><details><summary>Scope and access <ChevronDown size={16} /></summary><p>The checker supports age, residency, student status, membership, guardian consent, scholarships, fees, and application deadlines. Model interpretations need human review. Reviewer links grant access to a role; they do not verify a person’s identity.</p></details></section>}
      {error && <div className="wp-alert" role="alert"><strong>Action needs attention</strong><p>{error}</p></div>}
      {!loaded && <div className="wp-loading" role="status"><LoaderCircle size={22} className="wp-spin" />Opening workspace</div>}
      {loaded && snapshot && <>
        <div className="wp-heading"><div><h1>{room ? room.workspace.title : "Policy review"}</h1><p>{!owner && <>{reviewerName(actor as StudioEditor)}. </>}{workspaceState}</p></div><div className="wp-heading-actions">{room && owner && <button className="wp-button secondary" aria-expanded={shareOpen} onClick={() => setShareOpen(value => !value)}><Users size={18} />Reviewers</button>}{newReview && snapshot?.room && <button className="wp-text-button" onClick={() => void returnToReview()}>Return to current review</button>}{snapshot && owner && <details className="wp-usage"><summary>Meta API <ChevronDown size={16} /></summary><div><strong>{snapshot.budget.sessionRemaining} requests remaining</strong><p>{snapshot.budget.globalRemaining} remain in the site’s request allowance.</p>{lastRequest && <p>Last request: {lastRequest.status}{lastRequest.source === "meta" ? ", Meta" : ""}{lastRequest.metrics?.providerDurationMs ? `, ${(lastRequest.metrics.providerDurationMs / 1000).toFixed(1)}s` : ""}.</p>}<p>Requests run only when you review, check, or generate a repair. This allowance is not a billing balance.</p></div></details>}</div></div>
        {room && shareOpen && owner && <section className="wp-share" id="workspace-reviewer-links"><div className="wp-section-title"><h2>Invite reviewers</h2><button className="wp-icon-button" onClick={() => setShareOpen(false)} aria-label="Close reviewer links"><X size={20} /></button></div><p>Each private link grants access to one reviewer role.</p><div className="wp-reviewer-links">{EDITORS.map(editor => <div key={editor}><strong>{reviewerName(editor)}</strong><div>{invitations[editor] ? <><button className="wp-button secondary" onClick={() => void copyInvitation(invitations[editor]!)}><Copy size={16} />Copy link</button><a className="wp-text-button" href={invitationUrl(invitations[editor]!)} target="_blank" rel="noopener noreferrer">Open reviewer view <ExternalLink size={16} /></a></> : <button className="wp-button secondary" onClick={() => void invite(editor)} disabled={waiting}>Create review link</button>}</div></div>)}</div>{copyNotice && <p className="wp-copy-notice" role="status">{copyNotice}</p>}</section>}
        {room && <nav className="wp-tabs" aria-label="Policy workspace"><button className={tab === "policies" ? "active" : ""} aria-current={tab === "policies" ? "page" : undefined} onClick={() => setTab("policies")}>Policies</button><button className={tab === "review" ? "active" : ""} aria-current={tab === "review" ? "page" : undefined} onClick={() => setTab("review")}>Review</button><button className={tab === "form" ? "active" : ""} aria-current={tab === "form" ? "page" : undefined} onClick={() => setTab("form")} disabled={!hasPublished}>Registration</button></nav>}
        <div className={`wp-request-status${waiting ? " is-active" : ""}`} role="status" aria-live="polite">{waiting && <><LoaderCircle size={18} className="wp-spin" /><span>{progressText}{elapsed ? `, ${elapsed}s` : "…"}</span><span>{hasPublished ? `Version ${room!.published.version} remains in force.` : "Nothing is published yet."}</span></>}</div>
        {(!room || tab === "policies") && <section aria-label="Policy drafts">
          {owner ? <>
            <div className="wp-editor-tools"><label className="wp-title-field"><span>Policy name <small className="wp-optional">(optional)</small></span><input value={title} maxLength={120} onChange={event => { setTitle(event.target.value); markDirty(); }} placeholder="Name this policy" disabled={waiting} /></label><button className="wp-text-button" disabled={waiting} onClick={loadSample}><FileText size={17} />Load sample</button></div>
            {hasPublished && <div className="wp-source-label">Source drafts</div>}
            <PolicyEditors value={drafts} onChange={value => { setDrafts(value); markDirty(); }} disabled={waiting} />
            {staleDrafts && <div className="wp-alert"><strong>The saved drafts changed elsewhere.</strong><p>Your unsaved text is still here. Reload the saved drafts before making another update.</p><button className="wp-text-button" onClick={restoreDrafts}>Reload saved drafts</button></div>}
            <div className="wp-editor-bottom"><details className="wp-requirements"><summary>Policy requirements <ChevronDown size={16} /></summary><p>Include complete admission rules, fees or free admission, and an explicit deadline or no deadline. Supported facts are age, residency, student status, membership, guardian consent, and scholarships. Use exact dates and time zones for deadlines.</p><p>Ambiguous or unsupported rules stay unapproved until you clarify them.</p></details><div className="wp-actions"><span className="wp-save-state">{dirty ? "Unsaved changes" : room ? "Saved" : ""}</span><button className="wp-button secondary" disabled={waiting || staleDrafts || !dirty && Boolean(room)} onClick={() => void save()}>Save drafts</button><div className="wp-model-control"><button className="wp-button" disabled={waiting || staleDrafts || !draftsComplete || !usageAvailable || unchangedPublished} onClick={() => void analyze()}>Review with Meta <ArrowRight size={18} /></button><span className="wp-request-note">Uses 1 Meta request</span></div></div></div>
            {reviewDisabledReason && !waiting && <p className="wp-muted wp-unavailable">{reviewDisabledReason}</p>}
          </> : <SourceText text={{ en: room?.drafts.alice.text ?? "", es: room?.drafts.bob.text ?? "" }} />}
        </section>}
        {room && tab === "review" && <section className="wp-review" aria-label="Policy review results">
          {!review && !repairResult && <div className="wp-empty-panel"><h2>{waiting ? "Review in progress" : "Ready for review"}</h2><p>{waiting ? "Meta is interpreting both policy drafts. The results will appear here." : owner ? "Save both drafts, then review them with Meta." : "The workspace owner has not requested a policy review yet."}</p>{owner && !waiting && !failedRequest && <div className="wp-model-control"><button className="wp-button" disabled={!usageAvailable || !room.drafts.alice.text.trim() || !room.drafts.bob.text.trim()} onClick={() => void analyze()}>Review with Meta <ArrowRight size={18} /></button><span className="wp-request-note">Uses 1 Meta request</span>{liveDisabledReason && <p className="wp-muted">{liveDisabledReason}</p>}</div>}</div>}
          {review && review.status !== "published" && <>
            <div className="wp-section-title"><div><h2>{reviewUnresolved ? "Clarification required" : review.discovery.status === "different" ? "The policies produce different outcomes" : "The interpreted outcomes match"}</h2><p>{reviewUnresolved ? "Resolve these questions before either reviewer can approve." : review.discovery.status === "different" ? "Review the affected applicant and agree on the intended policy." : "Both reviewers still need to confirm the intended interpretation."}</p></div></div>
            {reviewUnresolved ? <IssueList issues={[...review.discovery.issues, ...review.candidates.flatMap(candidate => candidate.issues)]} /> : review.discovery.witnesses.length > 0 && <ComparisonCases witnesses={review.discovery.witnesses} leftRules={review.candidates[0]?.rules ?? null} rightRules={review.candidates[1]?.rules ?? null} leftLabel="English interpretation" rightLabel="Spanish interpretation" onWitnessChange={setReviewExample} />}
            <InterpretationDetails candidates={review.candidates} />
            {!reviewUnresolved && <section className="wp-approval-section"><h2>Agree on the intended policy</h2><ApprovalStatus room={room} kind="baseline" />{owner ? <p className="wp-muted">Both reviewers must approve the same interpretation.</p> : <>{review.discovery.status !== "equivalent" && <fieldset className="wp-candidates"><legend>Choose the interpretation to approve</legend>{review.candidates.map(candidate => { const decision = candidate.rules && reviewExample ? evaluateStudioPolicy(candidate.rules, reviewExample.attendee) : null; return <label key={candidate.id}><input type="radio" name="baseline" value={candidate.id} checked={candidateId === candidate.id} onChange={() => setCandidateId(candidate.id)} disabled={waiting || !candidate.rules || Boolean(candidate.issues.length)} /><span><strong>{languageName(candidate.editor)} interpretation</strong><span>Based on the {languageName(candidate.editor)} draft</span>{decision && <span className="wp-candidate-outcome">Shown applicant: {decision.accepted ? decision.feeCents ? `eligible, ${currency(decision.feeCents)} fee` : "eligible, free admission" : "not eligible"}</span>}</span></label>; })}</fieldset>}<button className="wp-button" disabled={waiting || !candidateId || review.votes[actor as StudioEditor] === candidateId} onClick={() => void execute({ action: "approveBaseline", roomId: room.id, reviewId: review.id, candidateId })}>{review.votes[actor as StudioEditor] === candidateId ? <><Check size={18} />Approved</> : <>{review.discovery.status === "equivalent" ? "Approve policy" : "Approve interpretation"} <ArrowRight size={18} /></>}</button></>}{owner && <button className="wp-button secondary" onClick={() => { setShareOpen(true); document.getElementById("workspace-reviewer-links")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Users size={18} />Invite reviewers</button>}</section>}
            {reviewUnresolved && owner && <button className="wp-button secondary" onClick={() => setTab("policies")}>Edit the policies</button>}
          </>}
          {hasPublished && (!repairResult || repairResult.status === "published") && <>
            <div className="wp-approved-line"><ShieldCheck size={22} /><span>Version {room.published.version} approved by both reviewers</span>{owner && <button className="wp-text-button" onClick={startRevision}>Review another revision</button>}<button className="wp-text-button" onClick={() => setTab("form")}>Open registration <ArrowRight size={17} /></button></div>
            {owner && baselineCurrent ? <section className="wp-proposal"><div className="wp-section-title"><div><h2>Check a proposed rewrite</h2><p>Change the wording while preserving every admission and fee outcome.</p></div><button className="wp-text-button" disabled={waiting} onClick={() => setProposal({ en: room.published.originalWording?.en ?? room.published.en, es: room.published.originalWording?.es ?? room.published.es })}>Use approved wording</button></div><PolicyEditors value={proposal} onChange={setProposal} disabled={waiting} proposal /><div className="wp-actions end"><button className="wp-button secondary" disabled={waiting || !usageAvailable} onClick={() => void repair()}>Generate rewrite</button><button className="wp-button" disabled={waiting || !proposalComplete || !usageAvailable} onClick={() => void checkRewrite()}>Check with Meta<ArrowRight size={18} /></button></div><p className="wp-request-note right">Uses 1 Meta request</p>{(liveDisabledReason || !proposalComplete) && <p className="wp-muted right">{liveDisabledReason || "Add both proposed drafts to check the wording."}</p>}</section> : repairResult?.status === "published" ? <div className="wp-empty-panel"><h2>The checked rewrite is published</h2><p>The registration form uses version {room.published.version}.</p></div> : !owner && baselineCurrent ? <div className="wp-empty-panel"><h2>The current policy is approved</h2><p>The registration form now uses version {room.published.version}. A new proposed rewrite will appear here when the owner requests a check.</p></div> : null}
          </>}
          {repairResult && ["blocked", "ready", "failed", "running"].includes(repairResult.status) && <RepairReview key={repairResult.id} room={room} repair={repairResult} actor={actor} waiting={waiting} liveAvailable={usageAvailable} onRepair={repair} onApprove={() => void execute({ action: "approveRepair", roomId: room.id, repairId: repairResult.id })} onEdit={() => { setProposal(repairResult.job.proposalText ?? { en: repairResult.proposal?.en ?? "", es: repairResult.proposal?.es ?? "" }); }} proposal={proposal} setProposal={setProposal} onCheck={checkRewrite} disabledReason={liveDisabledReason} />}
          {failedRequest && !waiting && <div className="wp-alert"><strong>Meta request did not complete</strong><p>{failedRequest.error?.message ?? "Nothing from this request was published."}</p>{owner && <button className="wp-button secondary" disabled={!usageAvailable} onClick={() => room.automaticRepair === failedRequest ? void (room.repair?.job.proposalText ? checkRewrite(true) : repair(true)) : void analyze(true)}>Retry with Meta</button>}{owner && <p className="wp-request-note">Uses 1 Meta request</p>}{owner && liveDisabledReason && <p className="wp-muted">{liveDisabledReason}</p>}</div>}
        </section>}
        {room && tab === "form" && hasPublished && <RegistrationForm key={`${room.id}:${room.published.version}`} room={room} waiting={waiting} owner={owner} execute={execute} />}
      </>}
    </main>
    {confirmation && <ConfirmationDialog confirmation={confirmation} onResolve={settleConfirmation} returnFocus={confirmationTrigger.current} />}
  </div>;
}


function ConfirmationDialog({ confirmation, onResolve, returnFocus }: { confirmation: Confirmation; onResolve: (accepted: boolean) => void; returnFocus: HTMLElement | null }) {
  const dialog = useRef<HTMLDivElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onResolve(false); return; }
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [onResolve, returnFocus]);
  return <div className="wp-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onResolve(false); }}>
    <div className="wp-confirm-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="workspace-confirm-title" aria-describedby="workspace-confirm-message">
      <h2 id="workspace-confirm-title">{confirmation.title}</h2>
      <p id="workspace-confirm-message">{confirmation.message}</p>
      <div className="wp-actions end"><button type="button" className="wp-button secondary" ref={cancel} onClick={() => onResolve(false)}>Cancel</button><button type="button" className="wp-button" onClick={() => onResolve(true)}>Continue</button></div>
    </div>
  </div>;
}

function PolicyEditors({ value, onChange, disabled, proposal = false }: { value: StudioText; onChange: (value: StudioText) => void; disabled: boolean; proposal?: boolean }) {
  return <div className="wp-policy-editors">{(["en", "es"] as const).map(language => <label className={`wp-policy-editor ${language}`} key={language}><span className="wp-editor-heading"><strong>{language === "en" ? "English" : "Español"}</strong>{proposal && <span>Proposed wording</span>}</span><textarea lang={language} maxLength={4000} value={value[language]} onChange={event => onChange({ ...value, [language]: event.target.value })} disabled={disabled} aria-label={`${proposal ? "Proposed" : "Source"} ${language === "en" ? "English" : "Spanish"} policy`} placeholder={language === "en" ? "Paste the full policy in English…" : "Pega la política completa en español…"} /><span className="wp-editor-count">{value[language].length.toLocaleString()} / 4,000</span></label>)}</div>;
}
function SourceText({ text }: { text: StudioText }) { return <div className="wp-source-grid"><article><h3>English</h3><p lang="en">{text.en || "No English draft saved."}</p></article><article><h3>Español</h3><p lang="es">{text.es || "No Spanish draft saved."}</p></article></div>; }
function IssueList({ issues }: { issues: string[] }) { const unique = [...new Set(issues)].filter(Boolean); return <div className="wp-issues">{unique.length ? unique.map(issue => <p key={issue}>{issue}</p>) : <p>The interpretation could not be validated. Clarify the policy before continuing.</p>}</div>; }
function InterpretationDetails({ candidates }: { candidates: StudioCandidate[] }) { return <details className="wp-details"><summary>Full interpretations <ChevronDown size={17} /></summary>{candidates.map(candidate => <section key={candidate.id}><h3>{languageName(candidate.editor)} interpretation</h3><SourceText text={candidate} />{candidate.issues.length > 0 && <IssueList issues={candidate.issues} />}</section>)}</details>; }
function ApprovalStatus({ room, kind }: { room: StudioRoom; kind: "baseline" | "repair" }) {
  const votes = kind === "baseline" ? room.review?.votes : room.repair?.votes;
  return <div className="wp-approval-status">{EDITORS.map(editor => { const vote = votes?.[editor]; const candidate = kind === "baseline" && typeof vote === "string" ? room.review?.candidates.find(c => c.id === vote) : null; return <div key={editor}><strong>{reviewerName(editor)}</strong><span className={vote ? "approved" : ""}>{vote ? <><Check size={17} />{candidate ? `Approved ${languageName(candidate.editor)} interpretation` : "Approved"}</> : "Awaiting approval"}</span></div>; })}</div>;
}
function ComparisonCases({ witnesses, leftRules, rightRules, leftLabel, rightLabel, blocked = false, onWitnessChange }: { witnesses: StudioWitness[]; leftRules: StudioRules | null; rightRules: StudioRules | null; leftLabel: string; rightLabel: string; blocked?: boolean; onWitnessChange?: (witness: StudioWitness) => void }) {
  const [index, setIndex] = useState(0);
  const displayed = useMemo(() => witnesses.map(witness => realisticStudioWitness(leftRules, rightRules, witness)), [witnesses, leftRules, rightRules]);
  const witness = displayed[Math.min(index, displayed.length - 1)];
  useEffect(() => { if (witness && onWitnessChange) onWitnessChange(witness); }, [witness, onWitnessChange]);
  if (!witness) return null;
  return <div className="wp-comparison">{witnesses.length > 1 && <label className="wp-case-select">Affected outcomes<select value={Math.min(index, witnesses.length - 1)} onChange={event => setIndex(Number(event.target.value))}>{displayed.map((item, i) => <option key={item.id} value={i}>{`${i + 1}. ${item.kind === "price-only" ? "Different fee" : item.left.accepted ? `${leftLabel} admits` : `${rightLabel} admits`}: age ${item.attendee.age}, ${item.attendee.resident ? "resident" : "nonresident"}, ${item.attendee.student ? "student" : "not a student"}`}</option>)}</select></label>}<OutcomeCard witness={witness} leftRules={leftRules} rightRules={rightRules} leftLabel={leftLabel} rightLabel={rightLabel} blocked={blocked} /></div>;
}
function OutcomeCard({ witness, leftRules, rightRules, leftLabel, rightLabel, blocked = false }: { witness: StudioWitness; leftRules: StudioRules | null; rightRules: StudioRules | null; leftLabel: string; rightLabel: string; blocked?: boolean }) {
  const attendee = witness.attendee;
  const showFee = (witness.left.feeCents ?? 0) > 0 || (witness.right.feeCents ?? 0) > 0 || witness.kind === "price-only";
  return <section className={`wp-outcome-card${blocked ? " blocked" : ""}`} aria-label="Affected applicant and outcomes"><div className="wp-person"><span>Example applicant</span><h3>{attendee.age}-year-old applicant</h3><p>{attendee.resident ? "Resident" : "Nonresident"}, {attendee.student ? "student" : "not a student"}, {attendee.member ? "member" : "not a member"}</p><p>{attendee.guardianConsent ? "Guardian consent provided" : "No guardian consent"}, {attendee.scholarship ? "scholarship" : "no scholarship"}</p><details><summary>Application time <ChevronDown size={15} /></summary><time dateTime={attendee.submittedAt}>{readableTime(attendee.submittedAt)}</time></details></div><div className="wp-outcome-results">{([{ label: leftLabel, decision: witness.left, rules: leftRules }, { label: rightLabel, decision: witness.right, rules: rightRules }]).map((side, i) => <div key={i} className={!side.decision.accepted ? "rejected" : ""}><span>{side.label}</span><strong>{side.decision.accepted ? "Eligible" : "Not eligible"}</strong>{showFee && side.decision.accepted && <p className="wp-outcome-fee">{currency(side.decision.feeCents ?? 0)} registration fee</p>}<p>{side.decision.accepted ? "Meets the admission rules" : summarizeAdmissionFailure(side.rules, attendee, side.decision)}</p></div>)}</div></section>;
}
function RepairReview({ room, repair, actor, waiting, liveAvailable, onRepair, onApprove, onEdit, proposal, setProposal, onCheck, disabledReason }: { room: WorkspaceRoom; repair: StudioRepair; actor: Actor; waiting: boolean; liveAvailable: boolean; onRepair: (retry?: boolean) => Promise<void>; onApprove: () => void; onEdit: () => void; proposal: StudioText; setProposal: (value: StudioText) => void; onCheck: (retry?: boolean) => Promise<void>; disabledReason: string }) {
  const [editing, setEditing] = useState(false);
  const blocked = repair.impact?.status === "blocked", unresolved = repair.impact?.status === "unresolved" || repair.status === "failed";
  const owner = actor === "owner";
  const witness = repair.impact?.verification.witnesses[0];
  const displayWitness = witness ? realisticStudioWitness(repair.impact!.expectedRules, repair.proposal?.rules ?? null, witness) : undefined;
  const effect = displayWitness ? studioIntroducedFlagEffect(repair.job.baseline.rules, repair.proposal?.rules, displayWitness.attendee) : null;
  const names: Record<StudioFlag, string> = { resident: "residency", student: "student status", member: "membership", guardianConsent: "guardian consent", scholarship: "a scholarship" };
  return <section className="wp-repair-review"><div className="wp-section-title"><div><h2>{blocked ? "The rewrite changes an outcome" : unresolved ? "The rewrite needs clarification" : repair.status === "running" ? "Checking the rewrite" : "The checked rewrite preserves the outcomes"}</h2><p>{blocked || unresolved ? "Publication blocked. The approved policy stays in force." : repair.status === "running" ? "The approved policy stays in force while the check runs." : "Both reviewers must approve this exact wording before publication."}</p></div>{owner && blocked && <div className="wp-model-control"><button className="wp-button" onClick={() => void onRepair()} disabled={waiting || !liveAvailable}>Generate repair <ArrowRight size={18} /></button><span className="wp-request-note">Uses 1 Meta request</span></div>}</div>
    {repair.impact?.status === "pass" && <div className="wp-approved-line"><ShieldCheck size={22} /><div><span>No eligibility or fee changes found</span><p className="wp-check-scope">Compared with version {repair.job.basePolicyVersion} across supported applicant facts.</p></div></div>}
    {repair.impact?.verification.witnesses.length ? <ComparisonCases witnesses={repair.impact.verification.witnesses} leftRules={repair.impact.expectedRules} rightRules={repair.proposal?.rules ?? null} leftLabel="Approved policy" rightLabel="Proposed rewrite" blocked={blocked} /> : null}
    {effect && <div className="wp-effect"><h3>{effect.losesAccessOnAddition ? `Adding ${names[effect.flag]} removes access` : `Changing ${names[effect.flag]} changes access`}</h3><p>With every other fact unchanged:</p><div><span>Without {names[effect.flag]}: <strong>{effect.withoutFlag.accepted ? "Eligible" : "Not eligible"}</strong></span><span>With {names[effect.flag]}: <strong>{effect.withFlag.accepted ? "Eligible" : "Not eligible"}</strong></span></div></div>}
    {unresolved && <IssueList issues={[...(repair.impact?.issues ?? []), ...(repair.proposal?.issues ?? [])]} />}
    {repair.proposal && (!owner && repair.status === "ready" ? <section className="wp-wording-review"><h3>Wording for approval</h3><SourceText text={repair.proposal} /></section> : <details className="wp-details"><summary>Full wording <ChevronDown size={17} /></summary><SourceText text={repair.proposal} /></details>)}
    {repair.status === "ready" && <section className="wp-approval-section"><h2>{Object.keys(repair.votes).length === 1 ? "One approval received" : "Approve the checked rewrite"}</h2><p className="wp-muted">The form continues to use version {room.published.version} until both reviewers approve.</p><ApprovalStatus room={room} kind="repair" />{!owner && <button className="wp-button" disabled={waiting || Boolean(repair.votes[actor])} onClick={onApprove}>{repair.votes[actor] ? <><Check size={18} />Approved</> : <>Approve rewrite <ArrowRight size={18} /></>}</button>}</section>}
    {owner && disabledReason && <p className="wp-muted">{disabledReason}</p>}
    {owner && !waiting && repair.status !== "running" && <div className="wp-edit-rewrite"><button className="wp-text-button" onClick={() => { onEdit(); setEditing(value => !value); }}>{editing ? "Close editor" : "Edit proposed wording"}<ChevronDown size={16} /></button>{editing && <><PolicyEditors value={proposal} onChange={setProposal} disabled={waiting} proposal /><div className="wp-actions end"><button className="wp-button" disabled={!liveAvailable || !proposal.en.trim() || !proposal.es.trim()} onClick={() => void onCheck()}>Check with Meta<ArrowRight size={18} /></button></div><p className="wp-request-note right">Uses 1 Meta request</p></>}</div>}
  </section>;
}
function initialAttendee(room: WorkspaceRoom): StudioAttendee {
  const repair = room.repair, blocked = [...(room.repairHistory ?? [])].reverse().find(item => item.impact?.verification.witnesses.length);
  const source = repair?.impact?.verification.witnesses[0] ? repair : blocked;
  if (source?.impact?.verification.witnesses[0]) return realisticStudioWitness(source.impact.expectedRules, source.proposal?.rules ?? null, source.impact.verification.witnesses[0]).attendee;
  const first = room.review?.discovery.witnesses[0];
  if (first && room.review) return realisticStudioWitness(room.review.candidates[0]?.rules ?? null, room.review.candidates[1]?.rules ?? null, first).attendee;
  return { age: 24, resident: false, student: false, member: false, guardianConsent: false, scholarship: false, submittedAt: new Date().toISOString() };
}
function RegistrationForm({ room, waiting, owner, execute }: { room: WorkspaceRoom; waiting: boolean; owner: boolean; execute: (action: Action) => Promise<Snapshot | null> }) {
  const seed = useMemo(() => initialAttendee(room), [room.id, room.published.version]);
  const [attendee, setAttendee] = useState<StudioAttendee>({ age: 0, resident: false, student: false, member: false, guardianConsent: false, scholarship: false, submittedAt: "" }), [age, setAge] = useState(""), [time, setTime] = useState(""), [label, setLabel] = useState("");
  const useExample = () => { setAttendee(seed); setAge(String(seed.age)); setTime(seed.submittedAt.replace(/Z$/, "")); setLabel(""); };
  const parsedTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(time) ? new Date(`${time}Z`) : null;
  const valid = /^\d{1,3}$/.test(age) && Number(age) <= 120 && parsedTime !== null && Number.isFinite(parsedTime.getTime());
  const current = valid ? { ...attendee, age: Number(age), submittedAt: parsedTime!.toISOString() } : null;
  const decision = current ? evaluateStudioPolicy(room.published.rules, current) : null;
  return <section><div className="wp-section-title"><div><h2>Registration check</h2><p>Decisions use the policy approved by both reviewers.</p></div><button className="wp-button secondary" onClick={useExample} disabled={waiting}>Use example applicant</button></div><div className="wp-form-layout"><form className="wp-registration" onSubmit={event => { event.preventDefault(); if (current && owner) void execute({ action: "register", roomId: room.id, policyVersion: room.published.version, attendee: current, label: label.trim() || `${current.resident ? "Resident" : "Nonresident"}, ${current.student ? "student" : "not a student"}, ${current.member ? "member" : "not a member"}` }); }}><label className="wp-field">Applicant reference<input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} placeholder="Optional reference" disabled={waiting} /></label><div className="wp-form-inputs"><label className="wp-field">Age<input type="number" min="0" max="120" step="1" value={age} onChange={event => setAge(event.target.value)} disabled={waiting} /></label><label className="wp-field">Application time (UTC)<input type="datetime-local" step="0.001" value={time} onChange={event => setTime(event.target.value)} disabled={waiting} /></label></div><fieldset className="wp-flags"><legend>Applicant details</legend>{flags.map(flag => <label key={flag.key}><input type="checkbox" checked={attendee[flag.key]} onChange={event => setAttendee(previous => ({ ...previous, [flag.key]: event.target.checked }))} disabled={waiting} />{flag.label}</label>)}</fieldset><div className={`wp-form-result ${decision?.accepted ? "accepted" : "rejected"}`} role="status"><span>Approved policy v{room.published.version}</span><strong>{decision ? decision.accepted ? "Eligible" : "Not eligible" : "Complete the applicant details"}</strong>{decision?.accepted && <p>{decision.feeCents ? `${currency(decision.feeCents)} registration fee` : "Free admission"}</p>}{decision && !decision.accepted && current && <p>{summarizeAdmissionFailure(room.published.rules, current, decision)}</p>}</div>{owner ? <button type="submit" className="wp-button" disabled={waiting || !valid}>Save decision <ArrowRight size={18} /></button> : <p className="wp-muted">Only the workspace owner can save decisions.</p>}</form><section className="wp-receipts"><h3>Decision receipts</h3>{room.registrations.length ? <ol>{[...room.registrations].reverse().map(receipt => <li key={receipt.id}><div><strong>{receipt.decision.accepted ? "Eligible" : "Not eligible"}</strong><span>v{receipt.policyVersion}</span></div><p>{receipt.label}</p><p className="wp-muted">{receipt.age} years old</p>{receipt.decision.accepted && <p>{receipt.decision.feeCents ? `${currency(receipt.decision.feeCents)} registration fee` : "Free admission"}</p>}<details><summary>Receipt details <ChevronDown size={15} /></summary><p>Applied: {readableTime(receipt.submittedAt)}</p><p>Saved: {readableTime(receipt.recordedAt)}</p><p>{flags.map(flag => `${flag.label}: ${receipt[flag.key] ? "Yes" : "No"}`).join(", ")}</p></details></li>)}</ol> : <p className="wp-empty-copy">Saved decisions and their policy versions will appear here.</p>}</section></div><details className="wp-details"><summary>Published policy <ChevronDown size={17} /></summary><SourceText text={room.published} /></details></section>;
}
