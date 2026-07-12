import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/demo/config";
import { executeQuery, executeRpc } from "@/lib/demo/engine";
import type { QueryState } from "@/lib/demo/shared";

export async function POST(request: Request) {
  if (!DEMO_MODE) {
    return NextResponse.json(
      { data: null, error: { message: "โหมดสาธิตปิดอยู่" } },
      { status: 403 }
    );
  }

  const body = await request.json();

  if (body.kind === "rpc") {
    const result = executeRpc(body.name as string, body.args);
    return NextResponse.json(result);
  }

  const result = executeQuery(body.state as QueryState);
  return NextResponse.json(result);
}
