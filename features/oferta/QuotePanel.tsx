"use client";

import QuoteForm from "./QuoteForm";
import { OFERTA_BY_SLUG } from "./registry";
import { QUOTE_ONLY_PRODUCTS } from "@/lib/quote-only";
import styles from "./oferta.module.css";

/** Prawy panel widoku produktu na wycenę (w miejscu konfiguratora, ten sam
 * układ co plisy i rolety dachowe). Właściciel 10.11.2026: „z wyraźnym
 * przekazem, że konfigurator do zamówień online jest w budowie i zapraszamy
 * do wysłania formularza wyceny”. */
export default function QuotePanel({ crmSlug, productLabel }: { crmSlug: string; productLabel: string }) {
  const contentSlug = QUOTE_ONLY_PRODUCTS[crmSlug]?.contentSlug || crmSlug;
  const content = OFERTA_BY_SLUG[contentSlug];
  const label = content?.productLabel || productLabel;
  const options = content?.quoteOptions?.length ? content.quoteOptions : [label, "Nie wiem - proszę o doradztwo"];
  return (
    <>
      <header>
        <strong>Formularz wyceny</strong>
      </header>
      <div className={styles.panelNotice} role="note">
        <strong>Konfigurator zamówień online jest w budowie.</strong>
        <span>Zapraszamy do wysłania formularza wyceny - odpowiemy e-mailem albo telefonicznie, jak wolisz.</span>
      </div>
      <div className={styles.panelForm}>
        <QuoteForm productLabel={label} options={options} slug={crmSlug} questions={content?.quoteQuestions} />
      </div>
    </>
  );
}
