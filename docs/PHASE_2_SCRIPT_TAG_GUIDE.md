# Phase 2 — Script Tag Widget

The zero-build way to let visitors on your website report an issue directly into your Please
Resolve dashboard. One `<script>` tag, no account needed on their end.

> Companion docs: [Phase 1 — Public API](../../pleaseresolve-backend/docs/PHASE_1_PUBLIC_API_GUIDE.md)
> (what this talks to under the hood) and
> [Phase 3 — npm Package & React](../../pleaseresolve-sdk-react/docs/PHASE_3_NPM_PACKAGE_GUIDE.md)
> (for a JS/TS build step, or a React app). Full engineering plan:
> `CLIENT_INTEGRATIONS_PLAN.md` in `pleaseresolve-backend`.

## Use cases

- **Marketing sites, docs sites, anything without a JS build step** — paste one line, done.
- **A "beta" or "feedback" build** of your product where you want a low-friction way for real
  users to flag problems, without wiring up a support form.
- **A quick trial** of Please Resolve on an existing site before committing to the npm package.

If you're already building your site with a bundler (Vite, webpack, Next.js) and want typed,
programmatic control, [Phase 3's npm package](../../pleaseresolve-sdk-react/docs/PHASE_3_NPM_PACKAGE_GUIDE.md)
is the better fit — it's the same widget, just imported instead of loaded from a CDN.

## Before you start: get a `public`-type API key

Settings → API Keys → Create API Key → `keyType: public`, scope `allowedProjects` to the
project(s) it should file into, and — this part matters — add your site's exact origin(s) to
`allowedOrigins` (e.g. `https://www.yoursite.com`). Requests from any other origin are rejected,
even with a valid key.

**This key is meant to be public.** Anyone who views your page source can read it. That's fine —
it's locked server-side to creating reports only (never reading, listing, or managing anything),
and restricted to the origins you list. Never use a `server`-type key here; see
[Phase 1's security section](../../pleaseresolve-backend/docs/PHASE_1_PUBLIC_API_GUIDE.md#security)
for why.

## Install

```html
<script
  src="https://nukta-solutions.github.io/pleaseresolve-sdk/widget.js"
  data-key="pk_live_..."
  data-project="..."
></script>
```

Paste that before `</body>`. That's the whole integration — a floating "Report an issue" button
appears in the bottom-right corner of every page it's on.

> **CDN not live yet.** The widget file (`dist/widget.global.js`) is built and tested but not yet
> hosted anywhere public — see the plan doc's open decisions. Until then, build it yourself
> (`npm run build` in `pleaseresolve-sdk/`) and host `dist/widget.global.js` wherever you like.

### `data-*` attributes

| Attribute | Required | Notes |
|---|---|---|
| `data-key` | **yes** | Your `public`-type API key. |
| `data-project` | only if your key covers more than one project | Omit if the key is scoped to exactly one project. |
| `data-api-base-url` | no | Override the API origin — only needed for local/staging testing. |
| `data-widget` | no | Set to `"false"` for headless mode: no floating button, you drive everything via `window.PleaseResolve` yourself. |

## What the reporter sees

1. They click the floating **Support** button, bottom-right of the page.
2. A small menu opens with two options:
   - **New Issue** — a short form: what happened (required), details, priority, their name/email
     (both optional), and — by default — a preview of a screenshot captured from the current page,
     with a checkbox to include or drop it. They see exactly what would be sent before anything is.
   - **View Issues** — a popup listing what *this browser* has already reported, each with a live
     status (New / In Progress / Resolved / etc.), fetched fresh every time it's opened. There's no
     login and no way to see anyone else's reports — it only ever shows what was submitted from
     this same browser.
3. On submit, it lands in your dashboard as a report, tagged with the URL, browser, and viewport it
   came from automatically.

## Headless mode — your own trigger

If you'd rather use your own "Report a problem" button instead of the floating one:

```html
<script src="https://nukta-solutions.github.io/pleaseresolve-sdk/widget.js" data-key="pk_live_..." data-widget="false"></script>
<button onclick="window.PleaseResolve.open()">Report a problem</button>
```

`window.PleaseResolve` also exposes `close()`, `report({ title, description, priority, metadata })`
for submitting without any UI at all, `identify({ name, email })` to pre-fill the form, and
`setMetadata({...})` to tag every report from this point on.

## Privacy notes for your visitors

- The screenshot capture is **opt-out per submission** — the reporter always sees a preview and a
  checkbox before it's sent, never sent silently.
- No cookies, local storage, or form field values from your page are ever captured — only what's
  visually on screen (for the screenshot) and the plain browser/URL/viewport info.
- Console-error capture doesn't exist yet (planned, opt-in only, later) — nothing beyond the above
  is collected today.

## Content-Security-Policy

If your site has a CSP, allow-list:
- `script-src`: the CDN the widget is hosted on.
- `connect-src`: the API origin it submits to (`https://pleaseresolve-api.nukta.solutions` by
  default).
- `img-src blob:`: the screenshot preview is rendered from a `blob:` URL.

This is the #1 thing that silently breaks an otherwise-correct integration — if the button appears
but submitting does nothing, check your CSP first.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Button doesn't appear at all | Script failed to load — check the `src` URL, and your CSP's `script-src`. |
| Button appears, but submitting silently fails | CSP blocking `connect-src` to the API, or the wrong `data-key`. Open dev tools' Network tab. |
| `403 Origin not allowed for this API key` (visible in Network tab) | Your site's exact origin isn't in the key's `allowedOrigins` in Settings → API Keys. |
| No screenshot preview / "Screenshot unavailable" | html2canvas failed to load (network issue, ad blocker) or failed to capture (an unusual page layout, cross-origin images). Submission still works without it. |
| Multiple floating buttons | The script tag is present more than once on the page, or a single-page-app is re-injecting it on every route change instead of once. |
| "View Issues" always shows "You haven't reported anything yet" | Expected the first time in a given browser — it only ever shows reports submitted from *that* browser (`localStorage`, not your account). Clearing site data, private/incognito windows, or a different browser will all show empty too. |
| "View Issues" shows a status but it's stuck on "…" | The status lookup (`GET /public/reports/:id`) failed — check the key still has `report:read` (Settings → API Keys) and hasn't been revoked. |
