# @pleaseresolve/sdk

Embeddable issue-reporting widget for Please Resolve. Phase 2 of
`CLIENT_INTEGRATIONS_PLAN.md` (see that doc in `pleaseresolve-backend` for the
full picture) — this package is the shared core; the script tag is its only
real distribution so far, npm publishing is Phase 3.

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
import { init, open, report, identify, setMetadata } from "@pleaseresolve/sdk";
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
```

Every `report()` call (form or programmatic) auto-attaches `context`
(current URL, user agent, viewport) — see `src/context.ts`. Screenshot and
console-error capture are Phase 3, not built yet.

## Build

```sh
npm install
npm run build     # dist/sdk.{js,cjs,d.ts} (npm-style, Phase 3) + dist/widget.global.js (the actual script-tag file)
npm run typecheck
```

`dist/widget.global.js` is what a CDN would serve — self-contained IIFE,
~10KB minified, well under the plan's 30KB budget.

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
`context`, then deletes everything it created.

`demo/index.html` is also the manual/visual demo — open it in a real browser
after substituting real `data-key`/`data-project` values (or just look at
what `test-e2e.mjs` generates) to click through it yourself.
