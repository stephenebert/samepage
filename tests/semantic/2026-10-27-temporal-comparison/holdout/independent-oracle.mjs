// Independently authored from the new English/Spanish source policies.
// This module does not import application code or provider results.
// Domain: integer ages 0..120; five independent booleans; canonical UTC
// millisecond strings with four-digit years 0000..9999.

export class UnresolvedPolicyError extends Error {
  constructor(caseId) {
    super(`No unique complete policy outcome is defined for ${caseId}.`);
    this.name = 'UnresolvedPolicyError';
    this.caseId = caseId;
  }
}

const yes = feeCents => ({ accepted: true, feeCents });
const no = () => ({ accepted: false, feeCents: null });

function validateAttendee(a) {
  if (!a || typeof a !== 'object' || !Number.isInteger(a.age) || a.age < 0 || a.age > 120) {
    throw new TypeError('attendee.age must be an integer from 0 through 120');
  }
  for (const flag of ['resident', 'student', 'member', 'guardianConsent', 'scholarship']) {
    if (typeof a[flag] !== 'boolean') throw new TypeError(`attendee.${flag} must be Boolean`);
  }
  if (typeof a.submittedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.submittedAt)) {
    throw new TypeError('attendee.submittedAt must be a canonical four-digit-year UTC millisecond string');
  }
  const millis = Date.parse(a.submittedAt);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== a.submittedAt) {
    throw new TypeError('attendee.submittedAt is not a valid canonical UTC instant');
  }
}

const oracle = {
  v2c01: {
    alice(a) {
      if (a.age < 18 || !(a.resident || a.member)) return no();
      if (!(a.submittedAt < '2031-04-09T18:30:00.000Z')) return no();
      return yes(a.scholarship ? 0 : 2400);
    },
    bob(a) {
      if (!(a.age >= 18 && (a.resident || a.member))) return no();
      if (a.submittedAt > '2031-04-09T18:30:00.000Z') return no();
      return yes(a.scholarship ? 0 : 2400);
    },
  },
  v2c02: {
    alice(a) {
      if (a.age < 12 || a.age > 17 || !(a.resident || a.student)) return no();
      if (!a.member && !a.guardianConsent) return no();
      if (a.scholarship) return yes(0);
      if (a.member) return yes(900);
      if (a.student) return yes(1400);
      return yes(1800);
    },
    bob(a) {
      if (!(a.age >= 12 && a.age <= 17)) return no();
      if (!a.resident && !a.student) return no();
      if (!a.member && !a.guardianConsent) return no();
      return yes(a.scholarship ? 0 : a.member ? 900 : a.student ? 1400 : 1800);
    },
  },
  v2c03: {
    alice(a) {
      if (a.age < 16 || (a.age < 18 && !a.guardianConsent)) return no();
      if (a.scholarship) return yes(0);
      return yes(a.member ? 1500 : 2500);
    },
    bob(a) {
      if (!(a.age >= 18 || ((a.age === 16 || a.age === 17) && a.guardianConsent))) return no();
      if (a.scholarship) return yes(0);
      if (a.member) return yes(1500);
      return yes(2500);
    },
  },
  v2c04: {
    alice(a) {
      if (a.age < 18 || (a.resident && a.student)) return no();
      return yes(a.member ? 1100 : 1900);
    },
    bob(a) {
      if (a.age < 18 || a.resident || a.student) return no();
      return yes(a.member ? 1100 : 1900);
    },
  },
  v2c05: {
    alice(a) {
      if (a.age < 8 || !(a.resident || a.member)) return no();
      if (a.age < 18 && !a.guardianConsent) return no();
      if (a.member) return yes(1200);
      if (a.scholarship) return yes(400);
      if (a.student) return yes(2000);
      return yes(2800);
    },
    bob(a) {
      if (!(a.age >= 8 && (a.resident || a.member) && (a.age >= 18 || a.guardianConsent))) return no();
      if (a.scholarship) return yes(400);
      if (a.member) return yes(1200);
      if (a.student) return yes(2000);
      return yes(2800);
    },
  },
  v2c06: {
    alice() { throw new UnresolvedPolicyError('v2c06'); },
    bob() { throw new UnresolvedPolicyError('v2c06'); },
  },
  v2c07: {
    alice(a) {
      if (a.age < 14 || !(a.resident || a.scholarship)) return no();
      if (a.age < 18 && !a.guardianConsent) return no();
      if (!(a.submittedAt > '2028-02-28T23:59:59.999Z' && a.submittedAt < '2028-03-01T00:00:00.000Z')) return no();
      return yes(a.student ? 800 : 1600);
    },
    bob(a) {
      if (!(a.age >= 14 && (a.resident || a.scholarship) && (a.age >= 18 || a.guardianConsent))) return no();
      if (a.submittedAt < '2028-02-29T00:00:00.000Z' || a.submittedAt > '2028-02-29T23:59:59.999Z') return no();
      return yes(a.student ? 800 : 1600);
    },
  },
  v2c08: {
    alice(a) {
      if (a.age < 10 || a.age > 17 || !a.guardianConsent || !(a.student || a.member)) return no();
      return yes(a.scholarship ? 300 : 1300);
    },
    bob(a) {
      if (!(a.age >= 10 && a.age <= 17 && (a.student || (a.member && a.guardianConsent)))) return no();
      return yes(a.scholarship ? 300 : 1300);
    },
  },
  v2c09: {
    alice() { throw new UnresolvedPolicyError('v2c09'); },
    bob() { throw new UnresolvedPolicyError('v2c09'); },
  },
  v2c10: {
    alice(a) {
      if (!(a.member || (a.resident && a.guardianConsent))) return no();
      if (!(a.submittedAt > '2026-12-06T09:00:00.000Z' && a.submittedAt < '2026-12-06T10:00:00.000Z')) return no();
      return yes(a.scholarship ? 0 : 700);
    },
    bob(a) {
      if (!(a.member || (a.resident && a.guardianConsent))) return no();
      if (a.submittedAt < '2026-12-06T09:00:00.000Z' || a.submittedAt >= '2026-12-06T10:00:00.000Z') return no();
      return yes(a.scholarship ? 0 : 700);
    },
  },
  v2c11: {
    alice(a) {
      if (!(a.resident && a.age >= 21 && !a.student)) return no();
      if (a.student) return yes(500);
      if (a.member) return yes(1000);
      return yes(2000);
    },
    bob(a) {
      if (!a.resident || a.age < 21 || a.student) return no();
      return yes(a.member ? 1000 : 2000);
    },
  },
  v2c12: {
    alice(a) {
      if (a.age < 18 || !(a.resident || a.member)) return no();
      if (a.scholarship && !a.student) return no();
      return yes(a.student ? 1100 : 2400);
    },
    bob(a) {
      if (!(a.age >= 18 && (a.resident || a.member))) return no();
      if (!(a.student || a.scholarship)) return no();
      return yes(a.student ? 1100 : 2400);
    },
  },
};

