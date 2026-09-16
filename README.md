# @pleaseresolve/sdk

[![npm version](https://img.shields.io/npm/v/%40pleaseresolve%2Fsdk.svg)](https://www.npmjs.com/package/@pleaseresolve/sdk)
[![npm downloads](https://img.shields.io/npm/dm/%40pleaseresolve%2Fsdk.svg)](https://www.npmjs.com/package/@pleaseresolve/sdk)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pleaseresolve%2Fsdk)](https://bundlephobia.com/package/@pleaseresolve/sdk)
[![license](https://img.shields.io/badge/license-proprietary-red.svg)](./LICENSE)

**Drop-in issue reporting for any website.** Paste one script tag or `npm install` one package,
and your visitors can report a bug — with an optional attachment, browser context, and priority —
straight into your [Please Resolve](https://pleaseresolve.nukta.solutions) dashboard. No backend
code, no account required on the visitor's side.

```html
<script src="https://nukta-solutions.github.io/pleaseresolve-sdk/widget.js" data-key="pk_live_..." data-project="..."></script>
```

![Support widget preview](docs/preview.png)

## Contents

- [Features](#features)
- [Install](#install)
  - [Script tag](#script-tag)
  - [npm, zero config](#npm-zero-config)
  - [npm, explicit config](#npm-explicit-config)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Security model](#security-model)
- [Development](#development)

## Features

- **Zero-friction reporting** — a floating Support button, a short form, done. No account, no
  login, no app to install.
- **Two ways to see it live**: a self-updating **script tag** for any site, or this **npm
  package** for a bundled app — same widget either way.
- **Zero-config npm install** — set two env vars, `import "@pleaseresolve/sdk/auto"`, and the
  widget mounts itself. No `init()` call required in your code.
- **Drag-and-drop attachments** — the built-in form has a real attachment dropzone (images and
  common file types), matching llemr's own report form exactly.
- **"Issues"** — a table of every report for the project (not just what one browser submitted),
  with search, refresh, and a detail view — a 1:1 clone of llemr's real admin Issues page.
- **First-class TypeScript** — types ship from the same source as the runtime code.
- **[React bindings](https://github.com/Nukta-Solutions/pleaseresolve-sdk-react)** available as a
  separate `@pleaseresolve/react` package.

## Install

Get a `public`-type API key first: Settings → API Keys → Create API Key in your Please Resolve
dashboard, `keyType: public`, with the site(s) you're embedding on listed in `allowedOrigins`. A
`public` key is locked server-side to creating reports only — it's meant to be embedded in a page
anyone can view; see [Security model](#security-model).

### Script tag

```html
<script
  src="https://nukta-solutions.github.io/pleaseresolve-sdk/widget.js"
  data-key="pk_live_..."
  data-project="..."
></script>
```

Paste before `</body>`. `data-project` can be omitted if the key is scoped to exactly one project.
Full reference: [Phase 2 guide](docs/PHASE_2_SCRIPT_TAG_GUIDE.md).

### npm, zero config

```sh
npm install @pleaseresolve/sdk
```

```sh
# .env
NEXT_PUBLIC_PLEASERESOLVE_KEY=pk_live_...
NEXT_PUBLIC_PLEASERESOLVE_PROJECT_ID=...   # optional — only if your key covers more than one project
```

```ts
// anywhere in your app's entry point
import "@pleaseresolve/sdk/auto";
```

That's the whole integration. The widget reads those env vars at *your app's own build time* and
mounts itself — no `init()` call anywhere in your code. This works because a real bundler
(Next.js, Create React App) is what inlines `NEXT_PUBLIC_...`/`REACT_APP_...` env vars into the
bundle; see [`src/env.ts`](src/env.ts) for exactly which prefixes are supported and why. Using
React? [`@pleaseresolve/react`](https://github.com/Nukta-Solutions/pleaseresolve-sdk-react)'s
`<ReportWidget />` reads the same env vars with zero props.

### npm, explicit config

Prefer to call `init()` yourself — explicit values, conditional mounting, a config source other
than env vars? Skip `@pleaseresolve/sdk/auto` and use the [API reference](#api-reference) below
instead. The two approaches aren't meant to be combined.

## How it works

Clicking the floating **Support** button opens a small menu:

- **New Issue** — a short form (title, description, priority, and an optional attachment) that
  submits straight to your dashboard.
- **View Issues** — a table of every report submitted for the project through this widget, with
  search, a Refresh button, and a detail view (matching llemr's real Issues page exactly, not
  scoped to just the current browser — see [Security model](#security-model) for what that means).

Every submission also auto-attaches context (current URL, browser, viewport) with zero
configuration.

## API reference

```ts
import { init, open, close, report, identify, setMetadata, destroy } from "@pleaseresolve/sdk";
// or, from the script tag: window.PleaseResolve.init(...)

init({ key: "pk_live_...", projectId: "...", widget: true });

// Headless mode — drive it from your own trigger button:
init({ key: "pk_live_...", widget: false });
myOwnButton.addEventListener("click", () => open());

// Skip the UI entirely:
await report({ title: "...", description: "...", priority: "high" });

// Pre-fill identity on every subsequent report:
identify({ name: "...", email: "..." });
setMetadata({ plan: "pro" });

// Tear down (React's <ReportWidget /> calls this on unmount):
destroy();
```

| Function | What it does |
|---|---|
| `init(options)` | Mounts the widget. `key` is required; `projectId` and `apiBaseUrl` are optional. |
| `open()` / `close()` | Opens/closes the built-in form — for a custom trigger button (`widget: false`). |
| `report(input)` | Submits directly, no UI. Never attaches files (only the form's dropzone can). |
| `identify(reporter)` | Pre-fills identity (name/email) attached to every later `report()` call. |
| `setMetadata(obj)` | Merged into every report's `metadata` from this point on. |
| `destroy()` | Unmounts the widget and clears all state. |

"View Issues" is backed by `GET /api/v1/public/reports` (list) and `GET /api/v1/public/reports/:id`
(the Action column's "View"). Both never return comments, internal developer/implementation notes,
assignees, or the reporter's email — see
[pleaseresolve-backend's `public-report.service.ts`](https://github.com/Nukta-Solutions/pleaseresolve-backend/blob/saikat/src/modules/public-report/public-report.service.ts)
for the exact reasoning behind every field that is or isn't included.

## Security model

Two API key types exist for a reason:

| | `public` | `server` |
|---|---|---|
| Where it's used | Script tag, npm bundle — anyone can read it from the page | Your own backend, CI, webhooks |
| Permissions | `report:create` + `report:read` only, forced server-side | Whatever you grant it |
| Origin check | Restricted to `allowedOrigins` you configure | None — no browser involved |

**Never put a `server`-type key in a web page.** It's not restricted the way a `public` key is.
See the [Phase 1 API guide](https://github.com/Nukta-Solutions/pleaseresolve-backend/blob/saikat/docs/PHASE_1_PUBLIC_API_GUIDE.md#security)
for the full rationale.

**"View Issues" lists every report for the project, not just the current visitor's own.** Since a
`public` key is readable from the page's own source, this means anyone who can view your page can
read every report ever submitted through this widget for that project — titles, descriptions,
attachments, and any reporter name given. This was a deliberate trade-off to match a real,
organization-facing Issues table rather than a private per-visitor one; if that's not the right
model for your use case, don't embed this widget on a page with reports you'd consider sensitive
to visitors other than the one who filed them.

## Development

```sh
npm install
npm run build      # dist/sdk.{js,cjs,d.ts}, dist/auto.{js,cjs}, dist/widget.global.js
npm run typecheck
```

Three live end-to-end test suites (no mocking — a real local backend, real S3 uploads, real headless
Chrome):

```sh
node test-e2e.mjs        # the full widget UI: menu, form, attachments, View Issues, detail modal
node test-auto-init.mjs  # @pleaseresolve/sdk/auto specifically — bundles a throwaway app with
                          # esbuild --define (the same substitution Next.js/CRA perform) and
                          # confirms it mounts and submits with zero init() calls anywhere
node test-live-cdn.mjs   # loads the actual hosted script tag from GitHub Pages (not a local
                          # dist/ build) and confirms a real submission through it — rerun this
                          # after any redeploy to catch "the CDN is serving something wrong"
                          # separately from "the local build is wrong"
```

All three require a local `pleaseresolve-backend` running on `:5000` (`docker compose up` there);
`test-live-cdn.mjs` additionally needs network access to `nukta-solutions.github.io`.
`demo/index.html` is also the manual/visual demo — open it after substituting real
`data-key`/`data-project` values.

See the sibling [`pleaseresolve-sdk-react`](https://github.com/Nukta-Solutions/pleaseresolve-sdk-react)
repo for React bindings, and [`GOING_LIVE.md`](../GOING_LIVE.md) in this workspace for the
CDN-hosting and npm-publishing runbook.

## License

**Proprietary — not open source.** This package is publicly installable so Please Resolve
clients can `npm install` it and audit exactly what they're embedding, but it may only be used to
integrate with the Please Resolve platform under an active Please Resolve account. See
[LICENSE](./LICENSE) for the full terms — no rights to copy, modify, redistribute, or reuse this
SDK independently of the Service are granted.
