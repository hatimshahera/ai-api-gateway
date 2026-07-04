import { NextResponse } from "next/server";
import { getRecentRequests, getStats } from "../../../lib/store";
import { AVAILABLE_MODELS } from "../../../lib/providers";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    stats: getStats(),
    requests: getRecentRequests(),
    models: AVAILABLE_MODELS,
  });
}