// Exact endpoints, immediate neighbors, a representative interior instant,
// and extremes are provided for each time-sensitive resolved case.
// Empty arrays indicate that the policy has no submission-time restriction.
export const boundaryInstants = Object.freeze({
  v2c01: Object.freeze([
    '0000-01-01T00:00:00.000Z',
    '2031-04-09T18:29:59.999Z',
    '2031-04-09T18:30:00.000Z',
    '2031-04-09T18:30:00.001Z',
    '9999-12-31T23:59:59.999Z',
  ]),
  v2c02: Object.freeze([]),
  v2c03: Object.freeze([]),
  v2c04: Object.freeze([]),
  v2c05: Object.freeze([]),
  v2c06: Object.freeze([]),
  v2c07: Object.freeze([
    '0000-01-01T00:00:00.000Z',
    '2028-02-28T23:59:59.998Z',
    '2028-02-28T23:59:59.999Z',
    '2028-02-29T00:00:00.000Z',
    '2028-02-29T00:00:00.001Z',
    '2028-02-29T12:00:00.000Z',
    '2028-02-29T23:59:59.998Z',
    '2028-02-29T23:59:59.999Z',
    '2028-03-01T00:00:00.000Z',
    '2028-03-01T00:00:00.001Z',
    '9999-12-31T23:59:59.999Z',
  ]),
  v2c08: Object.freeze([]),
  v2c09: Object.freeze([]),
  v2c10: Object.freeze([
    '0000-01-01T00:00:00.000Z',
    '2026-12-06T08:59:59.999Z',
    '2026-12-06T09:00:00.000Z',
    '2026-12-06T09:00:00.001Z',
    '2026-12-06T09:30:00.000Z',
    '2026-12-06T09:59:59.999Z',
    '2026-12-06T10:00:00.000Z',
    '2026-12-06T10:00:00.001Z',
    '9999-12-31T23:59:59.999Z',
  ]),
  v2c11: Object.freeze([]),
  v2c12: Object.freeze([]),
});

export function expectedOutcome(caseId, editor, attendee) {
  if (!Object.hasOwn(oracle, caseId)) throw new RangeError(`Unknown case ID: ${caseId}`);
  if (editor !== 'alice' && editor !== 'bob') throw new RangeError(`Unknown editor: ${editor}`);
  validateAttendee(attendee);
  return oracle[caseId][editor](attendee);
}
