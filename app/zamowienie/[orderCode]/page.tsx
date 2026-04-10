import OrderVerify from "./order-verify";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

type OrderPageProps = {
  params: Promise<{ orderCode: string }>;
};

export default async function OrderPage({ params }: OrderPageProps) {
  const { orderCode } = await params;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <OrderVerify orderCode={orderCode} />
      </div>
    </main>
  );
}

