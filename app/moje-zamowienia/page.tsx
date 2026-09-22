import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import AccountPanel from "./account-panel";

export const metadata: Metadata = {
  title: "Moje zamówienia | KEIKA",
  description:
    "Panel klienta KEIKA: zaloguj się numerem telefonu, sprawdź status swoich zamówień, dane przesyłki i opłać zamówienie przez Przelewy24.",
  alternates: { canonical: "https://sklep.keika.pl/moje-zamowienia" },
  robots: { index: false, follow: true },
};

export default function OrdersPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AccountPanel />
        <p className={styles.sectionIntro}>
          Masz pytanie do zamówienia? Zadzwoń <a href="tel:+48790215251">790 215 251</a> albo napisz{" "}
          <a href="mailto:biuro@keika.pl">biuro@keika.pl</a>. Zasady konta opisuje{" "}
          <Link href="/regulamin-konta">regulamin konta klienta</Link>.
        </p>
      </div>
    </main>
  );
}
