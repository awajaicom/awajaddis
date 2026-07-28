import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, verifyPassword } from "@/lib/auth";

/** Retired hostnames — the app now lives on mail.awajaddis.com. */
const OLD_HOSTS = new Set(["awajaddis.com", "www.awajaddis.com"]);

/** Routes with their own auth (or none) — bypass the session-cookie gate. */
const PUBLIC_PATHS =
  /^\/(login|unsubscribed|api\/auth\/login|api\/cron|api\/webhooks|api\/inbound|api\/unsubscribe|api\/lead-magnet|api\/send\/transactional)(\/|$)/;

/**
 * Gate everything behind the signed session cookie EXCEPT routes that have
 * their own auth or must stay public:
 *   /login, /api/auth/login       — the door itself
 *   /api/cron/*                   — Bearer CRON_SECRET
 *   /api/send/transactional       — Bearer CRON_SECRET
 *   /api/webhooks/*, /api/inbound — svix signature
 *   /api/unsubscribe, /unsubscribed, /api/lead-magnet/* — public by design
 *   /_next/*, favicon, logo files — static assets (excluded via matcher)
 */
export async function middleware(req: NextRequest) {
  if (OLD_HOSTS.has(req.nextUrl.hostname)) {
    return NextResponse.redirect("https://www.awajet.com", 308);
  }

  if (PUBLIC_PATHS.test(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
  // Previously-public paths (login, api/cron, api/inbound, etc.) are now
  // matched too, since the old-domain redirect above must apply to them —
  // PUBLIC_PATHS re-implements the same bypass inside the function body.
  // Static assets stay excluded; there's no reason to redirect fetching them.
  matcher: ["/((?!_next|favicon\\.ico|logo\\.svg|logo\\.png).*)"],
};
