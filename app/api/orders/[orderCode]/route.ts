import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;
  const { searchParams } = new URL(request.url);
  const verifier = searchParams.get("verifier") || "";
  const accessToken = searchParams.get("access_token") || "";

  try {
    const lookupParams = new URLSearchParams({ order_code: orderCode });
    // access_token (from a one-click e-mail link, e.g. the payment_failed
    // retry link) skips the phone/email prompt entirely - only falls back
    // to verifier when there isn't one.
    if (accessToken) lookupParams.set("access_token", accessToken);
    else lookupParams.set("verifier", verifier);

    const response = await fetch(
      `${crmBaseUrl}/biuro/api/shop-public/order_get?${lookupParams.toString()}`,
      { cache: "no-store" },
    );
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Order lookup failed",
      },
      { status: 500 },
    );
  }
}

