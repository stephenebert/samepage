import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRepairBaseline } from '../lib/studio-repair-controls.ts';

const checked = (status = 'ready', reviewId = 'review-1', baselineCandidateId = 'alice-1') => ({
  id: 'repair-1', status, job: { reviewId, intent: { baselineCandidateId, scopeFlag: 'student', feeCents: 3250 } },
});

test('an asynchronously received check restores an initially empty baseline and keeps it through publication', () => {
  let selected = reconcileRepairBaseline('', false, undefined, undefined, []);
  assert.deepEqual(selected, { baselineId: '', restoreSavedRequest: false });
  selected = reconcileRepairBaseline(selected.baselineId, false, undefined, 'review-1', ['alice-1', 'bob-1']);
  assert.deepEqual(selected, { baselineId: '', restoreSavedRequest: false }, 'a review alone must not choose for the editors');
  for (const status of ['running', 'ready', 'published']) {
    selected = reconcileRepairBaseline(selected.baselineId, false, checked(status), 'review-1', ['alice-1', 'bob-1']);
    assert.deepEqual(selected, { baselineId: 'alice-1', restoreSavedRequest: true });
  }
});

test('a local alternative or deliberately cleared selection survives a remotely received repair', () => {
  for (const baselineId of ['bob-1', '']) {
    assert.deepEqual(reconcileRepairBaseline(baselineId, true, checked(), 'review-1', ['alice-1', 'bob-1']), {
      baselineId, restoreSavedRequest: false,
    });
  }
  assert.deepEqual(reconcileRepairBaseline('bob-1', false, checked(), 'review-1', ['alice-1', 'bob-1']), {
    baselineId: 'alice-1', restoreSavedRequest: true,
  }, 'explicit restoration returns the complete saved request');
});

test('new or unresolved reviews clear stale baselines without restoring an obsolete check', () => {
  for (const [reviewId, ids, repair] of [
    [undefined, [], checked()],
    ['review-2', ['alice-2', 'bob-2'], checked()],
    ['review-1', [], checked()],
    ['review-2', ['alice-2', 'bob-2'], checked('superseded')],
  ]) {
    for (const edited of [false, true]) {
      assert.deepEqual(reconcileRepairBaseline('alice-1', edited, repair, reviewId, ids), {
        baselineId: '', restoreSavedRequest: false,
      });
    }
  }
});

test('an available local baseline remains selected while an older repair becomes superseded', () => {
  assert.deepEqual(reconcileRepairBaseline('bob-2', true, checked('superseded'), 'review-2', ['alice-2', 'bob-2']), {
    baselineId: 'bob-2', restoreSavedRequest: false,
  });
  assert.deepEqual(reconcileRepairBaseline('bob-2', false, checked(), 'review-2', ['alice-2', 'bob-2']), {
    baselineId: 'bob-2', restoreSavedRequest: false,
  });
});
