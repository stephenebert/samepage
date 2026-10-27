/** Independent reference: direct JavaScript decisions, no SamePage/model imports. */
export const resolvedCaseIds = ['c01','c02','c03','c04','c05','c06','c07','c08','c09','c10'];
export const boundaryInstants = {
  c01: [], c02: [], c03: ['2026-12-04T18:00:00.000Z'], c04: [], c05: [],
  c06: ['2026-12-12T09:00:00.000Z'], c07: [], c08: [],
  c09: ['2026-12-19T19:30:00.000Z','2026-12-20T19:30:00.000Z','2026-12-20T19:30:00.001Z'], c10: [], c11: [], c12: [],
};
const result = (accepted, cents) => ({accepted: Boolean(accepted), feeCents: accepted ? cents : null});
const t = value => Date.parse(value);
const oracle = {
  c01: {
    alice: a => result(a.age >= 18 && (a.resident || a.member), a.member ? 1500 : 2500),
    bob: a => result((a.age >= 18 && a.resident) || a.member, a.member ? 1500 : 2500),
  },
  c02: {
    alice: a => result(a.age >= 16 && (a.age >= 18 || a.guardianConsent), a.scholarship ? 0 : a.student ? 1100 : 2400),
    bob: a => result(a.age >= 16 && (a.age >= 18 || a.guardianConsent), a.student ? 1100 : a.scholarship ? 0 : 2400),
  },
  c03: {
    alice: a => result(t(a.submittedAt) < t('2026-12-04T18:00:00.000Z') && (a.age >= 21 || (a.age >= 18 && a.resident)), a.student ? 1000 : a.member ? 1800 : 2600),
    bob: a => result(t(a.submittedAt) <= t('2026-12-04T18:00:00.000Z') && (a.age >= 21 || (a.age >= 18 && a.resident)), a.student ? 1000 : a.member ? 1800 : 2600),
  },
  c04: {
    alice: a => result(a.age >= 16 && (a.member || (a.resident && (!a.student || a.scholarship))), a.scholarship ? 700 : a.member ? 900 : 1800),
    bob: a => result(a.age >= 16 && (a.member || (a.resident && !a.student && !a.scholarship)), a.scholarship ? 700 : a.member ? 900 : 1800),
  },
  c05: {
    alice: a => result(a.age >= 18 || ((a.age === 16 || a.age === 17) && a.guardianConsent), a.resident && (a.student || a.member) && !a.scholarship ? 1200 : 2400),
    bob: a => result(a.age >= 18 || ((a.age === 16 || a.age === 17) && a.guardianConsent), (a.resident && a.student) || (a.member && !a.scholarship) ? 1200 : 2400),
  },
  c06: {
    alice: a => result(a.age >= 18 && a.age <= 70 && (a.resident || a.member), t(a.submittedAt) < t('2026-12-12T09:00:00.000Z') && !a.student ? 1700 : a.student && a.member ? 800 : a.scholarship ? 0 : 2800),
    bob: a => result(a.age >= 18 && a.age <= 70 && (a.resident || a.member), t(a.submittedAt) < t('2026-12-12T09:00:00.000Z') && !(a.student && a.member) ? 1700 : a.student && a.member ? 800 : a.scholarship ? 0 : 2800),
  },
  c07: {
    alice: a => result(!(a.age < 18 || a.age > 65) && !(!a.resident && !a.member), a.student && !a.scholarship ? 1100 : a.scholarship ? 0 : 2300),
    bob: a => result(a.age >= 18 && a.age <= 65 && (a.resident || a.member), a.scholarship ? 0 : a.student ? 1100 : 2300),
  },
  c08: {
    alice: a => result(a.age >= 16 && (a.age >= 18 || a.guardianConsent), a.scholarship ? 0 : a.student && !a.scholarship ? 900 : a.member && !a.student && !a.scholarship ? 1300 : 2200),
    bob: a => result(a.age >= 18 || ((a.age === 16 || a.age === 17) && a.guardianConsent), a.member && !a.student && !a.scholarship ? 1300 : a.student && !a.scholarship ? 900 : a.scholarship ? 0 : 2200),
  },
  c09: {
    alice: a => result(a.age >= 16 && a.age <= 24 && (a.age >= 18 || a.guardianConsent) && t(a.submittedAt) <= t('2026-12-20T19:30:00.000Z'), a.student && t(a.submittedAt) < t('2026-12-19T19:30:00.000Z') ? 1000 : 3000),
    bob: a => result(a.age >= 16 && a.age <= 24 && (a.age >= 18 || a.guardianConsent) && t(a.submittedAt) < t('2026-12-20T19:30:00.001Z'), a.student && t(a.submittedAt) < t('2026-12-19T19:30:00.000Z') ? 1000 : 3000),
  },
  c10: {
    alice: a => result(a.age >= 18 && (a.member || (a.resident && a.student)), a.member ? 1800 : a.student ? 1200 : a.resident ? 1000 : 2500),
    bob: a => result((a.member && a.age >= 18) || (a.student && a.resident && a.age >= 18), a.student && !a.member ? 1200 : a.member ? 1800 : a.resident && !a.student && !a.member ? 1000 : 2500),
  },
};
export function expectedOutcome(caseId, editor, attendee) {
  if (!oracle[caseId] || !['alice','bob'].includes(editor)) throw new Error('No resolved reference for this case/editor');
  return oracle[caseId][editor](attendee);
}
export const evaluateCase = expectedOutcome;
