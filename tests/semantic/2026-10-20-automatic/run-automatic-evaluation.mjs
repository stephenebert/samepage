import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// This runner is deliberately opt-in and performs no provider retry.
// It never uses the manual completeReview action or sends a provider API key.
const corpusRoot = path.dirname(fileURLToPath(import.meta.url));
const engineURL = new URL('../../../lib/counterexamples.ts', import.meta.url);
const editors = ['alice', 'bob'];
const minTime = Date.parse('0000-01-01T00:00:00.000Z');
const maxTime = Date.parse('9999-12-31T23:59:59.999Z');
const hash = value => createHash('sha256').update(value).digest('hex');
let siteAuthorization = '';
let runDir;
let results;
const http = [];

function demand(condition, message) { assert.ok(condition, message); }
function redact(value) {
  if (typeof value === 'string') return siteAuthorization ? value.split(siteAuthorization).join('[REDACTED]') : value;
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
  return value;
}
function safeFailure(error) {
  // Assertion messages here are authored by this runner, not provider bodies.
  return { name: error?.name || 'Error', message: redact(String(error?.message || 'Evaluation failed')).slice(0, 2000) };
}
async function save(name, value) {
  demand(runDir && path.basename(name) === name, 'Invalid evidence filename.');
  const safe = redact(value);
  await fs.writeFile(path.join(runDir, name), typeof safe === 'string' ? safe : `${JSON.stringify(safe, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}
async function checkpoint() {
  // This one mutable file is an explicit progress record inside a new run.
  await fs.writeFile(path.join(runDir, 'results.json'), `${JSON.stringify(redact(results), null, 2)}\n`, { mode: 0o600 });
}
async function inputAuthorization() {
  if (process.stdin.isTTY) return;
  let body = '';
  for await (const chunk of process.stdin) {
    body += chunk.toString();
    demand(Buffer.byteLength(body) <= 16384, 'Authorization stdin is too large.');
  }
  if (!body.trim()) return;
  let supplied;
  try { supplied = JSON.parse(body); } catch { throw new Error('Authorization stdin must be JSON.'); }
  demand(supplied && typeof supplied === 'object' && !Array.isArray(supplied), 'Authorization stdin must be an object.');
  demand(Object.keys(supplied).every(key => key === 'siteAuthorization'), 'Authorization stdin accepts only siteAuthorization.');
  if (supplied.siteAuthorization === undefined) return;
  demand(typeof supplied.siteAuthorization === 'string' && supplied.siteAuthorization.length <= 4096 && !/\s/.test(supplied.siteAuthorization), 'siteAuthorization must be a raw token with no whitespace.');
  siteAuthorization = supplied.siteAuthorization;
}
async function canonicalFuturePath(value) {
  let existing = value;
  const missing = [];
  while (true) {
    try { return path.join(await fs.realpath(existing), ...missing.reverse()); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(existing);
      demand(parent !== existing, 'Cannot resolve the run directory.');
      missing.push(path.basename(existing)); existing = parent;
    }
  }
}
function within(child, parent) { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); }
async function verifyRunDestination() {
  const requested = process.env.SAMEPAGE_EVAL_RUN_DIR;
  demand(typeof requested === 'string' && path.isAbsolute(requested), 'Set SAMEPAGE_EVAL_RUN_DIR to a fresh absolute directory outside the corpus/source archive.');
  const destination = await canonicalFuturePath(requested);
  const forbidden = [await fs.realpath(corpusRoot), await canonicalFuturePath(path.dirname(path.dirname(fileURLToPath(engineURL))))];
  // Also protect the containing Git checkout after this runner is copied into it.
  for (let current = corpusRoot; ; current = path.dirname(current)) {
    try { await fs.lstat(path.join(current, '.git')); forbidden.push(await fs.realpath(current)); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(current) === current) break;
  }
  demand(forbidden.every(root => !within(destination, root) && !within(root, destination)), 'Run output must be outside the corpus and source checkout, and cannot be their ancestor.');
  try { await fs.lstat(destination); throw new Error('SAMEPAGE_EVAL_RUN_DIR already exists; refusing to overwrite or resume.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return destination;
}
function baseOrigin() {
  const url = new URL(process.env.SAMEPAGE_TEST_URL || 'http://127.0.0.1:5173');
  demand(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'SAMEPAGE_TEST_URL must be an origin without credentials, path, query, or fragment.');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  demand(url.protocol === 'https:' || (url.protocol === 'http:' && loopback), 'Use HTTPS for remote Sites or HTTP on loopback only.');
  demand(!siteAuthorization || url.protocol === 'https:' || loopback, 'Site authorization requires HTTPS except for local guard tests.');
  return url.origin;
}
async function boundedJSON(response) {
  const reader = response.body?.getReader();
  demand(reader, 'HTTP response had no body.');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new Error('HTTP response exceeded the evaluation limit.'); }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('HTTP response was not valid JSON.'); }
}
async function api(base, suffix, body) {
  const method = body === undefined ? 'GET' : 'POST';
  const headers = { Accept: 'application/json' };
  if (body !== undefined) Object.assign(headers, { 'Content-Type': 'application/json', Origin: base });
  if (siteAuthorization) headers['OAI-Sites-Authorization'] = `Bearer ${siteAuthorization}`;
  const entry = { method, path: suffix, startedAt: new Date().toISOString() };
  http.push(entry);
  const started = performance.now();
  try {
    const response = await fetch(`${base}${suffix}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(75_000),
    });
    entry.httpStatus = response.status;
    const data = await boundedJSON(response);
    if (typeof data?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(data.code)) entry.code = data.code;
    return { ok: response.ok, status: response.status, data };
  } catch {
    entry.transportFailure = true;
    throw new Error(`${method} ${suffix} failed at the transport/JSON boundary; no retry was made.`);
  } finally { entry.durationMs = performance.now() - started; }
}
async function success(base, suffix, body) {
  const output = await api(base, suffix, body);
  demand(output.ok, `${body === undefined ? 'GET' : 'POST'} ${suffix} returned HTTP ${output.status}; no retry was made.`);
  return output.data;
}
function roomIn(value) {
  const room = value?.room;
  demand(room && typeof room.id === 'string' && /^consequence-[a-zA-Z0-9_-]+$/.test(room.id), 'Server response did not contain a valid consequences room.');
  return room;
}
const roomPath = id => `/api/consequences/${encodeURIComponent(id)}`;
const change = async (base, id, action) => roomIn(await success(base, roomPath(id), action));

