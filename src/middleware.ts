import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, verifyPassword } from "@/lib/auth";

/**
 * Gate everything behind the signed session cookie EXCEPT routes that have
 * their own auth or must stay public:
 *   /login, /api/auth/login       — the door itself
 *   /api/cron/*                   — Bearer CRON_SECRET
 *   /api/send/transactional       — Bearer CRON_SECRET
 *   /api/webhooks/*               — svix signature
 *   /api/unsubscribe, /unsubscribed, /api/lead-magnet/* — public by design
 *   /_next/*, favicon, logo files — static assets
 */
export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (secret && token && (await verifySessionToken(token, secret))) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    // Machine access: API routes also accept `Authorization: Bearer <CRON_SECRET>`
    // so your existing app / scripts can call contacts, campaigns, sequences,
    // send/manual, and warmup without a browser session.
    const cronSecret = process.env.CRON_SECRET;
    const header = req.headers.get("authorization") ?? "";
    if (
      secret &&
      cronSecret &&
      header.startsWith("Bearer ") &&
      (await verifyPassword(header.slice(7), cronSecret, secret))
    ) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (req.nextUrl.pathname !== "/") {
    url.searchParams.set("from", req.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|unsubscribed|api/auth/login|api/cron|api/webhooks|api/unsubscribe|api/lead-magnet|api/send/transactional|_next|favicon\\.ico|logo\\.svg|logo\\.png).*)",
  ],
};
