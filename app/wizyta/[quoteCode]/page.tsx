import { notFound } from "next/navigation";
import VisitResume from "./visit-resume";
import { fetchPublicQuote } from "@/lib/shop-public";

// "Kontynuuj swoją wizytę" - the short link the SEZON20 countdown banner's
// "Zapisz / wyślij link" and the matching exit-intent modal hand out
// (app/components/promo-save-modal.tsx via app/components/promo-countdown-
// banner.tsx / features/moskitiery-ramkowe/ConfiguratorPanel.tsx). Restores
// whatever the quote_code carries - cart items, rescue discount, the
// site-wide promo code and its *real* remaining time - onto whichever
// device opens it, then sends the customer straight back into the live
// product page. Deliberately separate from /wycena/[quoteCode] (a static
// read-only summary for a real placed quote/order) - see that route's own
// top comment. Reuses the exact quote_code the save modal already shows
// (no separate token/table), just a different destination for it.
type VisitPageProps = {
  params: Promise<{ quoteCode: string }>;
};

export default async function VisitPage({ params }: VisitPageProps) {
  const { quoteCode } = await params;
  const response = await fetchPublicQuote(quoteCode);

  if (!response.ok || !response.quote) {
    notFound();
  }

  return <VisitResume quote={response.quote} />;
}
