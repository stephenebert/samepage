import { RoomError } from "./room.ts";
import { LIVE_DEMO_DRAFTS, LIVE_DEMO_UNSAFE_PROPOSAL, LIVE_DEMO_ATTENDEE } from "./studio-live-demo-inputs.ts";
import type { StudioAttendee, StudioFlag, StudioText } from "./studio-types";

export type StudioExampleId = "beacon" | "harbor" | "cobalt" | "consent" | "interaction";
export interface StudioExample {
  id: StudioExampleId;
  title: string;
  description: string;
  maxCalls: 1 | 3;
  displayMode?: "eligibility";
  recordedAvailable?: boolean;
  drafts: StudioText;
  intent?: { scopeFlag: StudioFlag; feeCents: number; mode?: "preserve-outcomes" };
  unsafeProposal?: StudioText;
  attendee?: StudioAttendee;
}

/** Authored inputs only. Opening a live example never imports recorded model outputs. */
export const STUDIO_EXAMPLES: readonly StudioExample[] = [
  {
    id: "interaction", title: "Northstar Creative Lab",
    description: "Review alternative admission routes without accidentally prioritizing one.",
    maxCalls: 3, displayMode: "eligibility", recordedAvailable: false,
    drafts: {
      en: "Northstar Creative Lab accepts applications from 2026-11-10T09:00:00.000Z through 2026-11-12T17:00:00.000Z, including both endpoints. Applicants must be at least 18 years old. There are two alternative admission routes. Community route: the applicant must be a local resident. Campus route: the applicant must be both a student and a club member. An applicant who meets either route, the age requirement and the application window is admitted. All other applicants are rejected. Guardian consent and scholarships do not affect admission. Attendance is free for every admitted applicant.",
      es: "Northstar Creative Lab acepta solicitudes desde 2026-11-10T09:00:00.000Z hasta 2026-11-12T17:00:00.000Z, incluidos ambos extremos. Las personas solicitantes deben tener al menos 18 años. Hay dos vías alternativas de admisión. Vía comunitaria: la persona solicitante debe ser residente local y estudiante. Vía del campus: la persona solicitante debe ser estudiante y miembro del club. Se admite a toda persona que cumpla cualquiera de las dos vías, el requisito de edad y el plazo de solicitud. Se rechazan todas las demás solicitudes. El consentimiento del tutor y las becas no afectan la admisión. La asistencia es gratuita para todas las personas admitidas."
    },
    intent: { scopeFlag: "student", feeCents: 0, mode: "preserve-outcomes" },
    unsafeProposal: {
      en: "Northstar Creative Lab accepts applications from 2026-11-10T09:00:00.000Z through 2026-11-12T17:00:00.000Z, including both endpoints. Applicants must be at least 18 years old. For processing, use one admission route according to club membership. Club members use the campus route and must be students. Applicants who are not club members use the community route and must be local residents. An applicant who meets their assigned route, the age requirement and the application window is admitted. All other applicants are rejected. Guardian consent and scholarships do not affect admission. Attendance is free for every admitted applicant.",
      es: "Northstar Creative Lab acepta solicitudes desde 2026-11-10T09:00:00.000Z hasta 2026-11-12T17:00:00.000Z, incluidos ambos extremos. Las personas solicitantes deben tener al menos 18 años. Para tramitar la solicitud, se utiliza una sola vía de admisión según la membresía del club. Los miembros del club usan la vía del campus y deben ser estudiantes. Quienes no son miembros del club usan la vía comunitaria y deben ser residentes locales. Se admite a toda persona que cumpla la vía asignada, el requisito de edad y el plazo de solicitud. Se rechazan todas las demás solicitudes. El consentimiento del tutor y las becas no afectan la admisión. La asistencia es gratuita para todas las personas admitidas."
    }
  },
  {
    id: "consent", title: "Open Studio Workshop",
    description: "Clarify a free workshop policy without dropping guardian consent.",
    maxCalls: 3, displayMode: "eligibility", recordedAvailable: false,
    drafts: {
      en: "Open Studio Workshop accepts applications submitted at or after 2026-11-10T09:00:00.000Z and at or before 2026-11-12T17:00:00.000Z, including both boundary instants. Within this application window, applicants aged 16 or 17 must have guardian consent. Applicants aged 18 or older do not need guardian consent. Anyone younger than 16 is rejected. Applications outside the window are rejected regardless of age or consent. Residency, student status, membership and scholarships do not affect admission. The workshop is free for every admitted attendee: the registration fee is zero USD cents with no exceptions. Rejected applicants have no registration fee.",
      es: "Open Studio Workshop acepta solicitudes presentadas a partir de 2026-11-10T09:00:00.000Z y hasta 2026-11-12T17:00:00.000Z, incluidos ambos instantes límite. Dentro de este plazo, las personas de 16, 17 o 18 años deben contar con el consentimiento de su tutor. Las personas de 19 años o más no necesitan consentimiento del tutor. Se rechaza a toda persona menor de 16 años. Las solicitudes fuera del plazo se rechazan independientemente de la edad o del consentimiento. La residencia, la condición de estudiante, la membresía y las becas no afectan la admisión. El taller es gratuito para todas las personas admitidas: la tarifa de inscripción es de cero centavos USD, sin excepciones. Las personas rechazadas no tienen tarifa de inscripción."
    },
    intent: { scopeFlag: "student", feeCents: 0, mode: "preserve-outcomes" },
    unsafeProposal: {
      en: "Open Studio Workshop accepts applications submitted at or after 2026-11-10T09:00:00.000Z and at or before 2026-11-12T17:00:00.000Z, including both boundary instants. Within this application window, everyone aged 16 or older is admitted without guardian consent. Anyone younger than 16 is rejected. Applications outside the window are rejected regardless of age or consent. Residency, student status, membership and scholarships do not affect admission. The workshop is free for every admitted attendee: the registration fee is zero USD cents with no exceptions. Rejected applicants have no registration fee.",
      es: "Open Studio Workshop acepta solicitudes presentadas a partir de 2026-11-10T09:00:00.000Z y hasta 2026-11-12T17:00:00.000Z, incluidos ambos instantes límite. Dentro de este plazo, se admite a toda persona de 16 años o más sin exigir el consentimiento del tutor. Se rechaza a toda persona menor de 16 años. Las solicitudes fuera del plazo se rechazan independientemente de la edad o del consentimiento. La residencia, la condición de estudiante, la membresía y las becas no afectan la admisión. El taller es gratuito para todas las personas admitidas: la tarifa de inscripción es de cero centavos USD, sin excepciones. Las personas rechazadas no tienen tarifa de inscripción."
    },
    attendee: { age: 17, resident: false, student: false, member: false, guardianConsent: false, scholarship: false, submittedAt: "2026-11-11T12:00:00.000Z" }
  },
  { id: "beacon", title: "Beacon Commons", description: "Catch an unintended fee increase while changing student fees.", maxCalls: 3, drafts: LIVE_DEMO_DRAFTS, intent: { scopeFlag: "student", feeCents: 1900 }, unsafeProposal: LIVE_DEMO_UNSAFE_PROPOSAL, attendee: LIVE_DEMO_ATTENDEE },
{
  "id": "harbor",
  "title": "Harbor Archive",
  "description": "Check whether a fee rewrite also changes who can attend.",
  "maxCalls": 3,
  "drafts": {
    "en": "Applications to the Harbor Archive Open Studio are in time only when submitted strictly after 2026-12-04T09:00:00.125Z and at or before 2026-12-19T18:00:00.875Z. An on-time applicant must qualify through at least one of the two routes below. Youth route: all three requirements apply: age is at least 15 and at most 19; guardian consent is present; and at least one of these alternatives holds: (a) the applicant is a resident and is not a member, or (b) the applicant is a student and has a scholarship. Adult route: the applicant must be at least 20 years old AND must satisfy at least one of these alternatives: (a) the applicant is a member and is not a student, or (b) the applicant is a resident and also either does not have a scholarship or is a student. The age requirement applies to both adult alternatives. There is one additional requirement for every route: for a submission strictly after 2026-12-14T10:30:00.500Z, the applicant must either have a scholarship, or must both be a member and have guardian consent. At or before that instant, this additional requirement does not apply. Everyone else is rejected. Only admitted applicants have a fee. Use the first matching fee in this order, in USD cents: scholarship AND membership, 350; scholarship, 900; age at most 19, 1700; resident AND student, 2300; membership, 3200; otherwise, 4700.",
    "es": "Las solicitudes para el Estudio Abierto del Archivo del Puerto están dentro de plazo únicamente si se presentan estrictamente después de 2026-12-04T09:00:00.125Z y a más tardar en 2026-12-19T18:00:00.875Z, incluido ese instante. Una persona solicitante dentro de plazo debe cumplir al menos una de las dos vías siguientes. Vía juvenil: se exigen los tres requisitos siguientes: tener al menos 15 y como máximo 19 años; contar con el consentimiento del tutor; y cumplir al menos una de estas alternativas: (a) ser residente y no ser miembro, o (b) ser estudiante y tener una beca. Vía adulta: se exige tener al menos 20 años Y cumplir al menos una de estas alternativas: (a) ser miembro y ser estudiante, o (b) ser residente y, además, no tener beca o ser estudiante. En la alternativa (b), ser residente es obligatorio; además, debe cumplirse al menos una de las condiciones «no tener beca» y «ser estudiante». La edad mínima de 20 años se exige en ambas alternativas de la vía adulta. Hay un requisito adicional para ambas vías: si la solicitud se presenta estrictamente después de 2026-12-14T10:30:00.500Z, se exige tener una beca, o bien cumplir conjuntamente estas dos condiciones: ser miembro y contar con el consentimiento del tutor. Si la solicitud se presenta en ese instante o antes, este requisito adicional no se aplica. Se rechazan todas las demás solicitudes. Solo las personas admitidas tienen tarifa. Se aplica la primera tarifa que corresponda en este orden, en centavos de dólar estadounidense: beca Y membresía, 350; beca, 900; edad de 19 años como máximo, 1700; residente Y estudiante, 2300; membresía, 3200; en otro caso, 4700."
  },
  "intent": {
    "scopeFlag": "student",
    "feeCents": 2100
  },
  "unsafeProposal": {
    "en": "Applications to the Harbor Archive Open Studio are in time only when submitted strictly after 2026-12-04T09:00:00.125Z and at or before 2026-12-19T18:00:00.875Z. An on-time applicant must qualify through at least one of the two routes below. Youth route: all three requirements apply: age is at least 15 and at most 19; guardian consent is present; and at least one of these alternatives holds: (a) the applicant is a resident and is not a member, or (b) the applicant is a student and has a scholarship. Adult route: the applicant must be at least 20 years old AND must satisfy at least one of these alternatives: (a) the applicant is a member and is not a student, or (b) the applicant is a resident and also either does not have a scholarship or is a student. The age requirement applies to both adult alternatives. There is one additional requirement for every route: for a submission strictly after 2026-12-14T10:30:00.500Z, the applicant must either have a scholarship or be a member. At or before that instant, this additional requirement does not apply. Everyone else is rejected. Only admitted applicants have a fee. Use the first matching fee in this order, in USD cents: student, 2100; scholarship AND membership, 350; scholarship, 900; age at most 19, 1700; resident AND student, 2300; membership, 3200; otherwise, 4700.",
    "es": "Las solicitudes para el Estudio Abierto del Archivo del Puerto están dentro de plazo únicamente si se presentan estrictamente después de 2026-12-04T09:00:00.125Z y a más tardar en 2026-12-19T18:00:00.875Z, incluido ese instante. Una persona solicitante dentro de plazo debe cumplir al menos una de las dos vías siguientes. Vía juvenil: se exigen los tres requisitos siguientes: tener al menos 15 y como máximo 19 años; contar con el consentimiento del tutor; y cumplir al menos una de estas alternativas: (a) ser residente y no ser miembro, o (b) ser estudiante y tener una beca. Vía adulta: se exige tener al menos 20 años Y cumplir al menos una de estas alternativas: (a) ser miembro y no ser estudiante, o (b) ser residente y, además, no tener beca o ser estudiante. En la alternativa (b), ser residente es obligatorio; además, debe cumplirse al menos una de las condiciones «no tener beca» y «ser estudiante». La edad mínima de 20 años se exige en ambas alternativas de la vía adulta. Hay un requisito adicional para ambas vías: si la solicitud se presenta estrictamente después de 2026-12-14T10:30:00.500Z, se exige tener una beca o ser miembro. Si la solicitud se presenta en ese instante o antes, este requisito adicional no se aplica. Se rechazan todas las demás solicitudes. Solo las personas admitidas tienen tarifa. Se aplica la primera tarifa que corresponda en este orden, en centavos de dólar estadounidense: estudiante, 2100; beca Y membresía, 350; beca, 900; edad de 19 años como máximo, 1700; residente Y estudiante, 2300; membresía, 3200; en otro caso, 4700."
  },
  "attendee": {
    "age": 24,
    "resident": true,
    "student": true,
    "member": false,
    "guardianConsent": false,
    "scholarship": false,
    "submittedAt": "2026-12-10T11:22:33.444Z"
  }
},
{
  "id": "cobalt",
  "title": "Cobalt Reading Room",
  "description": "Find a missing scholarship amount before publishing.",
  "maxCalls": 1,
  "drafts": {
    "en": "Cobalt Reading Room admits everyone age 18 or older and rejects everyone younger than 18. Registration is always open; there are no date or time restrictions. For admitted attendees the standard fee is 5800 USD cents. Admitted scholarship holders instead pay a reduced fee, but the amount of that reduced fee has not been specified. No other status changes admission or the fee. Rejected attendees have no fee.",
    "es": "Cobalt Reading Room admite a todas las personas de 18 años o más y rechaza a todas las menores de 18 años. La inscripción está siempre abierta; no hay restricciones de fecha ni de hora. Para las personas admitidas, la tarifa estándar es de 5800 centavos USD. Las personas admitidas que tienen beca pagan en su lugar una tarifa reducida, pero no se ha especificado el importe de esa tarifa reducida. Ningún otro estado modifica la admisión ni la tarifa. Las personas rechazadas no tienen tarifa."
  }
}
];

export function getStudioExample(id: unknown = "beacon"): StudioExample {
  const example = STUDIO_EXAMPLES.find(item => item.id === id);
  if (!example) throw new RoomError("Choose Northstar Creative Lab, Open Studio Workshop, Beacon Commons, Harbor Archive, or Cobalt Reading Room.", "INVALID_EXAMPLE", 400);
  return example;
}
