"use client";

import { useMemo } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { canonicalStudioPolicy } from "../../lib/studio-presentation";
import type { StudioRules, StudioText } from "../../lib/studio-types";

/** New approvals display the exact deterministic wording that publication stores. */
export default function PolicySummary({ rules, en, es, originalWording, mode = "approval", title = "The policy, in both languages" }: { rules: StudioRules; en: string; es: string; originalWording?: StudioText; mode?: "approval" | "published" | "reading"; title?: string }) {
  const key = JSON.stringify(rules);
  const canonical = useMemo(() => canonicalStudioPolicy(rules), [key]);
  const wording = mode === "published" ? { en, es } : canonical;
  const original = originalWording ?? { en, es };
  return <section className="sps-readable-policy" aria-label="Readable bilingual policy">
    <header><Globe2 size={16} /><div><h3>{title}</h3><p>{mode === "approval" ? "Approve this explicitly grouped wording and its interpreted rules. These exact words will be published after both approvals." : mode === "published" ? "The exact grouped wording approved by both editors and used by this policy version." : "A grouped reading view of the interpreted rules. Original wording is retained below."} Compare with the original below: grouping does not prove that the original was interpreted correctly.</p></div></header>
    <div className="sps-readable-languages">{(["en", "es"] as const).map(language => {
      const [admission, ...fees] = wording[language].split("\n");
      return <article key={language} lang={language}><h4>{language === "en" ? "English" : "Español"}</h4><p className="sps-readable-admission">{admission}</p><h5>{language === "en" ? "Fee · first matching rule applies" : "Tarifa · se aplica la primera regla que corresponda"}</h5><div className="sps-readable-fees">{fees.map((fee, index) => <p key={index}>{fee}</p>)}</div></article>;
    })}</div>
    <details className="sps-readable-original"><summary>Original wording · retained as evidence <ChevronDown size={13} /></summary><p>Source and model wording is preserved verbatim. Review any ambiguity against the grouped interpretation above.</p><article><strong>English</strong><p lang="en">{original.en}</p></article><article><strong>Español</strong><p lang="es">{original.es}</p></article></details>
  </section>;
}
