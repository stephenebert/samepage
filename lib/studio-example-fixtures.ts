import { studioFullDemoFixture } from "./studio-full-demo-fixture.ts";
import type { StudioDemoFixture, StudioEditor, StudioRepairProposal } from "./studio-types";
import type { StudioExampleId } from "./studio-example-inputs";

export interface StudioExampleFixture {
  recordedAt: string;
  model: string;
  candidates: StudioDemoFixture["candidates"];
  baselineEditor?: StudioEditor;
  unsafeProposal?: StudioRepairProposal;
  correctedProposal?: StudioRepairProposal;
}

/** Server-only retained Meta interpretations, stripped of rooms, requests and historical votes. */
export const STUDIO_EXAMPLE_FIXTURES: Record<Exclude<StudioExampleId, "consent" | "interaction">, StudioExampleFixture> = {
  beacon: studioFullDemoFixture,
  harbor: {
  "recordedAt": "2026-10-27T17:36:54.814Z",
  "model": "muse-spark-1.3",
  "candidates": [
    {
      "editor": "alice",
      "en": "Applications to the Harbor Archive Open Studio are in time only when submitted strictly after 2026-12-04T09:00:00.125Z and at or before 2026-12-19T18:00:00.875Z. An on-time applicant must qualify through at least one of the two routes below. Youth route: all three requirements apply: age is at least 15 and at most 19; guardian consent is present; and at least one of these alternatives holds: (a) the applicant is a resident and is not a member, or (b) the applicant is a student and has a scholarship. Adult route: the applicant must be at least 20 years old AND must satisfy at least one of these alternatives: (a) the applicant is a member and is not a student, or (b) the applicant is a resident and also either does not have a scholarship or is a student. The age requirement applies to both adult alternatives. There is one additional requirement for every route: for a submission strictly after 2026-12-14T10:30:00.500Z, the applicant must either have a scholarship, or must both be a member and have guardian consent. At or before that instant, this additional requirement does not apply. Everyone else is rejected. Only admitted applicants have a fee. Use the first matching fee in this order, in USD cents: scholarship AND membership, 350; scholarship, 900; age at most 19, 1700; resident AND student, 2300; membership, 3200; otherwise, 4700.",
      "es": "Las solicitudes para el Harbor Archive Open Studio están dentro de plazo únicamente cuando se presentan estrictamente después de 2026-12-04T09:00:00.125Z y en o antes de 2026-12-19T18:00:00.875Z (inclusive). Una persona solicitante dentro de plazo debe cumplir al menos una de las dos vías siguientes. Vía juvenil: se exigen los tres requisitos siguientes: (1) tener al menos 15 años Y como máximo 19 años; (2) contar con el consentimiento del tutor; y (3) cumplir al menos una de estas alternativas: (a) (ser residente Y no ser miembro), o (b) (ser estudiante Y tener una beca). Vía adulta: se exige (tener al menos 20 años Y (cumplir al menos una de estas alternativas: (a) (ser miembro Y no ser estudiante), o (b) (ser residente Y (no tener beca O ser estudiante)))). El requisito de edad mínima de 20 años se aplica a ambas alternativas de la vía adulta. Hay un requisito adicional para ambas vías: si la solicitud se presenta estrictamente después de 2026-12-14T10:30:00.500Z, entonces se exige (tener una beca O (ser miembro Y contar con el consentimiento del tutor)). Si la solicitud se presenta en ese instante o antes, este requisito adicional no se aplica. Se rechazan todas las demás solicitudes. Solo las personas admitidas tienen tarifa. Se aplica la primera tarifa que corresponda en este orden, en centavos de dólar estadounidense: (beca Y membresía), 350; (beca), 900; (edad de como máximo 19 años), 1700; (residente Y estudiante), 2300; (membresía), 3200; en otro caso, 4700.",
      "rules": {
        "eligibility": {
          "op": "all",
          "args": [
            {
              "op": "time",
              "cmp": "gt",
              "value": "2026-12-04T09:00:00.125Z"
            },
            {
              "op": "time",
              "cmp": "lte",
              "value": "2026-12-19T18:00:00.875Z"
            },
            {
              "op": "any",
              "args": [
                {
                  "op": "time",
                  "cmp": "lte",
                  "value": "2026-12-14T10:30:00.500Z"
                },
                {
                  "op": "flag",
                  "field": "scholarship",
                  "value": true
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
                      "op": "flag",
                      "field": "guardianConsent",
                      "value": true
                    }
                  ]
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
                      "value": 15
                    },
                    {
                      "op": "age",
                      "cmp": "lte",
                      "value": 19
                    },
                    {
                      "op": "flag",
                      "field": "guardianConsent",
                      "value": true
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
                              "field": "student",
                              "value": true
                            },
                            {
                              "op": "flag",
                              "field": "scholarship",
                              "value": true
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "op": "all",
                  "args": [
                    {
                      "op": "age",
                      "cmp": "gte",
                      "value": 20
                    },
                    {
                      "op": "any",
                      "args": [
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "member",
                              "value": true
                            },
                            {
                              "op": "flag",
                              "field": "student",
                              "value": false
                            }
                          ]
                        },
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "resident",
                              "value": true
                            },
                            {
                              "op": "any",
                              "args": [
                                {
                                  "op": "flag",
                                  "field": "scholarship",
                                  "value": false
                                },
                                {
                                  "op": "flag",
                                  "field": "student",
                                  "value": true
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
          "defaultCents": 4700,
          "overrides": [
            {
              "when": {
                "op": "all",
                "args": [
                  {
                    "op": "flag",
                    "field": "scholarship",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "member",
                    "value": true
                  }
                ]
              },
              "cents": 350,
              "label": "scholarship AND membership"
            },
            {
              "when": {
                "op": "flag",
                "field": "scholarship",
                "value": true
              },
              "cents": 900,
              "label": "scholarship"
            },
            {
              "when": {
                "op": "age",
                "cmp": "lte",
                "value": 19
              },
              "cents": 1700,
              "label": "age at most 19"
            },
            {
              "when": {
                "op": "all",
                "args": [
                  {
                    "op": "flag",
                    "field": "resident",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "student",
                    "value": true
                  }
                ]
              },
              "cents": 2300,
              "label": "resident AND student"
            },
            {
              "when": {
                "op": "flag",
                "field": "member",
                "value": true
              },
              "cents": 3200,
              "label": "membership"
            }
          ]
        }
      },
      "issues": []
    },
    {
      "editor": "bob",
      "en": "Applications to the Harbor Archive Open Studio are on time only when submitted strictly after 2026-12-04T09:00:00.125Z and at or before 2026-12-19T18:00:00.875Z (inclusive). An on-time applicant must satisfy at least one of the following two routes. Youth route: all three requirements apply: (1) be at least 15 years old AND at most 19 years old; (2) have guardian consent; and (3) satisfy at least one of these alternatives: (a) (be a resident AND not be a member), or (b) (be a student AND have a scholarship). Adult route: (be at least 20 years old AND (satisfy at least one of these alternatives: (a) (be a member AND be a student), or (b) (be a resident AND (not have a scholarship OR be a student)))). The minimum age of 20 years applies to both adult alternatives. There is an additional requirement for both routes: if the submission is strictly after 2026-12-14T10:30:00.500Z, then (have a scholarship OR (be a member AND have guardian consent)) is required. At or before that instant, this additional requirement does not apply. All other applications are rejected. Only admitted applicants have a fee. Apply the first matching fee in this order, in US dollar cents: (scholarship AND membership), 350; (scholarship), 900; (age at most 19), 1700; (resident AND student), 2300; (membership), 3200; otherwise, 4700.",
      "es": "Las solicitudes para el Estudio Abierto del Archivo del Puerto están dentro de plazo únicamente si se presentan estrictamente después de 2026-12-04T09:00:00.125Z y a más tardar en 2026-12-19T18:00:00.875Z, incluido ese instante. Una persona solicitante dentro de plazo debe cumplir al menos una de las dos vías siguientes. Vía juvenil: se exigen los tres requisitos siguientes: tener al menos 15 y como máximo 19 años; contar con el consentimiento del tutor; y cumplir al menos una de estas alternativas: (a) ser residente y no ser miembro, o (b) ser estudiante y tener una beca. Vía adulta: se exige tener al menos 20 años Y cumplir al menos una de estas alternativas: (a) ser miembro y ser estudiante, o (b) ser residente y, además, no tener beca o ser estudiante. En la alternativa (b), ser residente es obligatorio; además, debe cumplirse al menos una de las condiciones «no tener beca» y «ser estudiante». La edad mínima de 20 años se exige en ambas alternativas de la vía adulta. Hay un requisito adicional para ambas vías: si la solicitud se presenta estrictamente después de 2026-12-14T10:30:00.500Z, se exige tener una beca, o bien cumplir conjuntamente estas dos condiciones: ser miembro y contar con el consentimiento del tutor. Si la solicitud se presenta en ese instante o antes, este requisito adicional no se aplica. Se rechazan todas las demás solicitudes. Solo las personas admitidas tienen tarifa. Se aplica la primera tarifa que corresponda en este orden, en centavos de dólar estadounidense: beca Y membresía, 350; beca, 900; edad de 19 años como máximo, 1700; residente Y estudiante, 2300; membresía, 3200; en otro caso, 4700.",
      "rules": {
        "eligibility": {
          "op": "all",
          "args": [
            {
              "op": "time",
              "cmp": "gt",
              "value": "2026-12-04T09:00:00.125Z"
            },
            {
              "op": "time",
              "cmp": "lte",
              "value": "2026-12-19T18:00:00.875Z"
            },
            {
              "op": "any",
              "args": [
                {
                  "op": "time",
                  "cmp": "lte",
                  "value": "2026-12-14T10:30:00.500Z"
                },
                {
                  "op": "flag",
                  "field": "scholarship",
                  "value": true
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
                      "op": "flag",
                      "field": "guardianConsent",
                      "value": true
                    }
                  ]
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
                      "value": 15
                    },
                    {
                      "op": "age",
                      "cmp": "lte",
                      "value": 19
                    },
                    {
                      "op": "flag",
                      "field": "guardianConsent",
                      "value": true
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
                              "field": "student",
                              "value": true
                            },
                            {
                              "op": "flag",
                              "field": "scholarship",
                              "value": true
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "op": "all",
                  "args": [
                    {
                      "op": "age",
                      "cmp": "gte",
                      "value": 20
                    },
                    {
                      "op": "any",
                      "args": [
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "member",
                              "value": true
                            },
                            {
                              "op": "flag",
                              "field": "student",
                              "value": true
                            }
                          ]
                        },
                        {
                          "op": "all",
                          "args": [
                            {
                              "op": "flag",
                              "field": "resident",
                              "value": true
                            },
                            {
                              "op": "any",
                              "args": [
                                {
                                  "op": "flag",
                                  "field": "scholarship",
                                  "value": false
                                },
                                {
                                  "op": "flag",
                                  "field": "student",
                                  "value": true
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
          "defaultCents": 4700,
          "overrides": [
            {
              "when": {
                "op": "all",
                "args": [
                  {
                    "op": "flag",
                    "field": "scholarship",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "member",
                    "value": true
                  }
                ]
              },
              "cents": 350,
              "label": "scholarship AND membership"
            },
            {
              "when": {
                "op": "flag",
                "field": "scholarship",
                "value": true
              },
              "cents": 900,
              "label": "scholarship"
            },
            {
              "when": {
                "op": "age",
                "cmp": "lte",
                "value": 19
              },
              "cents": 1700,
              "label": "age at most 19"
            },
            {
              "when": {
                "op": "all",
                "args": [
                  {
                    "op": "flag",
                    "field": "resident",
                    "value": true
                  },
                  {
                    "op": "flag",
                    "field": "student",
                    "value": true
                  }
                ]
              },
              "cents": 2300,
              "label": "resident AND student"
            },
            {
              "when": {
                "op": "flag",
                "field": "member",
                "value": true
              },
              "cents": 3200,
              "label": "membership"
            }
          ]
        }
      },
      "issues": []
    }
  ],
  "baselineEditor": "alice",
  "unsafeProposal": {
    "en": "Applications to the Harbor Archive Open Studio are in time only when submitted strictly after 2026-12-04T09:00:00.125Z and at or before 2026-12-19T18:00:00.875Z. An on-time applicant must qualify through at least one of the two routes below. Youth route: all three requirements apply: age is at least 15 and at most 19; guardian consent is present; and at least one of these alternatives holds: (a) the applicant is a resident and is not a member, or (b) the applicant is a student and has a scholarship. Adult route: the applicant must be at least 20 years old AND must satisfy at least one of these alternatives: (a) the applicant is a member and is not a student, or (b) the applicant is a resident and also either does not have a scholarship or is a student. The age requirement applies to both adult alternatives. There is one additional requirement for every route: for a submission strictly after 2026-12-14T10:30:00.500Z, the applicant must either have a scholarship or be a member. At or before that instant, this additional requirement does not apply. Everyone else is rejected. Only admitted applicants have a fee. Use the first matching fee in this order, in USD cents: student, 2100; scholarship AND membership, 350; scholarship, 900; age at most 19, 1700; resident AND student, 2300; membership, 3200; otherwise, 4700.",
    "es": "Las solicitudes para el Estudio Abierto del Archivo del Puerto están dentro de plazo únicamente si se presentan estrictamente después de 2026-12-04T09:00:00.125Z y a más tardar en 2026-12-19T18:00:00.875Z, incluido ese instante. Una persona solicitante dentro de plazo debe cumplir al menos una de las dos vías siguientes. Vía juvenil: se exigen los tres requisitos siguientes: tener al menos 15 y como máximo 19 años; contar con el consentimiento del tutor; y cumplir al menos una de estas alternativas: (a) ser residente y no ser miembro, o (b) ser estudiante y tener una beca. Vía adulta: se exige tener al menos 20 años Y cumplir al menos una de estas alternativas: (a) ser miembro y no ser estudiante, o (b) ser residente y, además, no tener beca o ser estudiante. En la alternativa (b), ser residente es obligatorio; además, debe cumplirse al menos una de las condiciones «no tener beca» y «ser estudiante». La edad mínima de 20 años se exige en ambas alternativas de la vía adulta. Hay un requisito adicional para ambas vías: si la solicitud se presenta estrictamente después de 2026-12-14T10:30:00.500Z, se exige tener una beca o ser miembro. Si la solicitud se presenta en ese instante o antes, este requisito adicional no se aplica. Se rechazan todas las demás solicitudes. Solo las personas admitidas tienen tarifa. Se aplica la primera tarifa que corresponda en este orden, en centavos de dólar estadounidense: estudiante, 2100; beca Y membresía, 350; beca, 900; edad de 19 años como máximo, 1700; residente Y estudiante, 2300; membresía, 3200; en otro caso, 4700.",
    "rules": {
      "eligibility": {
        "op": "all",
        "args": [
          {
            "op": "time",
            "cmp": "gt",
            "value": "2026-12-04T09:00:00.125Z"
          },
          {
            "op": "time",
            "cmp": "lte",
            "value": "2026-12-19T18:00:00.875Z"
          },
          {
            "op": "any",
            "args": [
              {
                "op": "time",
                "cmp": "lte",
                "value": "2026-12-14T10:30:00.500Z"
              },
              {
                "op": "flag",
                "field": "scholarship",
                "value": true
              },
              {
                "op": "flag",
                "field": "member",
                "value": true
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
                    "value": 15
                  },
                  {
                    "op": "age",
                    "cmp": "lte",
                    "value": 19
                  },
                  {
                    "op": "flag",
                    "field": "guardianConsent",
                    "value": true
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
                            "field": "student",
                            "value": true
                          },
                          {
                            "op": "flag",
                            "field": "scholarship",
                            "value": true
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "op": "all",
                "args": [
                  {
                    "op": "age",
                    "cmp": "gte",
                    "value": 20
                  },
                  {
                    "op": "any",
                    "args": [
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "member",
                            "value": true
                          },
                          {
                            "op": "flag",
                            "field": "student",
                            "value": false
                          }
                        ]
                      },
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "resident",
                            "value": true
                          },
                          {
                            "op": "any",
                            "args": [
                              {
                                "op": "flag",
                                "field": "scholarship",
                                "value": false
                              },
                              {
                                "op": "flag",
                                "field": "student",
                                "value": true
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
        "defaultCents": 4700,
        "overrides": [
          {
            "when": {
              "op": "flag",
              "field": "student",
              "value": true
            },
            "cents": 2100,
            "label": "student"
          },
          {
            "when": {
              "op": "all",
              "args": [
                {
                  "op": "flag",
                  "field": "scholarship",
                  "value": true
                },
                {
                  "op": "flag",
                  "field": "member",
                  "value": true
                }
              ]
            },
            "cents": 350,
            "label": "scholarship AND membership"
          },
          {
            "when": {
              "op": "flag",
              "field": "scholarship",
              "value": true
            },
            "cents": 900,
            "label": "scholarship"
          },
          {
            "when": {
              "op": "age",
              "cmp": "lte",
              "value": 19
            },
            "cents": 1700,
            "label": "age at most 19"
          },
          {
            "when": {
              "op": "all",
              "args": [
                {
                  "op": "flag",
                  "field": "resident",
                  "value": true
                },
                {
                  "op": "flag",
                  "field": "student",
                  "value": true
                }
              ]
            },
            "cents": 2300,
            "label": "resident AND student"
          },
          {
            "when": {
              "op": "flag",
              "field": "member",
              "value": true
            },
            "cents": 3200,
            "label": "membership"
          }
        ]
      }
    },
    "issues": []
  },
  "correctedProposal": {
    "en": "Applications to the Harbor Archive Open Studio are in time only when submitted strictly after 2026-12-04T09:00:00.125Z and at or before 2026-12-19T18:00:00.875Z. An on-time applicant must qualify through at least one of the two routes below. Youth route: all three requirements apply: age is at least 15 and at most 19; guardian consent is present; and at least one of these alternatives holds: (a) the applicant is a resident and is not a member, or (b) the applicant is a student and has a scholarship. Adult route: the applicant must be at least 20 years old AND must satisfy at least one of these alternatives: (a) the applicant is a member and is not a student, or (b) the applicant is a resident and also either does not have a scholarship or is a student. The age requirement applies to both adult alternatives. There is one additional requirement for every route: for a submission strictly after 2026-12-14T10:30:00.500Z, the applicant must either have a scholarship, or must both be a member and have guardian consent. At or before that instant, this additional requirement does not apply. Everyone else is rejected. Only admitted applicants have a fee. Use the first matching fee in this order, in USD cents: student, 2100; scholarship AND membership, 350; scholarship, 900; age at most 19, 1700; membership, 3200; otherwise, 4700.",
    "es": "Las solicitudes para el Harbor Archive Open Studio están dentro de plazo únicamente cuando se presentan estrictamente después de 2026-12-04T09:00:00.125Z y en o antes de 2026-12-19T18:00:00.875Z (inclusive). Una persona solicitante dentro de plazo debe cumplir al menos una de las dos vías siguientes. Vía juvenil: se exigen los tres requisitos siguientes: (1) tener al menos 15 años Y como máximo 19 años; (2) contar con el consentimiento del tutor; y (3) cumplir al menos una de estas alternativas: (a) (ser residente Y no ser miembro), o (b) (ser estudiante Y tener una beca). Vía adulta: se exige (tener al menos 20 años Y (cumplir al menos una de estas alternativas: (a) (ser miembro Y no ser estudiante), o (b) (ser residente Y (no tener beca O ser estudiante)))). El requisito de edad mínima de 20 años se aplica a ambas alternativas de la vía adulta. Hay un requisito adicional para ambas vías: si la solicitud se presenta estrictamente después de 2026-12-14T10:30:00.500Z, entonces se exige (tener una beca O (ser miembro Y contar con el consentimiento del tutor)). Si la solicitud se presenta en ese instante o antes, este requisito adicional no se aplica. Se rechazan todas las demás solicitudes. Solo las personas admitidas tienen tarifa. Se aplica la primera tarifa que corresponda en este orden, en centavos de dólar estadounidense: (estudiante), 2100; (beca Y membresía), 350; (beca), 900; (edad de como máximo 19 años), 1700; (membresía), 3200; en otro caso, 4700.",
    "rules": {
      "eligibility": {
        "op": "all",
        "args": [
          {
            "op": "time",
            "cmp": "gt",
            "value": "2026-12-04T09:00:00.125Z"
          },
          {
            "op": "time",
            "cmp": "lte",
            "value": "2026-12-19T18:00:00.875Z"
          },
          {
            "op": "any",
            "args": [
              {
                "op": "time",
                "cmp": "lte",
                "value": "2026-12-14T10:30:00.500Z"
              },
              {
                "op": "flag",
                "field": "scholarship",
                "value": true
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
                    "op": "flag",
                    "field": "guardianConsent",
                    "value": true
                  }
                ]
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
                    "value": 15
                  },
                  {
                    "op": "age",
                    "cmp": "lte",
                    "value": 19
                  },
                  {
                    "op": "flag",
                    "field": "guardianConsent",
                    "value": true
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
                            "field": "student",
                            "value": true
                          },
                          {
                            "op": "flag",
                            "field": "scholarship",
                            "value": true
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "op": "all",
                "args": [
                  {
                    "op": "age",
                    "cmp": "gte",
                    "value": 20
                  },
                  {
                    "op": "any",
                    "args": [
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "member",
                            "value": true
                          },
                          {
                            "op": "flag",
                            "field": "student",
                            "value": false
                          }
                        ]
                      },
                      {
                        "op": "all",
                        "args": [
                          {
                            "op": "flag",
                            "field": "resident",
                            "value": true
                          },
                          {
                            "op": "any",
                            "args": [
                              {
                                "op": "flag",
                                "field": "scholarship",
                                "value": false
                              },
                              {
                                "op": "flag",
                                "field": "student",
                                "value": true
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
        "defaultCents": 4700,
        "overrides": [
          {
            "when": {
              "op": "flag",
              "field": "student",
              "value": true
            },
            "cents": 2100,
            "label": "Agreed student fee"
          },
          {
            "when": {
              "op": "all",
              "args": [
                {
                  "op": "flag",
                  "field": "scholarship",
                  "value": true
                },
                {
                  "op": "flag",
                  "field": "member",
                  "value": true
                }
              ]
            },
            "cents": 350,
            "label": "scholarship AND membership"
          },
          {
            "when": {
              "op": "flag",
              "field": "scholarship",
              "value": true
            },
            "cents": 900,
            "label": "scholarship"
          },
          {
            "when": {
              "op": "age",
              "cmp": "lte",
              "value": 19
            },
            "cents": 1700,
            "label": "age at most 19"
          },
          {
            "when": {
              "op": "flag",
              "field": "member",
              "value": true
            },
            "cents": 3200,
            "label": "membership"
          }
        ]
      }
    },
    "issues": []
  }
},
  cobalt: {
  "recordedAt": "2026-10-27T17:38:36.250Z",
  "model": "muse-spark-1.3",
  "candidates": [
    {
      "editor": "alice",
      "en": "Cobalt Reading Room admits everyone age 18 or older and rejects everyone younger than 18. Registration is always open; there are no date or time restrictions. For admitted attendees the standard fee is 5800 USD cents. Admitted scholarship holders instead pay a reduced fee, but the amount of that reduced fee has not been specified. No other status changes admission or the fee. Rejected attendees have no fee.",
      "es": "Cobalt Reading Room admite a todas las personas de 18 años o más y rechaza a todas las personas menores de 18 años. La inscripción está siempre abierta; no hay restricciones de fecha ni de hora. Para las personas admitidas, la tarifa estándar es de 5800 centavos USD. Las personas admitidas que tienen beca pagan en su lugar una tarifa reducida, pero no se ha especificado el importe de esa tarifa reducida. Ningún otro estado modifica la admisión ni la tarifa. Las personas rechazadas no tienen tarifa.",
      "rules": null,
      "issues": [
        "What is the exact reduced fee in USD cents for admitted scholarship holders? The policy states a reduced fee applies but does not specify the amount, so no unique fee can be compiled."
      ]
    },
    {
      "editor": "bob",
      "en": "Cobalt Reading Room admits everyone age 18 or older and rejects everyone younger than 18. Registration is always open; there are no date or time restrictions. For admitted attendees the standard fee is 5800 USD cents. Admitted scholarship holders instead pay a reduced fee, but the amount of that reduced fee has not been specified. No other status changes admission or the fee. Rejected attendees have no fee.",
      "es": "Cobalt Reading Room admite a todas las personas de 18 años o más y rechaza a todas las menores de 18 años. La inscripción está siempre abierta; no hay restricciones de fecha ni de hora. Para las personas admitidas, la tarifa estándar es de 5800 centavos USD. Las personas admitidas que tienen beca pagan en su lugar una tarifa reducida, pero no se ha especificado el importe de esa tarifa reducida. Ningún otro estado modifica la admisión ni la tarifa. Las personas rechazadas no tienen tarifa.",
      "rules": null,
      "issues": [
        "What is the exact reduced fee in USD cents for admitted scholarship holders? The policy states a reduced fee applies but does not specify the amount, so no unique fee can be compiled."
      ]
    }
  ]
}
};
