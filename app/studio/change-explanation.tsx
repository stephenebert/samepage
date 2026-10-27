"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { explainStudioChange } from "../../lib/studio-change-explanation";
import type { StudioChangeExplanationInput, StudioRuleProof } from "../../lib/studio-change-explanation";
import "./change-explanation.css";

function Rule({ proof, title, titleEs }: { proof: StudioRuleProof; title: string; titleEs: string }) {
  return <article className="sps-why-rule">
    <header><strong>{title}</strong><span lang="es">{titleEs}</span></header>
    <p className="sps-why-rule-number">{proof.kind === "override" ? `First match · rule ${proof.ruleNumber}` : proof.kind === "admission" ? "Admission condition" : "Standard fee"}</p>
    <div className="sps-why-rule-match"><p lang="en">{proof.condition.en}</p><p lang="es">{proof.condition.es}</p><strong>{proof.result.en}</strong></div>
    <p lang="en">{proof.detail.en}</p><p lang="es">{proof.detail.es}</p>
  </article>;
}

export default function ChangeExplanation(input: StudioChangeExplanationInput) {
  const key = JSON.stringify(input);
  const explanation = useMemo(() => explainStudioChange(input), [key]);
  return <details className={`sps-change-explanation ${explanation.status}`}>
    <summary>Why did this change? <ChevronDown size={14} aria-hidden="true" /></summary>
    <div className="sps-why-body">
      <div className="sps-why-copy"><article lang="en"><h4>{explanation.title.en}</h4><p><strong>{explanation.scope.en}</strong> {explanation.summary.en}</p></article><article lang="es"><h4>{explanation.title.es}</h4><p><strong>{explanation.scope.es}</strong> {explanation.summary.es}</p></article></div>
      <div className="sps-why-rules"><Rule proof={explanation.compare === "expected" ? explanation.expected : explanation.baseline} title={explanation.compare === "expected" ? "Requested outcome" : "Before the change"} titleEs={explanation.compare === "expected" ? "Resultado solicitado" : "Antes del cambio"} /><Rule proof={explanation.proposed} title="Proposed rewrite" titleEs="Reescritura propuesta" /></div>
      <p className="sps-why-note">Computed from the checked rules for this attendee. Review the original wording separately.<br /><span lang="es">Calculado a partir de las reglas verificadas para esta persona. Revisa el texto original por separado.</span></p>
    </div>
  </details>;
}
