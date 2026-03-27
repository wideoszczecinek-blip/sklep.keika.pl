import Link from "next/link";
import type { ReactNode } from "react";

type InfoPageShellProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
};

const menuLinks = [
  { label: "Moskitiery", href: "/moskitiery" },
  { label: "O nas", href: "/o-nas" },
  { label: "Moje zamówienia", href: "/moje-zamowienia" },
  { label: "Kontakt", href: "/kontakt" },
  { label: "Regulamin", href: "/regulamin" },
];

export default function InfoPageShell({ eyebrow, title, lead, children }: InfoPageShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef5ff_0%,#f8fbff_42%,#ffffff_100%)] px-5 py-8 text-slate-900 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 flex flex-wrap gap-2">
          {menuLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="overflow-hidden rounded-[30px] border border-[rgba(24,119,242,0.12)] bg-white/90 p-6 shadow-[0_28px_64px_rgba(15,23,42,0.1)] sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#1f5fbf]">{eyebrow}</p>
          <h1 className="mt-3 max-w-[14ch] text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{lead}</p>
        </section>

        <section className="mt-6 rounded-[28px] bg-white/92 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="grid gap-5 text-[15px] leading-8 text-slate-700">{children}</div>
        </section>
      </div>
    </main>
  );
}
