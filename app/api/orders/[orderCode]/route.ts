import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;
  const { searchParams } = new URL(request.url);
  const verifier = searchParams.get("verifier") || "";

  try {
    const response = await fetch(
      `${crmBaseUrl}/biuro/api/shop-public/order_get?order_code=${encodeURIComponent(orderCode)}&verifier=${encodeURIComponent(verifier)}`,
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