// Independent executable oracle. Do not import evaluatePolicy/parsePolicyRules.
function validateRules(rules) {
  if (rules === null) return;
  demand(rules && typeof rules === 'object' && !Array.isArray(rules), 'Compiled rules must be an object or null.');
  demand(JSON.stringify(Object.keys(rules).sort()) === JSON.stringify(['deadline', 'deadlineInclusive', 'join', 'minAge', 'residentRequired']), 'Unexpected compiled rule fields.');
  demand(rules.minAge === null || (Number.isInteger(rules.minAge) && rules.minAge >= 0 && rules.minAge <= 120), 'Invalid compiled age.');
  demand(typeof rules.residentRequired === 'boolean' && typeof rules.deadlineInclusive === 'boolean' && ['all', 'any'].includes(rules.join), 'Invalid compiled predicates.');
  if (rules.deadline !== null) {
    demand(typeof rules.deadline === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(rules.deadline), 'Deadline must be an explicit UTC timestamp.');
    const normalized = rules.deadline.includes('.') ? rules.deadline : rules.deadline.replace('Z', '.000Z');
    const timestamp = Date.parse(rules.deadline);
    demand(Number.isFinite(timestamp) && new Date(timestamp).toISOString() === normalized, 'Invalid UTC date.');
  }
}
function oracle(rules, attendee) {
  if (rules === null) return null;
  const predicates = [];
  if (rules.minAge !== null) predicates.push(attendee.age >= rules.minAge);
  if (rules.residentRequired) predicates.push(attendee.resident);
  const eligible = predicates.length === 0 || (rules.join === 'all' ? predicates.every(Boolean) : predicates.some(Boolean));
  const onTime = rules.deadline === null || (rules.deadlineInclusive ? Date.parse(attendee.submittedAt) <= Date.parse(rules.deadline) : Date.parse(attendee.submittedAt) < Date.parse(rules.deadline));
  return eligible && onTime;
}
function representativeTimes(ruleObjects) {
  const times = new Set([minTime, maxTime]);
  for (const rules of ruleObjects) if (rules?.deadline) for (const offset of [-1, 0, 1]) {
    const time = Date.parse(rules.deadline) + offset;
    if (time >= minTime && time <= maxTime) times.add(time);
  }
  return [...times];
}
function semanticsMatch(actual, expected) {
  if (actual === null || expected === null) return actual === expected;
  const times = representativeTimes([actual, expected]);
  for (let age = 0; age <= 120; age++) for (const resident of [false, true]) for (const time of times) {
    const attendee = { age, resident, submittedAt: new Date(time).toISOString() };
    if (oracle(actual, attendee) !== oracle(expected, attendee)) return false;
  }
  return true;
}
function independentDirections(left, right) {
  if (left === null || right === null) return [];
  const directions = new Set();
  for (let age = 0; age <= 120; age++) for (const resident of [false, true]) for (const time of representativeTimes([left, right])) {
    const attendee = { age, resident, submittedAt: new Date(time).toISOString() };
    const a = oracle(left, attendee), b = oracle(right, attendee);
    if (a && !b) directions.add('alice-only');
    if (b && !a) directions.add('bob-only');
  }
  return [...directions].sort();
}
function noApproval(room, baseline) {
  demand(JSON.stringify(room.published) === JSON.stringify(baseline), 'Automatic review or an unapproved proposal changed the published policy.');
  demand(room.review?.status === 'open' && Object.keys(room.review.votes).length === 0, 'Automatic review manufactured an approval.');
}
async function register(base, room, attendee, label, receipts) {
  const requestId = `evaluation-${randomUUID()}`;
  const input = { age: attendee.age, resident: attendee.resident, submittedAt: attendee.submittedAt };
  const expected = oracle(room.published.rules, input);
  const updated = await change(base, room.id, { type: 'register', requestId, policyVersion: room.published.version, label, ...input });
  const record = updated.registrations.find(item => item.requestId === requestId);
  demand(record && record.policyVersion === room.published.version && record.decision.accepted === expected, 'Saved form receipt disagrees with the independent oracle/published version.');
  demand(record.age === input.age && record.resident === input.resident && Date.parse(record.submittedAt) === Date.parse(input.submittedAt), 'Form receipt changed attendee fields or timestamp precision.');
  receipts.push({ phase: label, independentExpected: expected, record });
  return updated;
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--run') {
    console.log('UNRUN. Usage: SAMEPAGE_EVAL_RUN_DIR=/tmp/fresh-run node --experimental-strip-types run-automatic-evaluation.mjs --run < /dev/null');
    console.log('A configured server may incur one model request per case. Optional stdin JSON: {"siteAuthorization":"<raw Site token>"}. Never supply a Meta API key to this runner.');
    return;
  }
  await inputAuthorization();
  const destination = await verifyRunDestination();
  const base = baseOrigin();
  const source = await fs.readFile(path.join(corpusRoot, 'cases.json'));
  const expectations = await fs.readFile(path.join(corpusRoot, 'EXPECTATIONS.md'));
  const frozen = JSON.parse(await fs.readFile(path.join(corpusRoot, 'corpus-freeze.json'), 'utf8'));
  demand(hash(source) === frozen.sha256['cases.json'] && hash(expectations) === frozen.sha256['EXPECTATIONS.md'], 'Frozen corpus hashes do not match; refusing provider exposure.');
  const corpus = JSON.parse(source.toString('utf8')).cases;
  demand(Array.isArray(corpus) && corpus.length === 6, 'Expected the frozen six-pair corpus.');
  const preflight = await success(base, '/api/consequences/model');
  if (preflight?.model?.ready !== true) {
    console.log('NOT RUN: automatic model integration is unconfigured. No rooms were created and no review/provider requests were made.');
    process.exitCode = 2;
    return;
  }
  const { discoverCounterexamples } = await import(engineURL.href);
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fs.mkdir(destination, { mode: 0o700 });
  runDir = destination;
  const manifest = {
    startedAt: new Date().toISOString(), targetOrigin: base,
    corpus: frozen, runnerSHA256: hash(await fs.readFile(fileURLToPath(import.meta.url))),
    model: { provider: preflight.model.provider, model: preflight.model.model, ready: preflight.model.ready, mode: preflight.model.mode },
    evidenceBoundary: 'Prompts and server-parsed candidates/automatic metadata are recorded. The API does not return raw provider responses; none are claimed.',
    policy: 'At most one POST to the automatic review endpoint per case; no retry or manual completion.',
  };
  await save('manifest.json', manifest);
  results = { status: 'running', liveProviderValidation: 'running', cases: corpus.map(item => ({ id: item.id, status: 'not-run' })) };
  await checkpoint();
  for (const [index, item] of corpus.entries()) {
    const report = results.cases[index];
    report.status = 'running'; report.startedAt = new Date().toISOString();
    const started = performance.now();
    try {
      let room = roomIn(await success(base, '/api/consequences', {}));
      report.roomId = room.id;
      const baseline = structuredClone(room.published);
      for (const editor of editors) room = await change(base, room.id, { type: 'draft', editor, baseVersion: room.drafts[editor].version, text: item.drafts[editor] });
      room = await change(base, room.id, { type: 'requestReview' });
      demand(room.activeJob && !room.review, 'Fresh review job was not prepared.');
      const job = structuredClone(room.activeJob);
      report.jobId = job.id; report.promptSHA256 = hash(job.prompt);
      await save(`${item.id}.before.json`, room);
      await save(`${item.id}.prompt.txt`, job.prompt);
      const reviewStarted = performance.now();
      const output = await api(base, `${roomPath(room.id)}/review`, {});
      report.reviewHttpStatus = output.status;
      report.reviewRoundTripMs = performance.now() - reviewStarted;
      report.automatic = output.data?.automatic;
      if (output.data?.room) {
        room = roomIn(output.data);
        report.automaticMetadata = room.automaticReview;
        await save(`${item.id}.automatic-result.json`, {
          note: 'Parsed application state, not a raw Meta provider response.',
          httpStatus: output.status, automatic: output.data.automatic,
          metadata: room.automaticReview, review: room.review,
        });
      }
      demand(output.ok && output.data?.automatic?.status === 'completed', 'Automatic review did not complete successfully; no retry was made.');
      demand(room.mode === 'automatic-model' && room.automaticReview?.status === 'completed' && room.automaticReview?.jobId === job.id, 'Result lacks completed automatic-model provenance for this exact job.');
      demand(room.review?.id === job.id && room.review?.basePolicyVersion === baseline.version, 'Review is not bound to the prepared job/policy version.');
      noApproval(room, baseline);
      const candidates = Object.fromEntries(room.review.candidates.map(candidate => [candidate.editor, candidate]));
      demand(Object.keys(candidates).sort().join(',') === 'alice,bob' && room.review.candidates.length === 2, 'Expected one candidate for each editor.');
      report.scenarioChecks = [];
      for (const editor of editors) {
        const candidate = candidates[editor];
        validateRules(candidate.rules); validateRules(item.expected[editor].rules);
        demand(candidate.sourceVersion === job.drafts[editor].version && candidate[editor === 'alice' ? 'en' : 'es'] === item.drafts[editor], `${item.id}/${editor}: source text or version changed.`);
        demand(semanticsMatch(candidate.rules, item.expected[editor].rules), `${item.id}/${editor}: compiled policy differs from frozen expected meaning.`);
        demand(Array.isArray(candidate.issues) && ((candidate.rules === null && candidate.issues.length > 0) || (candidate.rules !== null && candidate.issues.length === 0)), 'Executable/blocked issue invariant failed.');
        for (const scenario of item.scenarios) {
          const actual = oracle(candidate.rules, scenario);
          demand(actual === scenario.expected[editor], `${item.id}/${editor}: scenario outcome differs from the frozen expectation.`);
          report.scenarioChecks.push({ editor, attendee: { age: scenario.age, resident: scenario.resident, submittedAt: scenario.submittedAt }, expected: scenario.expected[editor], actual });
        }
      }
      const discoveredAt = performance.now();
      const discovery = discoverCounterexamples(candidates.alice.rules, candidates.bob.rules);
      report.discoveryMs = performance.now() - discoveredAt;
      report.discovery = discovery;
      demand(discovery.status === item.expected.comparison, `${item.id}: discovery comparison is wrong.`);
      const actualDirections = discovery.witnesses.map(witness => witness.direction === 'left-only' ? 'alice-only' : 'bob-only').sort();
      const independentlyPossible = independentDirections(candidates.alice.rules, candidates.bob.rules);
      demand(JSON.stringify(actualDirections) === JSON.stringify([...item.expected.directions].sort()) && JSON.stringify(actualDirections) === JSON.stringify(independentlyPossible), `${item.id}: missed, invented, or duplicated counterexample direction.`);
      for (const witness of discovery.witnesses) {
        const a = oracle(candidates.alice.rules, witness.attendee), b = oracle(candidates.bob.rules, witness.attendee);
        demand(typeof a === 'boolean' && typeof b === 'boolean' && a !== b, 'Discovered attendee is not an independent-oracle counterexample.');
        demand(witness.left.accepted === a && witness.right.accepted === b, 'Displayed witness outcomes disagree with the independent oracle.');
        demand(witness.direction === (a ? 'left-only' : 'right-only'), 'Witness direction is mislabeled.');
      }
      report.registrations = [];
      if (item.expected.comparison === 'unresolved') {
        // The valid counterpart is intentionally not approved either: this run
        // requires unresolved pairs to remain unpublished for clarification.
        for (const candidate of Object.values(candidates).filter(candidate => candidate.rules === null)) {
          const rejected = await api(base, roomPath(room.id), { type: 'vote', editor: 'alice', reviewId: room.review.id, candidateId: candidate.id });
          demand(!rejected.ok && rejected.status === 400 && rejected.data?.code === 'UNRESOLVED', 'An unsupported/ambiguous candidate was not blocked from approval.');
        }
        room = roomIn(await success(base, roomPath(room.id)));
        noApproval(room, baseline);
        report.publication = 'withheld-for-clarification';
      } else {
        const chosenEditor = index % 2 === 0 ? 'alice' : 'bob';
        const chosen = candidates[chosenEditor], other = candidates[chosenEditor === 'alice' ? 'bob' : 'alice'];
        report.selectedEditor = chosenEditor;
        const probe = discovery.witnesses[0]?.attendee || item.scenarios[0];
        room = await register(base, room, probe, 'Before either editor approves', report.registrations);
        room = await change(base, room.id, { type: 'vote', editor: 'alice', reviewId: room.review.id, candidateId: chosen.id });
        demand(JSON.stringify(room.published) === JSON.stringify(baseline), 'One editor alone published the proposal.');
        room = await change(base, room.id, { type: 'vote', editor: 'bob', reviewId: room.review.id, candidateId: other.id });
        demand(JSON.stringify(room.published) === JSON.stringify(baseline) && room.review.status === 'open', 'Conflicting editor votes published the proposal.');
        room = await register(base, room, probe, 'While editor votes conflict', report.registrations);
        room = await change(base, room.id, { type: 'vote', editor: 'bob', reviewId: room.review.id, candidateId: chosen.id });
        demand(room.published.version === baseline.version + 1 && room.published.candidateId === chosen.id && room.review.status === 'published', 'Matching joint approval did not publish exactly one new version.');
        demand(semanticsMatch(room.published.rules, chosen.rules), 'Published rules differ from the jointly approved candidate.');
        for (const [position, attendee] of item.scenarios.entries()) room = await register(base, room, attendee, `Approved policy scenario ${position + 1}`, report.registrations);
        for (const [position, witness] of discovery.witnesses.entries()) room = await register(base, room, witness.attendee, `Approved discovered witness ${position + 1}`, report.registrations);
        report.publication = 'jointly-approved';
      }
      await save(`${item.id}.after.json`, room);
      report.status = 'passed';
    } catch (error) {
      report.status = 'failed'; report.failure = safeFailure(error);
      results.status = 'failed'; results.liveProviderValidation = 'failed';
      process.exitCode = 1;
    } finally {
      report.durationMs = performance.now() - started; report.finishedAt = new Date().toISOString();
      await checkpoint();
    }
    if (report.status === 'failed') break;
  }
  if (results.cases.every(item => item.status === 'passed')) { results.status = 'passed'; results.liveProviderValidation = 'passed'; }
  results.finishedAt = new Date().toISOString();
  results.summary = {
    passed: results.cases.filter(item => item.status === 'passed').length,
    failed: results.cases.filter(item => item.status === 'failed').length,
    notRun: results.cases.filter(item => item.status === 'not-run').length,
    scenarioOutcomes: results.cases.reduce((sum, item) => sum + (item.scenarioChecks?.length || 0), 0),
    discoveredWitnesses: results.cases.reduce((sum, item) => sum + (item.discovery?.witnesses.length || 0), 0),
    savedRegistrations: results.cases.reduce((sum, item) => sum + (item.registrations?.length || 0), 0),
  };
  await checkpoint(); await save('http-metadata.json', http);
  console.log(JSON.stringify({ status: results.status, ...results.summary, evidenceDirectory: runDir }));
}

try { await main(); }
catch (error) {
  const failure = safeFailure(error);
  if (runDir) {
    if (results) { results.status = 'failed'; results.liveProviderValidation = 'failed'; results.runnerFailure = failure; await checkpoint().catch(() => {}); }
    await save('runner-failure.json', { failure, http }).catch(() => {});
  }
  console.error(JSON.stringify({ status: 'failed', ...failure }));
  process.exitCode = 1;
}
