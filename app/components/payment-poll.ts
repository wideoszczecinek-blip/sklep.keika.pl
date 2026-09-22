import type { Stripe } from "@stripe/stripe-js";

// Wspólne czekanie na rozstrzygnięcie płatności asynchronicznej (BLIK,
// Przelewy24, każda metoda z potwierdzeniem poza sklepem).
//
// Maszyna stanów BLIK w Stripe:
//   confirmBlikPayment(..., {handleActions:false})
//     -> requires_action  (kod przyjęty, klient zatwierdza w aplikacji banku;
//                          next_action = blik_authorize, trwa nawet ~2 min)
//     -> processing       (bank przyjął, trwa rozliczenie)
//     -> succeeded        (zapłacone)
//   odrzucenie / wygaśnięcie kodu -> requires_payment_method (albo canceled)
//
// Incydent 2026-09-22 (właściciel, prawdziwa płatność): poprzednia wersja
// traktowała KAŻDY status inny niż "processing" jako odrzucenie, więc już
// przy pierwszym odpytaniu (3 s po wpisaniu kodu) widziała "requires_action"
// i pokazywała „Płatność nie została potwierdzona w aplikacji bankowej”,
// zanim klient w ogóle zdążył zatwierdzić BLIK w banku. Dlatego statusy
// oczekiwania są tu wymienione z nazwy, a błędem jest tylko realne
// odrzucenie.

const PENDING_AUTH = new Set(["requires_action", "requires_confirmation"]);

export type PollOutcome =
  | { kind: "succeeded" }
  | { kind: "rejected"; status: string; errorCode?: string; errorMessage?: string }
  | { kind: "timeout"; status: string | undefined };

export const POLL_INTERVAL_MS = 3000;
/** Stripe daje klientowi 60 s na zatwierdzenie BLIK-a w aplikacji banku
 * (potem sam zwraca payment_method_provider_timeout). Czekamy z zapasem -
 * o końcu decyduje status od Stripe, nie nasz licznik. */
export const BLIK_APPROVAL_SECONDS = 60;
export const AUTH_WINDOW_MS = 180_000;
/** Ile czekamy na rozliczenie po tym, jak bank już przyjął płatność. */
export const PROCESSING_WINDOW_MS = 120_000;

export async function pollPaymentIntentUntilSettled(
  stripe: Stripe,
  clientSecret: string,
  options?: { signal?: AbortSignal },
): Promise<PollOutcome> {
  const startedAt = Date.now();
  let processingSince: number | null = null;
  let lastStatus: string | undefined;

  for (;;) {
    await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
    if (options?.signal?.aborted) return { kind: "timeout", status: lastStatus };

    let status: string | undefined;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    try {
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      status = paymentIntent?.status;
      errorCode = paymentIntent?.last_payment_error?.code;
      errorMessage = paymentIntent?.last_payment_error?.message;
    } catch {
      // Przejściowy błąd sieci - nie przerywamy czekania.
      continue;
    }
    lastStatus = status ?? lastStatus;

    if (status === "succeeded") return { kind: "succeeded" };

    if (status === "processing") {
      if (processingSince === null) processingSince = Date.now();
      if (Date.now() - processingSince > PROCESSING_WINDOW_MS) return { kind: "timeout", status };
      continue;
    }

    if (!status || PENDING_AUTH.has(status)) {
      // Klient nadal ma otwartą aplikację banku (albo chwilowo nie znamy statusu).
      if (Date.now() - startedAt > AUTH_WINDOW_MS) return { kind: "timeout", status };
      continue;
    }

    // requires_payment_method / canceled - kod odrzucony albo wygasł.
    return { kind: "rejected", status, errorCode, errorMessage };
  }
}

export const POLL_REJECTED_MESSAGE =
  "Płatność nie została potwierdzona w aplikacji bankowej (upłynął czas albo została odrzucona). Spróbuj ponownie.";

/** Komunikat dopasowany do tego, co faktycznie zwrócił bank/Stripe. */
export function rejectionMessage(errorCode?: string, errorMessage?: string): string {
  if (errorCode === "payment_method_provider_timeout") {
    return `Płatność nie została zatwierdzona w aplikacji banku w ciągu ${BLIK_APPROVAL_SECONDS} sekund i kod wygasł. Wygeneruj nowy kod BLIK i spróbuj ponownie - nic nie zostało pobrane.`;
  }
  if (errorCode === "payment_method_invalid_parameter") {
    return "Ten kod BLIK jest nieprawidłowy lub już wygasł. Wygeneruj nowy kod w aplikacji banku i wpisz go ponownie.";
  }
  if (errorCode === "payment_method_not_available") {
    return "Bank odrzucił płatność BLIK. Spróbuj ponownie za chwilę albo wybierz inną metodę płatności.";
  }
  return errorMessage || POLL_REJECTED_MESSAGE;
}

export const POLL_TIMEOUT_MESSAGE =
  "Nie otrzymaliśmy jeszcze potwierdzenia z banku. Jeśli zatwierdziłeś/aś płatność w aplikacji, zamówienie zostanie opłacone - potwierdzenie wyślemy e-mailem. Nie płać drugi raz; w razie wątpliwości zadzwoń do nas.";
