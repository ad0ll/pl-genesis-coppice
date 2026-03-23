import { NextResponse } from "next/server";
import { fetchCDMData } from "@/lib/guardian-cdm-data";

export async function GET() {
  try {
    const data = await fetchCDMData();
    if (!data) {
      return NextResponse.json(
        { error: "CDM_GUARDIAN_POLICY_ID not configured" },
        { status: 503 },
      );
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("CDM Guardian API error:", message);
    return NextResponse.json(
      { error: "CDM Guardian API unavailable", detail: message },
      { status: 503 },
    );
  }
}
