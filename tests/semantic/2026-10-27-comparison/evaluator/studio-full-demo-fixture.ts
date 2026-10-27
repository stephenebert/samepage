import type { StudioAttendee, StudioDemoFixture, StudioEditor, StudioRepairProposal } from "./studio-types";

/** Minimal retained Meta outputs from the verified October 27 Beacon run.
 * No runtime rooms, historical approvals, provider credentials or request logs. */
export const studioFullDemoFixture = {
  "recordedAt": "2026-10-27T17:38:05.733Z",
  "model": "muse-spark-1.3",
  "drafts": {
    "en": "Beacon Commons admits applications only at or after 2026-11-22T17:30:00.000Z and strictly before 2026-11-25T21:00:00.000Z. Nonresidents must additionally submit at or before 2026-11-24T10:15:30.250Z; residents have no additional early cutoff. Within those time limits, an applicant must satisfy exactly one age pathway: (Y) age 16 through 20 inclusive, with guardian consent, resident status, student status, and no membership, all required together; or (A) age at least 21 AND at least one of these alternatives: (A1) resident and not a member; (A2) member AND (student OR no scholarship). The age-at-least-21 requirement applies to both A1 and A2. No person below 16 qualifies. Anyone who does not meet a complete pathway is rejected. For admitted applicants only, take the first matching fee in this priority order, in USD cents: scholarship 500; both student and member 1400; member 2700; student 3300; otherwise 4600. Rejected applicants have no fee.",
    "es": "Beacon Commons admite solicitudes únicamente a partir de 2026-11-22T17:30:00.000Z, inclusive, y estrictamente antes de 2026-11-25T21:00:00.000Z. Quienes no sean residentes deben, además, presentar la solicitud estrictamente antes de 2026-11-24T10:15:30.250Z, sin incluir ese instante; los residentes no tienen ese límite anticipado adicional. Dentro de esos límites temporales, cada solicitante debe cumplir una vía completa según la edad: (J) tener entre 16 y 20 años, ambos inclusive, Y tener consentimiento del tutor, ser residente, ser estudiante y no ser miembro, siendo obligatorios todos esos requisitos; O (A) tener al menos 21 años Y cumplir al menos una de las siguientes alternativas: (A1) ser residente y no ser miembro; (A2) ser miembro Y (ser estudiante O no tener beca). El requisito de tener al menos 21 años se aplica tanto a A1 como a A2. Ninguna persona menor de 16 años cumple los requisitos. Se rechaza a toda persona que no cumpla una vía completa. Solo para las personas admitidas, se cobra la primera tarifa aplicable en este orden de prioridad, en centavos USD: beca, 500; estudiante y miembro a la vez, 1400; miembro, 2700; estudiante, 3300; en cualquier otro caso, 4600. Las personas rechazadas no tienen tarifa."
  },
  "candidates": [
    {
      "editor": "alice",
      "en": "Beacon Commons admits applications only at or after 2026-11-22T17:30:00.000Z and strictly before 2026-11-25T21:00:00.000Z. Nonresidents must additionally submit at or before 2026-11-24T10:15:30.250Z; residents have no additional early cutoff. Within those time limits, an applicant must satisfy exactly one age pathway: (Y) age 16 through 20 inclusive, with guardian consent, resident status, student status, and no membership, all required together; or (A) age at least 21 AND at least one of these alternatives: (A1) resident and not a member; (A2) member AND (student OR no scholarship). The age-at-least-21 requirement applies to both A1 and A2. No person below 16 qualifies. Anyone who does not meet a complete pathway is rejected. For admitted applicants only, take the first matching fee in this priority order, in USD cents: scholarship 500; both student and member 1400; member 2700; student 3300; otherwise 4600. Rejected applicants have no fee.",
      "es": "Beacon Commons admite solicitudes solo a partir del 2026-11-22T17:30:00.000Z, inclusive, y estrictamente antes del 2026-11-25T21:00:00.000Z. Quienes no sean residentes deben, además, presentar la solicitud en o antes del 2026-11-24T10:15:30.250Z, incluyendo ese instante; los residentes no tienen ese límite anticipado adicional. Dentro de esos límites temporales (que se aplican a todas las vías), cada solicitante debe cumplir exactamente una vía completa según la edad: (J) (tener entre 16 y 20 años, ambos inclusive, Y tener consentimiento del tutor Y ser residente Y ser estudiante Y no ser miembro, siendo obligatorios todos esos requisitos juntos); O (A) (tener al menos 21 años Y cumplir al menos una de las siguientes alternativas: (A1) (tener al menos 21 años Y ser residente Y no ser miembro); (A2) (tener al menos 21 años Y ser miembro Y (ser estudiante O no tener beca))). El requisito de tener al menos 21 años se aplica tanto a A1 como a A2. Ninguna persona menor de 16 años cumple los requisitos. Se rechaza a toda persona que no cumpla una vía completa. Solo para las personas admitidas, se cobra la primera tarifa aplicable en este orden de prioridad, en centavos USD: beca, 500; estudiante y miembro a la vez, 1400; miembro, 2700; estudiante, 3300; en cualquier otro caso, 4600. Las personas rechazadas no tienen tarifa.",
      "rules": {
        "eligibility": {
          "op": "all",
          "args": [
            {
              "op": "time",
              "cmp": "gte",
              "value": "2026-11-22T17:30:00.000Z"
            },
            {
              "op": "time",
              "cmp": "lt",
              "value": "2026-11-25T21:00:00.000Z"
            },
            {
              "op": "any",
              "args": [
                {
                  "op": "flag",
                  "field": "resident",
                  "value": true
                },
                {
                  "op": "time",
                  "cmp": "lte",
                  "value": "2026-11-24T10:15:30.250Z"
                }
              ]
            },
            {
              "op": "any",
              "args": [
                {
                  "op": "all",
                  "args": [
                    {
                      "op": "age",
                      "cmp": "gte",
                      "value": 16
                    },
                    {
                      "op": "age",
                      "cmp": "lte",
                      "value": 20
                    },
                    {
                      "op": "flag",
                      "field": "guardianConsent",
                      "value": true
                    },
                    {
                      "op": "flag",
                      "field": "resident",
                      "value": true
                    },
                    {
                      "op": "flag",
                      "field": "student",
                      "value": true
                    },
                    {
                      "op": "flag",
                      "field": "member",
                      "value": false
                    }
                  ]
                },
                {
                  "op": "all",
                  "args": [
                    {
                      "op": "age",
                      "cmp": "gte",
                      "value": 21
                    },
                    {
                      "op": "any",
                      "args": [
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "resident",
                              "value": true
                            },
                            {
                              "op": "flag",
                              "field": "member",
                              "value": false
                            }
                          ]
                        },
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "member",
                              "value": true
                            },
                            {
                              "op": "any",
                              "args": [
                                {
                                  "op": "flag",
                                  "field": "student",
                                  "value": true
                                },
                                {
                                  "op": "flag",
                                  "field": "scholarship",
                                  "value": false
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        "fee": {
          "currency": "USD",
          "defaultCents": 4600,
          "overrides": [
            {
              "when": {
                "op": "flag",
                "field": "scholarship",
                "value": true
              },
              "cents": 500,
              "label": "scholarship"
            },
            {
              "when": {
                "op": "all",
                "args": [
                  {
                    "op": "flag",
                    "field": "student",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "member",
                    "value": true
                  }
                ]
              },
              "cents": 1400,
              "label": "student and member"
            },
            {
              "when": {
                "op": "flag",
                "field": "member",
                "value": true
              },
              "cents": 2700,
              "label": "member"
            },
            {
              "when": {
                "op": "flag",
                "field": "student",
                "value": true
              },
              "cents": 3300,
              "label": "student"
            }
          ]
        }
      },
      "issues": []
    },
    {
      "editor": "bob",
      "en": "Beacon Commons admits applications only at or after 2026-11-22T17:30:00.000Z, inclusive, and strictly before 2026-11-25T21:00:00.000Z. Nonresidents must additionally submit strictly before 2026-11-24T10:15:30.250Z, excluding that instant; residents have no additional early cutoff. Within those time limits (which apply to all pathways), each applicant must satisfy one complete age pathway: (Y) (age 16 through 20 inclusive AND guardian consent AND resident status AND student status AND no membership, all required together); OR (A) (age at least 21 AND at least one of the following alternatives: (A1) (age at least 21 AND resident AND not a member); (A2) (age at least 21 AND member AND (student OR no scholarship))). The age-at-least-21 requirement applies to both A1 and A2. No person below 16 qualifies. Anyone who does not meet a complete pathway is rejected. For admitted applicants only, take the first matching fee in this priority order, in USD cents: scholarship 500; both student and member 1400; member 2700; student 3300; otherwise 4600. Rejected applicants have no fee.",
      "es": "Beacon Commons admite solicitudes únicamente a partir de 2026-11-22T17:30:00.000Z, inclusive, y estrictamente antes de 2026-11-25T21:00:00.000Z. Quienes no sean residentes deben, además, presentar la solicitud estrictamente antes de 2026-11-24T10:15:30.250Z, sin incluir ese instante; los residentes no tienen ese límite anticipado adicional. Dentro de esos límites temporales, cada solicitante debe cumplir una vía completa según la edad: (J) tener entre 16 y 20 años, ambos inclusive, Y tener consentimiento del tutor, ser residente, ser estudiante y no ser miembro, siendo obligatorios todos esos requisitos; O (A) tener al menos 21 años Y cumplir al menos una de las siguientes alternativas: (A1) ser residente y no ser miembro; (A2) ser miembro Y (ser estudiante O no tener beca). El requisito de tener al menos 21 años se aplica tanto a A1 como a A2. Ninguna persona menor de 16 años cumple los requisitos. Se rechaza a toda persona que no cumpla una vía completa. Solo para las personas admitidas, se cobra la primera tarifa aplicable en este orden de prioridad, en centavos USD: beca, 500; estudiante y miembro a la vez, 1400; miembro, 2700; estudiante, 3300; en cualquier otro caso, 4600. Las personas rechazadas no tienen tarifa.",
      "rules": {
        "eligibility": {
          "op": "all",
          "args": [
            {
              "op": "time",
              "cmp": "gte",
              "value": "2026-11-22T17:30:00.000Z"
            },
            {
              "op": "time",
              "cmp": "lt",
              "value": "2026-11-25T21:00:00.000Z"
            },
            {
              "op": "any",
              "args": [
                {
                  "op": "flag",
                  "field": "resident",
                  "value": true
                },
                {
                  "op": "time",
                  "cmp": "lt",
                  "value": "2026-11-24T10:15:30.250Z"
                }
              ]
            },
            {
              "op": "any",
              "args": [
                {
                  "op": "all",
                  "args": [
                    {
                      "op": "age",
                      "cmp": "gte",
                      "value": 16
                    },
                    {
                      "op": "age",
                      "cmp": "lte",
                      "value": 20
                    },
                    {
                      "op": "flag",
                      "field": "guardianConsent",
                      "value": true
                    },
                    {
                      "op": "flag",
                      "field": "resident",
                      "value": true
                    },
                    {
                      "op": "flag",
                      "field": "student",
                      "value": true
                    },
                    {
                      "op": "flag",
                      "field": "member",
                      "value": false
                    }
                  ]
                },
                {
                  "op": "all",
                  "args": [
                    {
                      "op": "age",
                      "cmp": "gte",
                      "value": 21
                    },
                    {
                      "op": "any",
                      "args": [
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "resident",
                              "value": true
                            },
                            {
                              "op": "flag",
                              "field": "member",
                              "value": false
                            }
                          ]
                        },
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "member",
                              "value": true
                            },
                            {
                              "op": "any",
                              "args": [
                                {
                                  "op": "flag",
                                  "field": "student",
                                  "value": true
                                },
                                {
                                  "op": "flag",
                                  "field": "scholarship",
                                  "value": false
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        "fee": {
          "currency": "USD",
          "defaultCents": 4600,
          "overrides": [
            {
              "when": {
                "op": "flag",
                "field": "scholarship",
                "value": true
              },
              "cents": 500,
              "label": "scholarship"
            },
            {
              "when": {
                "op": "all",
                "args": [
                  {
                    "op": "flag",
                    "field": "student",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "member",
                    "value": true
                  }
                ]
              },
              "cents": 1400,
              "label": "student and member"
            },
            {
              "when": {
                "op": "flag",
                "field": "member",
                "value": true
              },
              "cents": 2700,
              "label": "member"
            },
            {
              "when": {
                "op": "flag",
                "field": "student",
                "value": true
              },
              "cents": 3300,
              "label": "student"
            }
          ]
        }
      },
      "issues": []
    }
  ],
  "baselineEditor": "alice",
  "unsafeProposal": {
    "en": "Beacon Commons admits applications only at or after 2026-11-22T17:30:00.000Z and strictly before 2026-11-25T21:00:00.000Z. Nonresidents must additionally submit at or before 2026-11-24T10:15:30.250Z; residents have no additional early cutoff. Within those time limits, an applicant must satisfy exactly one age pathway: (Y) age 16 through 20 inclusive, with guardian consent, resident status, student status, and no membership, all required together; or (A) age at least 21 AND at least one of these alternatives: (A1) resident and not a member; (A2) member AND (student OR no scholarship). The age-at-least-21 requirement applies to both A1 and A2. No person below 16 qualifies. Anyone who does not meet a complete pathway is rejected. For admitted applicants only, take the first matching fee in this priority order, in USD cents: student 1900; scholarship 500; member 3100; otherwise 4600. Rejected applicants have no fee.",
    "es": "Beacon Commons admite solicitudes únicamente a partir de 2026-11-22T17:30:00.000Z, inclusive, y estrictamente antes de 2026-11-25T21:00:00.000Z. Quienes no sean residentes deben, además, presentar la solicitud hasta 2026-11-24T10:15:30.250Z, inclusive; los residentes no tienen ese límite anticipado adicional. Dentro de esos límites temporales, cada solicitante debe cumplir una vía completa según la edad: (J) tener entre 16 y 20 años, ambos inclusive, Y tener consentimiento del tutor, ser residente, ser estudiante y no ser miembro, siendo obligatorios todos esos requisitos; O (A) tener al menos 21 años Y cumplir al menos una de las siguientes alternativas: (A1) ser residente y no ser miembro; (A2) ser miembro Y (ser estudiante O no tener beca). El requisito de tener al menos 21 años se aplica tanto a A1 como a A2. Ninguna persona menor de 16 años cumple los requisitos. Se rechaza a toda persona que no cumpla una vía completa. Solo para las personas admitidas, se cobra la primera tarifa aplicable en este orden de prioridad, en centavos USD: estudiante, 1900; beca, 500; miembro, 3100; en cualquier otro caso, 4600. Las personas rechazadas no tienen tarifa.",
    "rules": {
      "eligibility": {
        "op": "all",
        "args": [
          {
            "op": "time",
            "cmp": "gte",
            "value": "2026-11-22T17:30:00.000Z"
          },
          {
            "op": "time",
            "cmp": "lt",
            "value": "2026-11-25T21:00:00.000Z"
          },
          {
            "op": "any",
            "args": [
              {
                "op": "flag",
                "field": "resident",
                "value": true
              },
              {
                "op": "time",
                "cmp": "lte",
                "value": "2026-11-24T10:15:30.250Z"
              }
            ]
          },
          {
            "op": "any",
            "args": [
              {
                "op": "all",
                "args": [
                  {
                    "op": "age",
                    "cmp": "gte",
                    "value": 16
                  },
                  {
                    "op": "age",
                    "cmp": "lte",
                    "value": 20
                  },
                  {
                    "op": "flag",
                    "field": "guardianConsent",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "resident",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "student",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "member",
                    "value": false
                  }
                ]
              },
              {
                "op": "all",
                "args": [
                  {
                    "op": "age",
                    "cmp": "gte",
                    "value": 21
                  },
                  {
                    "op": "any",
                    "args": [
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "resident",
                            "value": true
                          },
                          {
                            "op": "flag",
                            "field": "member",
                            "value": false
                          }
                        ]
                      },
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "member",
                            "value": true
                          },
                          {
                            "op": "any",
                            "args": [
                              {
                                "op": "flag",
                                "field": "student",
                                "value": true
                              },
                              {
                                "op": "flag",
                                "field": "scholarship",
                                "value": false
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      "fee": {
        "currency": "USD",
        "defaultCents": 4600,
        "overrides": [
          {
            "when": {
              "op": "flag",
              "field": "student",
              "value": true
            },
            "cents": 1900,
            "label": "student"
          },
          {
            "when": {
              "op": "flag",
              "field": "scholarship",
              "value": true
            },
            "cents": 500,
            "label": "scholarship"
          },
          {
            "when": {
              "op": "flag",
              "field": "member",
              "value": true
            },
            "cents": 3100,
            "label": "member"
          }
        ]
      }
    },
    "issues": []
  },
  "correctedProposal": {
    "en": "Beacon Commons admits applications only at or after 2026-11-22T17:30:00.000Z and strictly before 2026-11-25T21:00:00.000Z. Nonresidents must additionally submit at or before 2026-11-24T10:15:30.250Z; residents have no additional early cutoff. Those time limits apply to all pathways. Within those time limits, an applicant must satisfy exactly one complete age pathway: (Y) (age 16 through 20 inclusive AND guardian consent AND resident AND student AND not a member, all required together); OR (A) (at least 21 years old AND ((resident AND not a member) OR (member AND (student OR no scholarship)))). The requirement of at least 21 years old applies to both (A1) (resident AND not a member) and (A2) (member AND (student OR no scholarship)). No person below 16 qualifies. Anyone who does not meet a complete pathway is rejected. For admitted applicants only, take the first matching fee in this priority order, in USD cents: student 1900; scholarship 500; member 2700; otherwise 4600. Rejected applicants have no fee.",
    "es": "Beacon Commons admite solicitudes solo a partir del 2026-11-22T17:30:00.000Z, inclusive, y estrictamente antes del 2026-11-25T21:00:00.000Z. Quienes no sean residentes deben, además, presentar la solicitud en o antes del 2026-11-24T10:15:30.250Z, incluyendo ese instante; los residentes no tienen ese límite anticipado adicional. Esos límites temporales se aplican a todas las vías. Dentro de esos límites temporales, cada solicitante debe cumplir exactamente una vía completa según la edad: (J) (tener entre 16 y 20 años, ambos inclusive, Y tener consentimiento del tutor Y ser residente Y ser estudiante Y no ser miembro, siendo obligatorios todos esos requisitos juntos); O (A) (tener al menos 21 años Y ((ser residente Y no ser miembro) O (ser miembro Y (ser estudiante O no tener beca)))). El requisito de tener al menos 21 años se aplica tanto a (A1) (ser residente Y no ser miembro) como a (A2) (ser miembro Y (ser estudiante O no tener beca)). Ninguna persona menor de 16 años cumple los requisitos. Se rechaza a toda persona que no cumpla una vía completa. Solo para las personas admitidas, se cobra la primera tarifa aplicable en este orden de prioridad, en centavos USD: estudiante, 1900; beca, 500; miembro, 2700; en cualquier otro caso, 4600. Las personas rechazadas no tienen tarifa.",
    "rules": {
      "eligibility": {
        "op": "all",
        "args": [
          {
            "op": "time",
            "cmp": "gte",
            "value": "2026-11-22T17:30:00.000Z"
          },
          {
            "op": "time",
            "cmp": "lt",
            "value": "2026-11-25T21:00:00.000Z"
          },
          {
            "op": "any",
            "args": [
              {
                "op": "flag",
                "field": "resident",
                "value": true
              },
              {
                "op": "time",
                "cmp": "lte",
                "value": "2026-11-24T10:15:30.250Z"
              }
            ]
          },
          {
            "op": "any",
            "args": [
              {
                "op": "all",
                "args": [
                  {
                    "op": "age",
                    "cmp": "gte",
                    "value": 16
                  },
                  {
                    "op": "age",
                    "cmp": "lte",
                    "value": 20
                  },
                  {
                    "op": "flag",
                    "field": "guardianConsent",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "resident",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "student",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "member",
                    "value": false
                  }
                ]
              },
              {
                "op": "all",
                "args": [
                  {
                    "op": "age",
                    "cmp": "gte",
                    "value": 21
                  },
                  {
                    "op": "any",
                    "args": [
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "resident",
                            "value": true
                          },
                          {
                            "op": "flag",
                            "field": "member",
                            "value": false
                          }
                        ]
                      },
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "member",
                            "value": true
                          },
                          {
                            "op": "any",
                            "args": [
                              {
                                "op": "flag",
                                "field": "student",
                                "value": true
                              },
                              {
                                "op": "flag",
                                "field": "scholarship",
                                "value": false
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      "fee": {
        "currency": "USD",
        "defaultCents": 4600,
        "overrides": [
          {
            "when": {
              "op": "flag",
              "field": "student",
              "value": true
            },
            "cents": 1900,
            "label": "Agreed student fee"
          },
          {
            "when": {
              "op": "flag",
              "field": "scholarship",
              "value": true
            },
            "cents": 500,
            "label": "scholarship"
          },
          {
            "when": {
              "op": "flag",
              "field": "member",
              "value": true
            },
            "cents": 2700,
            "label": "member"
          }
        ]
      }
    },
    "issues": []
  },
  "attendee": {
    "age": 29,
    "resident": true,
    "student": true,
    "member": true,
    "guardianConsent": false,
    "scholarship": false,
    "submittedAt": "2026-11-23T12:00:00.000Z"
  }
} satisfies { recordedAt: string; model: string; drafts: { en: string; es: string }; candidates: StudioDemoFixture["candidates"]; baselineEditor: StudioEditor; unsafeProposal: StudioRepairProposal; correctedProposal: StudioRepairProposal; attendee: StudioAttendee };
