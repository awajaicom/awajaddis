# Awaj Outreach

All-in-one outreach engine for Awaj ET: **cold email sequences, lead magnets, domain warm-up, and transactional email** — on a single domain, built with **Next.js 16, React Email, Resend, and Appwrite Cloud**.

## What's inside

| Area | What it does |
|---|---|
| Cold outreach | 4-step sequence (intro → follow-up → value offer → breakup), enrollment engine, per-campaign daily limits |
| Lead magnet | Public `subscribe` endpoint for your site forms: instant delivery email + optional nurture sequence |
| Warm-up | Daily volume ramp (10 → 200/day by default) that caps all outreach until your domain reputation is built |
| Transactional | `welcome` and `receipt` templates behind an authenticated API you call from your existing app |
| Deliverability | Suppression list, bounce/complaint auto-stop via Resend webhooks, RFC 8058 one-click unsubscribe, `List-Unsubscribe` headers |
| Dashboard | Contacts (+ CSV import), campaigns, sequence builder, warm-up monitor, send log with open/bounce rates |

## Setup (15 minutes)

1. **Install**
   ```bash
   npm install
   cp .env.example .env   # fill in every var
   ```

2. **Resend**
   - Add and verify your domain (Resend → Domains). Use the root domain you'll send from.
   - Create an API key → `RESEND_API_KEY`.
   - Create a webhook → `https://YOUR_APP/api/webhooks/resend`, subscribe to `delivered, opened, clicked, bounced, complained` → copy signing secret to `RESEND_WEBHOOK_SECRET`.

