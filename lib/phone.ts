// Numer telefonu klienta - jedno miejsce, w którym "790 215 251",
// "+48 790-215-251", "0790215251" i "0048790215251" stają się tym samym
// numerem. Ta sama logika co w CRM (core/lib/shop_customer_accounts.php,
// shop_customer_normalize_phone) - panel klienta loguje po numerze, więc
// obie strony muszą rozumieć numer identycznie.

/** Kanoniczna postać: 48XXXXXXXXX. Pusty string = nie da się odczytać. */
export function normalizePhone(raw: string): string {
  const cleaned = (raw || "")
    .replace(/[  ]/g, " ")
    .replace(/[‑–—]/g, "-")
    .trim();
  let digits = cleaned.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("480")) digits = `48${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("0")) digits = `48${digits.slice(1)}`;
  if (digits.length === 9) digits = `48${digits}`;
  if (digits.startsWith("48")) {
    const local = digits.slice(2);
    if (local.length !== 9 || local.startsWith("0")) return "";
    return `48${local}`;
  }
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return "";
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== "";
}

/** "+48 790 215 251" - do pokazania klientowi. */
export function formatPhone(raw: string): string {
  const normalized = normalizePhone(raw);
  if (!normalized.startsWith("48") || normalized.length !== 11) return raw;
  const local = normalized.slice(2);
  return `+48 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** Formatowanie w trakcie pisania: grupy po 3 cyfry, bez walki z kursorem
 * (nie przestawiamy znaków, których klient jeszcze nie skończył pisać). */
export function formatPhoneInput(raw: string): string {
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D+/g, "");
  if (!digits) return hasPlus ? "+" : "";
  // "0048 790..." -> "48 790..."
  if (digits.startsWith("0048")) digits = digits.slice(2);
  // Stary zapis krajowy "0 790 215 251": zero nie jest częścią numeru i
  // znika, gdy tylko widać, że klient pisze dalej - żaden polski numer nie
  // zaczyna się od zera, a bez tego pole rozjeżdżało się na "079 021 525 1".
  if (digits.length > 1 && digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (!digits) return hasPlus ? "+" : "";
  let rest = digits;
  let prefix = "";
  if (hasPlus || digits.startsWith("48")) {
    if (digits.startsWith("48")) {
      prefix = "+48 ";
      rest = digits.slice(2).replace(/^0+/, "");
    } else {
      prefix = "+";
    }
  }
  const groups = rest.match(/.{1,3}/g) || [];
  return (prefix + groups.join(" ")).trimEnd();
}

/** Czytelny powód, dlaczego numer nie przeszedł - pokazywany pod polem. */
export function phoneError(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "Podaj numer telefonu.";
  const digits = value.replace(/\D+/g, "");
  if (/[a-zA-Z]/.test(value)) return "Numer telefonu może zawierać tylko cyfry.";
  if (digits.length < 9) return "Numer jest za krótki - podaj 9 cyfr, np. 790 215 251.";
  if (!normalizePhone(value)) return "Nie rozpoznajemy tego numeru. Wpisz 9 cyfr, np. 790 215 251.";
  return "";
}
