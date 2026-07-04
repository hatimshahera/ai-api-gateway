import { NextResponse } from "next/server";
import { runGatewayRequest } from "../../../lib/gateway";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const response = await runGatewayRequest(body);
    return NextResponse.json(response, { status: response.success ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gateway request failed." },
      { status: 400 },
    );
  }
}
