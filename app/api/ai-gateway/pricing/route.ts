import { NextResponse } from "next/server";
import { getPricingRecords, refreshProviderPricing } from "../../../lib/pricing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldRefresh = url.searchParams.get("refresh") === "true";

  if (!shouldRefresh) {
    return NextResponse.json({
      records: getPricingRecords(),
      failures: [],
      refreshedAt: null,
    });
  }

  const pricing = await refreshProviderPricing();
  return NextResponse.json(pricing);
}
