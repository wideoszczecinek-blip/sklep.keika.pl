import Link from "next/link";
import {
  COMPANY_LEGAL,
  DELIVERY_METHODS_LABEL,
  FOOTER_LINKS,
  PAYMENT_METHODS_LABEL,
} from "@/lib/company-legal";

// Stopka z danymi rejestrowymi sprzedawcy i linkami do stron formalnych.
// Bez hooków, więc działa i w layoucie serwerowym, i wewnątrz klienckiego
// landingu (home-client.tsx renderuje ją na końcu przewijanej treści, bo
// .home-root ma stałą wysokość 100svh i własne przewijanie).
export default function SiteFooter({ variant = "page" }: { variant?: "page" | "landing" }) {
  const year = new Date().getFullYear();
  return (
    <footer className={`site-footer site-footer--${variant}`} aria-label="Informacje o sprzedawcy">
      <div className="site-footer-shell">
        <div className="site-footer-col site-footer-col--company">
          <p className="site-footer-brand">{COMPANY_LEGAL.brand}</p>
          <p className="site-footer-lead">
            Producent osłon okiennych na wymiar od {COMPANY_LEGAL.producingSince} roku.
          </p>
          <address className="site-footer-address">
            <strong>{COMPANY_LEGAL.legalName}</strong>
            <br />
            {COMPANY_LEGAL.street}, {COMPANY_LEGAL.postalCode} {COMPANY_LEGAL.city}, {COMPANY_LEGAL.country}
            <br />
            NIP {COMPANY_LEGAL.nip} · REGON {COMPANY_LEGAL.regon}
            <br />
            {COMPANY_LEGAL.legalForm}
          </address>
          <p className="site-footer-contact">
            <a href={COMPANY_LEGAL.phoneHref}>{COMPANY_LEGAL.phone}</a> · <a href={`mailto:${COMPANY_LEGAL.email}`}>{COMPANY_LEGAL.email}</a>
            <br />
            {COMPANY_LEGAL.hours}
          </p>
        </div>
        <nav className="site-footer-col site-footer-col--links" aria-label="Strony formalne">
          <p className="site-footer-heading">Informacje</p>
          <ul>
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-footer-col site-footer-col--payments">
          <p className="site-footer-heading">Płatność i dostawa</p>
          <p>
            Płatności online: {PAYMENT_METHODS_LABEL}. Operator płatności: Stripe.
          </p>
          <p>Dostawa: {DELIVERY_METHODS_LABEL}.</p>
          <p>
            Ceny wszystkich produktów są podane w konfiguratorze i w koszyku (brutto, w PLN).
          </p>
        </div>
      </div>
      <p className="site-footer-copy">
        © {year} {COMPANY_LEGAL.legalName}, {COMPANY_LEGAL.city}
      </p>
    </footer>
  );
}
