import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";
import { normalizePhone } from "@/lib/phone";
import { clearAccountSession, readAccountSession, writeAccountSession } from "@/lib/account-session";

// Jedno wejście dla panelu klienta (/moje-zamowienia). Przeglądarka nigdy
// nie rozmawia z CRM bezpośrednio i nigdy nie widzi tokenu sesji - token
// żyje w ciasteczku httpOnly, a tu doklejamy go do zapytań do CRM.
//
// POST { action, ... }:
//   start          { phone }                         -> has_password / SMS
//   code_send      { phone, purpose }                -> wysyła kod SMS
//   code_verify    { phone, verification_token, code } -> setup_token
//   password_set   { phone, setup_token, password, terms_accepted } -> sesja
//   login          { phone, password }               -> sesja
//   orders         {}                                -> lista zamówień
//   logout         {}

type CrmJson = Record<string, unknown> & { ok?: boolean; error?: string };

const ENDPOINTS: Record<string, string> = {
  start: "account_start",
  code_send: "account_code_send",
  code_verify: "account_code_verify",
  password_set: "account_password_set",
  login: "account_login",
  orders: "account_orders",
  logout: "account_logout",
};

async function callCrm(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({ ok: false, error: "Błąd odpowiedzi serwera." }))) as CrmJson;
  return { status: response.status, json };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const endpoint = ENDPOINTS[action];
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "Nieznana operacja." }, { status: 400 });
  }

  // Telefon normalizujemy już tutaj - CRM robi to samo, ale dzięki temu
  // błąd "zły numer" widać od razu, bez strzału do CRM.
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  if (["start", "code_send", "code_verify", "password_set", "login"].includes(action) && !phone) {
    return NextResponse.json(
      { ok: false, error: "Nie rozpoznajemy tego numeru. Wpisz 9 cyfr, np. 790 215 251." },
      { status: 400 },
    );
  }

  if (action === "orders" || action === "logout") {
    const sessionToken = await readAccountSession();
    if (!sessionToken) {
      // 200, nie 401: brak sesji to normalny stan pierwszego wejścia na
      // stronę, a nie błąd - nie zaśmiecamy konsoli ani monitoringu.
      return NextResponse.json({ ok: false, unauthenticated: true });
    }
    const { status, json } = await callCrm(endpoint, { session_token: sessionToken });
    if (action === "logout" || status === 401) {
      await clearAccountSession();
    }
    if (status === 401) {
      return NextResponse.json({ ...json, unauthenticated: true });
    }
    return NextResponse.json(json, { status });
  }

  const payload: Record<string, unknown> = { phone };
  if (action === "code_send") payload.purpose = body.purpose === "reset" ? "reset" : "register";
  if (action === "code_verify") {
    payload.verification_token = body.verification_token;
    payload.code = body.code;
  }
  if (action === "password_set") {
    payload.setup_token = body.setup_token;
    payload.password = body.password;
    payload.terms_accepted = body.terms_accepted === true;
  }
  if (action === "login") payload.password = body.password;

  const { status, json } = await callCrm(endpoint, payload);

  // Token sesji zostaje na serwerze - do przeglądarki idzie tylko ciasteczko.
  if (json.ok && typeof json.session_token === "string" && json.session_token) {
    await writeAccountSession(json.session_token);
    delete json.session_token;
  }
  return NextResponse.json(json, { status });
}
