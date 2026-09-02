/**
 * Cached AfroMessage balance, for the SMS dashboard banner. Stays behind
 * the normal cookie-auth middleware — called only from inside the app.
 */
import { NextResponse } from "next/server";
import { getSmsBalance } from "@/lib/sms/afromessage";

export async function GET() {
  const result = await getSmsBalance();
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }
  return NextResponse.json(result.data);
}
