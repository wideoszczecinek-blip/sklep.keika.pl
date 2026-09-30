import Link from "next/link";
import OrderVerify from "./order-verify";

type OrderPageProps = {
  params: Promise<{ orderCode: string }>;
};

// Ta sama oprawa co koszyk (nagłówek, tło, karty) - klient, który wraca tu
// dokończyć płatność, ma czuć, że jest dalej w tym samym koszyku, a nie na
// osobnej, surowej stronie (właściciel, 2026-09-30).
export default async function OrderPage({ params }: OrderPageProps) {
  const { orderCode } = await params;

  return (
    <div className="cart-page">
      <div className="cart-page-gradient-bg" aria-hidden="true" />
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Zamówienie</h1>
      </header>
      <main className="cart-page-main">
        <OrderVerify orderCode={orderCode} />
      </main>
    </div>
  );
}
