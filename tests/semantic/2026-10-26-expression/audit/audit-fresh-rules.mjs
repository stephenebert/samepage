import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCandidate, evaluateIndependent, evaluateRules } from '../holdout/independent-oracle.mjs';

const evidenceRoot = fileURLToPath(new URL('../', import.meta.url));
const stageRoot = resolve(process.argv[2] || `${evidenceRoot}/stages`);
const digest = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const frozenRoot = `${evidenceRoot}/holdout`;
const manifest = readFileSync(`${frozenRoot}/SHA256SUMS`, 'utf8');
for (const line of manifest.trim().split('\n')) {
  const [expectedHash, name] = line.split('  ');
  assert.equal(digest(readFileSync(`${frozenRoot}/${name}`)), expectedHash, `frozen file changed: ${name}`);
}
const inputs = read(`${frozenRoot}/provider-inputs.json`);
const cases = read(`${frozenRoot}/boundary-cases.json`).cases;
const results = [];
for (const source of inputs.pairs) {
  const path = `${stageRoot}/fresh-${source.id}/review-state.json`;
  const data = read(path);
  const candidates = data.review.candidates;
  assert.equal(candidates.length, 2);
  const item = { pairId: source.id, artifact: path, artifactSHA256: digest(readFileSync(path)), candidates: [] };
  for (const editor of ['alice', 'bob']) {
    const c = candidates.find(candidate => candidate.editor === editor);
    assert(c, `missing ${editor}`);
    const sourceLanguage = editor === 'alice' ? 'en' : 'es';
    assert.equal(data.drafts[editor].text, source[sourceLanguage], 'wrong frozen source sent');
    assert.equal(c[sourceLanguage], source[sourceLanguage], 'author-language source changed');
    const result = { editor, sourceLanguage, sourceMatchesFrozenExactly: true, authorLanguagePreservedExactly: true };
    if (source.id === 'nightjar-online-sound-jam') {
      result.oracle = checkCandidate(editor, c.rules);
      assert(result.oracle.pass, `Nightjar ${editor} oracle failed`);
      assert.deepEqual(c.issues, [], 'unexpected Nightjar issue');
      for (const fixture of cases) assert.deepEqual(evaluateRules(c.rules, fixture.attendee), fixture.expected[editor], `${editor} boundary case ${fixture.id}`);
      result.handSpecifiedBoundaryCasesPassed = cases.length;
    } else {
      assert.equal(c.rules, null, 'ambiguous policy was made executable');
      assert(c.issues.length > 0, 'missing clarification issue');
      result.rulesNull = true;
      result.issues = c.issues;
    }
    item.candidates.push(result);
  }
  const expectedStatus = source.id === 'nightjar-online-sound-jam' ? 'different' : 'unresolved';
  assert.equal(data.review.discovery.status, expectedStatus);
  item.expectedDiscoveryStatus = expectedStatus;
  item.discoveryStatusMatches = true;
  item.witnessesValidated = 0;
  if (expectedStatus === 'different') {
    for (const witness of data.review.discovery.witnesses) {
      for (const [editor, key] of [['alice', 'left'], ['bob', 'right']]) {
        assert.deepEqual({ accepted: witness[key].accepted, feeCents: witness[key].feeCents }, evaluateIndependent(editor, witness.attendee), `incorrect ${key} witness`);
      }
      item.witnessesValidated++;
    }
  }
  results.push(item);
}
process.stdout.write(JSON.stringify({
  schemaVersion: 1,
  auditType: 'Independent source-level semantic check; no application engine imported',
  pass: true,
  frozenManifestSHA256: digest(manifest),
  frozenFilesVerified: true,
  totalNightjarOracleDecisions: results[0].candidates.reduce((sum, candidate) => sum + candidate.oracle.checkedCases, 0),
  totalNightjarHandSpecifiedDecisions: results[0].candidates.reduce((sum, candidate) => sum + candidate.handSpecifiedBoundaryCasesPassed, 0),
  results
}, null, 2) + '\n');