3. **Appwrite Cloud**
   - Create a project, then an API key with `databases.*` and `storage.*` scopes.
   - Fill `APPWRITE_*` and `NEXT_PUBLIC_APPWRITE_*` vars, then run:
   ```bash
   npm run setup:appwrite   # creates database + 8 collections + indexes + attachments bucket
   ```
   Compose-tab attachments upload from the **browser directly to Appwrite Storage** (sidestepping Vercel's 4.5 MB request cap), so the endpoint/project ID are also needed as `NEXT_PUBLIC_` vars. The bucket is write-only for anonymous users — only the server API key can read/delete — and files are deleted immediately after the email sends.

4. **Run**
   ```bash
   npm run dev        # dashboard at http://localhost:3000
   npm run email:dev  # React Email preview at http://localhost:3001
   ```

5. **Deploy to Vercel**, then set up scheduling via GitHub Actions (below). Vercel Cron is **not** used — the Hobby plan only allows daily runs, so `.github/workflows/outreach-cron.yml` drives both cron endpoints instead.

## Scheduling with GitHub Actions

The workflow at `.github/workflows/outreach-cron.yml` calls your deployed app on a schedule:

| Schedule (UTC) | Endpoint | Purpose |
|---|---|---|
| every 15 min | `/api/cron/process-sequences` | send due sequence steps |
| daily 06:00 | `/api/cron/warmup` | advance the warm-up ramp |

**Setup (one time):**

1. Push this project to a GitHub repository (the workflow only runs from the **default branch**).
2. In the repo → **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `APP_URL` — your deployed base URL, no trailing slash (e.g. `https://outreach.awajet.com`)
   - `CRON_SECRET` — the exact same value as the `CRON_SECRET` env var in Vercel
3. That's it — scheduled runs start automatically once the workflow file is on the default branch.

**Testing it manually:** repo → **Actions** tab → *Outreach cron* → **Run workflow** → pick `process-sequences` or `warmup` → Run. Open the run's log; a healthy call prints something like `Result: {"processed":3,"sent":3,...}`. A `401` means the secrets don't match; connection errors usually mean `APP_URL` is wrong.

**Adjusting the cadence:** edit the `cron:` lines in the workflow. Important: the `if:` condition on each job matches the schedule string **exactly**, so if you change `*/15 * * * *` to e.g. `0 * * * *` (hourly), update it in **both** places (the `schedule:` block and the job's `if:`). Cron times are UTC — Ethiopia is UTC+3, so `0 6 * * *` runs at 9:00 AM in Addis Ababa.

**Good to know about GitHub scheduled workflows:**

- Runs can be delayed 3–15 minutes under load; that's fine for email sequences.
- GitHub **disables schedules after 60 days without repo activity** — you'll get an email; any commit (or clicking "Enable" in the Actions tab) re-enables them. An occasional commit keeps it alive.
- Free tier includes 2,000 Actions minutes/month for private repos; these jobs use a few seconds per run (~100 min/month at the 15-min cadence), and public repos are unlimited.
- Don't also add crons to `vercel.json` — the endpoints would fire twice.

## Deliverability: do this BEFORE sending anything

One domain for everything is workable **if** you separate identities and protect reputation:

- `abu@domain` → cold outreach (FROM_COLD)
- `hello@domain` → lead magnet + nurture (FROM_MARKETING)
- `no-reply@domain` → transactional (FROM_TRANSACTIONAL)

DNS records (Resend shows exact values when you verify the domain):

1. **SPF** — TXT on the sending subdomain Resend gives you (e.g. `send.domain`): `v=spf1 include:amazonses.com ~all`
2. **DKIM** — the three CNAME/TXT records from Resend's domain page.
3. **DMARC** — TXT at `_dmarc.domain`: start with `v=DMARC1; p=none; rua=mailto:dmarc@domain`, tighten to `p=quarantine` after 2–4 clean weeks.

Then start the warm-up from the dashboard. First two weeks: send mostly to inboxes that will open/reply. Keep bounce rate < 3% — the webhook auto-suppresses bounces and complaints and stops their sequences.

## Typical workflow

1. **Contacts** → import CSV (`email,firstName,lastName,company,tags`), tag them (e.g. `retail-addis`).
2. **Sequences** → build a sequence from the template registry (subjects support `{{firstName}}` / `{{company}}`).
3. **Campaigns** → create a campaign pointing at the sequence, set a daily limit, **Activate**, then enroll by tag.
4. The 15-min cron does the rest, respecting: campaign daily limit → warm-up budget → suppression list.
5. **When someone replies, stop their sequence** — call `stopOnReply(email)` (exported from `src/lib/sequence-engine.ts`) or set the enrollment status to `replied`. Resend webhooks don't include replies; wire your inbox via Gmail API/IMAP if you want this automated.

## Integrating with your existing Next.js app

Two options:

**A. Deploy standalone on a subdomain** (recommended: `outreach.yourdomain.com`) and call its APIs:

```ts
// From your existing app — send a transactional email
await fetch("https://outreach.yourdomain.com/api/send/transactional", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OUTREACH_SECRET}`, // = CRON_SECRET
  },
  body: JSON.stringify({
    to: user.email,
    templateKey: "welcome",           // or "receipt"
    vars: { firstName: user.name },
  }),
});
```

```ts
// Lead-magnet form handler on your marketing site (public, no auth)
await fetch("https://outreach.yourdomain.com/api/lead-magnet/subscribe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email, firstName,
    resourceName: "SME Marketing Playbook",
    downloadUrl: "https://yourdomain.com/downloads/playbook.pdf",
    nurtureCampaignId: "…", // optional: auto-enroll in nurture
  }),
});
```

**B. Merge into your app** — copy `src/lib`, `src/emails`, and `src/app/api` into your project, add the deps (`resend`, `@react-email/components`, `node-appwrite`, `svix`), and mount the dashboard pages wherever you like (they're standard App Router server components; add your own auth around the `(dashboard)` group).

## Dashboard auth

The app is protected by a shared password and a signed cookie, enforced by Next.js middleware (`src/middleware.ts`) — no database, no auth library.

- Set two env vars: `DASHBOARD_PASSWORD` (what you type at `/login`) and `AUTH_SECRET` (signs the session cookie — generate with `openssl rand -hex 32`).
- On sign-in, an HMAC-SHA256-signed, HttpOnly, Secure cookie valid for 30 days is set. The middleware verifies it on every request; pages redirect to `/login`, API routes get a JSON 401.
- Routes with their own protection stay outside the gate: crons + transactional send (Bearer `CRON_SECRET`), the Resend webhook (svix signature), and the public unsubscribe + lead-magnet endpoints.
- Sign out from the sidebar. To revoke all sessions at once (e.g. a device is lost), rotate `AUTH_SECRET`; to just change the password, rotate `DASHBOARD_PASSWORD` (existing cookies stay valid until they expire — rotate both to force re-login).
- **Machine access:** every gated API route also accepts `Authorization: Bearer <CRON_SECRET>`, so your existing app or scripts can call `/api/contacts`, `/api/campaigns`, `/api/sequences`, `/api/send/manual`, and `/api/warmup` without a browser session:

  ```bash
  curl -X POST https://your-app/api/send/manual \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"to":"client@example.com","templateKey":"welcome","vars":{"firstName":"Sara"}}'
  ```

## Brand assets

- Dashboard uses `public/logo.svg` (already included) with the brand palette (Solar Gold `#F0A93B`, Deep Amber `#C97D1E`, Ink Navy `#12121C`, Visor Charcoal `#2B2B33`, Mist `#F7F3EC`) and fonts (Space Grotesk display / Inter body / JetBrains Mono captions) — defined as Tailwind tokens in `src/app/globals.css`.
- **Emails need a PNG**: export the logo as `public/logo.png` (~72×72 px, transparent background). Email clients (Gmail, Outlook) don't render SVG, so branded emails reference `{APP_URL}/logo.png`.
- Cold outreach templates are deliberately unbranded (no logo/colors) — they read as a personal note, which protects reply rates and deliverability. Lead magnet, nurture, and transactional emails carry the full branded header/footer.

## Extending

- **New template**: add a `.tsx` in `src/emails/…`, register it in `src/emails/registry.ts` — it immediately appears in the sequence builder.
- **Warm-up tuning**: `WARMUP_START_VOLUME`, `WARMUP_GROWTH_RATE`, `WARMUP_MAX_DAILY`.
- **Compliance**: cold email must include your real identity and honor opt-outs (the breakup step + suppression list handle this). Only email businesses with a legitimate reason to hear from you.

## Project map

```
src/
  lib/            appwrite.ts (client+types) · send.ts (central sender) ·
                  warmup.ts (ramp) · sequence-engine.ts (cron worker) · env.ts
  emails/         registry.ts + cold/ lead-magnet/ transactional/ warmup/ templates
  app/api/        cron/ contacts/ campaigns/ sequences/ send/transactional/
                  lead-magnet/subscribe/ webhooks/resend/ unsubscribe/ warmup/
  app/(dashboard) overview · contacts · campaigns · sequences · warmup
scripts/          setup-appwrite.ts (creates collections)
```
