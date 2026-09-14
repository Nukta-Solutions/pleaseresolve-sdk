# @pleaseresolve/sdk

Embeddable issue-reporting widget for Please Resolve. Phases 2–3 of
`CLIENT_INTEGRATIONS_PLAN.md` (see that doc in `pleaseresolve-backend` for the
full picture) — this package is the shared core, consumed via the script tag,
the npm package itself, and `@pleaseresolve/react` (a sibling package).
Not actually published to npm yet — `"private": true` until someone decides
to make it public (§10 of the plan doc).

## What this is

A customer of Please Resolve pastes one `<script>` tag into their own
website. It shows a floating "Report an issue" button; their end users click
it, fill in a short form, and the report lands directly in that customer's
Please Resolve dashboard — no build step, no account on the customer's side.

## Quick start (script tag)

```html
<script
  src="https://cdn.pleaseresolve.app/widget.js"
  data-key="pk_live_..."
  data-project="..."
></script>
```

Get a `public`-type key from Settings → API Keys in the dashboard — it must
be `keyType: "public"` (locked server-side to `report:create` only) with the
embedding site's origin in `allowedOrigins`, or every request 403s. A
`server`-type key works everywhere but must never be pasted into a web page —
see `CLIENT_INTEGRATIONS_PLAN.md` §3.1 for why the two are not
interchangeable.

`data-project` can be omitted if the key is scoped to exactly one project.

## Programmatic API

```ts
import { init, open, close, report, identify, setMetadata, destroy } from "@pleaseresolve/sdk";
// or, from the script tag: window.PleaseResolve.init(...)

init({ key: "pk_live_...", projectId: "...", widget: true });

// Headless mode — your own trigger button:
init({ key: "pk_live_...", widget: false });
myOwnButton.addEventListener("click", () => open());

// Or skip the UI entirely:
await report({ title: "...", description: "...", priority: "high" });

// Pre-fill identity on every subsequent report:
identify({ name: "...", email: "..." });
setMetadata({ plan: "pro" });

// Tear down (React's <ReportWidget /> calls this on unmount):
destroy();
```

Every `report()` call (form or programmatic) auto-attaches `context`
(current URL, user agent, viewport) — see `src/context.ts`.

**Screenshot capture** (`init({ screenshot: true })`, the default): the
built-in form captures a screenshot via `html2canvas` as soon as it opens
and shows the reporter a preview with a checkbox to include or drop it,
checked by default — this is the consent point, so it's only ever wired up
for the form. Headless `report()` calls never auto-attach one, on purpose.
`html2canvas` (~200KB) is **not bundled** — it's fetched from a CDN
(cdnjs) the first time a screenshot is actually captured, which is what
keeps `dist/widget.global.js` itself small (see below). Console-error
capture is still not built (Phase 5, opt-in when it lands — see the plan
doc's privacy note on it).

## Build

```sh
npm install
npm run build     # dist/sdk.{js,cjs,d.ts} (npm-style, Phase 3) + dist/widget.global.js (the actual script-tag file)
npm run typecheck
```

`dist/widget.global.js` is what a CDN would serve — self-contained IIFE,
~12KB minified, well under the plan's 30KB budget (html2canvas stays out of
this number — see the screenshot note above for why).

See also the sibling `../pleaseresolve-sdk-react` package for React
bindings (`<ReportWidget />`, `useReportWidget()`), which depends on this
package's build output.

## Testing against a real backend

```sh
npm run build
node test-e2e.mjs
```

Requires a local `pleaseresolve-backend` running on `:5000`
(`docker compose up` there). The script is fully self-contained: it logs in
as the seeded `owner0@seed.pleaseresolve.dev` admin, provisions its own
temporary public API key, serves a generated copy of `demo/index.html` with
that key substituted in (the checked-in file itself keeps placeholder
values), drives it with a real headless Chrome (clicks the trigger, fills
and submits the form, exercises `identify()`/`report()`), verifies the
reports actually landed in MongoDB with the right `source`/`reporter`/
`context`, confirms html2canvas genuinely loaded from cdnjs and produced a
real screenshot, confirms that screenshot is retrievable back from S3 as an
actual attachment on the report, then deletes everything it created.

`demo/index.html` is also the manual/visual demo — open it in a real browser
after substituting real `data-key`/`data-project` values (or just look at
what `test-e2e.mjs` generates) to click through it yourself.
