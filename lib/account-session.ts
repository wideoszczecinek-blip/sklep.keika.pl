import { cookies } from "next/headers";

// Sesja panelu klienta trzymana w ciasteczku httpOnly - token nigdy nie
// trafia do JavaScriptu strony (XSS nie wyniesie dostępu do zamówień).
// Wartość to token wystawiony przez CRM (shop_www_customer_sessions).

export const ACCOUNT_COOKIE = "keika_account";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function readAccountSession(): Promise<string> {
  const store = await cookies();
  return store.get(ACCOUNT_COOKIE)?.value || "";
}

export async function writeAccountSession(token: string): Promise<void> {
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearAccountSession(): Promise<void> {
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
