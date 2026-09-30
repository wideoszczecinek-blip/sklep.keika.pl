import type Stripe from "stripe";

export type ChargedMethod = "blik" | "card" | "wallets" | "";

/** Which method Stripe actually charged for a PaymentIntent - read from the
 * charge itself (payment_method_details), not from what the cart selected:
 * card and Google/Apple Pay share one PaymentIntent type ("card") and only
 * the charge's card.wallet tells them apart. "" when there's no charge yet. */
export async function stripeChargedMethod(stripe: Stripe, paymentIntentId: string): Promise<ChargedMethod> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") return "";
  const details = charge.payment_method_details;
  if (!details) return "";
  if (details.type === "blik") return "blik";
  if (details.type === "card") return details.card?.wallet ? "wallets" : "card";
  if (details.type === "revolut_pay") return "wallets";
  return "";
}
