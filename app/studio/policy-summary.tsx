"use client";

import { useMemo } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { readableStudioPolicy } from "../../lib/studio-presentation";
import type { StudioRules } from "../../lib/studio-types";

/** A derived reading view only; approved text and executable rules stay intact. */
export default function PolicySummary({ rules, en, es, title = "The policy, in both languages" }: { rules: StudioRules; en: string; es: string; title?: string }) {
  const key = JSON.stringify(rules);
  const summaries = useMemo(() => ({ en: readableStudioPolicy(rules, "en"), es: readableStudioPolicy(rules, "es") }), [key]);
  const verified = summaries.en.verified && summaries.es.verified;
  return <section className="sps-readable-policy" aria-label="Readable bilingual policy">
    <header><Globe2 size={16} /><div><h3>{title}</h3><p>{verified ? "A reading view of the checked rules. Original wording is preserved below." : "Original wording shown; a condensed reading view could not be verified."}</p></div></header>
    <div className="sps-readable-languages">{(["en", "es"] as const).map(language => <article key={language} lang={language}><h4>{language === "en" ? "English" : "Español"}</h4>{verified ? <><p className="sps-readable-admission">{summaries[language].admission}</p><h5>{language === "en" ? "Fee · first matching rule applies" : "Tarifa · se aplica la primera regla que corresponda"}</h5><div className="sps-readable-fees">{summaries[language].fees.map((fee, index) => <p key={index}>{fee}</p>)}</div></> : <p>{language === "en" ? en : es}</p>}</article>)}</div>
    {verified && summaries.en.removedCount > 0 && <p className="sps-readable-condensed">Redundant fee clauses are omitted after checking that admission and fee outcomes stay the same.</p>}
    {verified && <details className="sps-readable-original"><summary>Original wording · preserved for review <ChevronDown size={13} /></summary><article><strong>English</strong><p lang="en">{en}</p></article><article><strong>Español</strong><p lang="es">{es}</p></article></details>}
  </section>;
}
