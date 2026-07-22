import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, verifyPassword } from "@/lib/auth";

/** POST { password } → sets the signed session cookie. */
export async function POST(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD and AUTH_SECRET env vars must be set" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const submitted = String(body.password ?? "");

  if (!submitted || !(await verifyPassword(submitted, password, secret))) {
    // Slow down brute-force attempts.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
