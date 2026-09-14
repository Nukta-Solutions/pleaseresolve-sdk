// Self-contained E2E test against a real local pleaseresolve-backend:
// provisions its own public API key, serves a generated copy of demo/
// (never mutates the checked-in template), drives it with a real headless
// Chrome, verifies both the DOM and that reports actually land in the
// database, then cleans up everything it created.
//
// Prereqs: local backend running on :5000 (docker compose up in
// pleaseresolve-backend), `npm run build` already run here, `execSync`
// requires `google-chrome` at /usr/bin/google-chrome and `mongosh` inside
// the backend's `mongo` container (both already true in this dev setup).
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const API_BASE = "http://localhost:5000/api/v1";
const DEMO_PORT = 8123;
const DEMO_ORIGIN = `http://localhost:${DEMO_PORT}`;
const MONGO_EXEC =
  "docker compose -f /home/saikat/workspace/nukta/pleaseresolve/pleaseresolve-backend/docker-compose.yml exec -T mongo mongosh --quiet please_resolve --eval";

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body)}`);
  return body.data;
}

function mongoEval(script) {
  return execSync(`${MONGO_EXEC} '${script.replace(/'/g, "'\\''")}'`, {
    encoding: "utf8",
  });
}

async function provision() {
  const { token: adminToken } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "owner0@seed.pleaseresolve.dev",
      password: "SeedPass123!",
    }),
  });
  const me = await api("/auth/me", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const orgId = me.user.organizationId;
  const projects = await api(`/organizations/${orgId}/projects?limit=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const projectId = projects[0]._id;

  const keyResult = await api(`/organizations/${orgId}/api-keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "e2e-test-widget-key",
      keyType: "public",
      allowedProjects: [projectId],
      allowedOrigins: [DEMO_ORIGIN],
    }),
  });

  return {
    adminToken,
    orgId,
    projectId,
    apiKeyId: keyResult.apiKey._id,
    rawKey: keyResult.rawKey,
  };
}

async function cleanup({ apiKeyId }) {
  // Order matters: collect the ids *before* deleting the reports they point
  // at, not in the same pass — querying `reports` after it's already empty
  // finds nothing to clean up in `report_activities`.
  mongoEval(
    `const ids = db.reports.find({title: /^E2E:/}).toArray().map(r => r._id); ` +
      `print(JSON.stringify(db.report_activities.deleteMany({reportId: {$in: ids}}))); ` +
      `print(JSON.stringify(db.report_attachments.deleteMany({reportId: {$in: ids}}))); ` +
      `print(JSON.stringify(db.reports.deleteMany({_id: {$in: ids}})));`,
  );
  // The S3 object itself (a few KB test screenshot) is deliberately left in
  // place — deleting it needs the same S3FileService the backend uses, not
  // worth wiring up here for a throwaway test file in report-attachments/.
  // The dashboard API only revokes (`isRevoked: true`), it never hard-deletes
  // — correct for a real customer's audit trail, but this key exists only
  // for this test run, so remove the row entirely rather than leave a
  // revoked-but-persistent synthetic key in the database on every run.
  mongoEval(`print(JSON.stringify(db.api_keys.deleteMany({_id: ObjectId("${apiKeyId}")})));`);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".map": "application/json" };

function serveStatic(fixtureHtml) {
  return createServer(async (req, res) => {
    try {
      if (req.url === "/demo/index.html" || req.url === "/demo/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(fixtureHtml);
      }
      const filePath = join(ROOT, decodeURIComponent(req.url.split("?")[0]));
      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
}

async function run() {
  const ctx = await provision();
  console.log("Provisioned public key:", ctx.rawKey.slice(0, 15) + "...");

  const template = await readFile(join(ROOT, "demo/index.html"), "utf8");
  const fixtureHtml = template
    .replace("pk_live_your_public_key_here", ctx.rawKey)
    .replace("your_project_id_here", ctx.projectId)
    .replace(
      '<script\n      src="../dist/widget.global.js"',
      `<script\n      src="../dist/widget.global.js"\n      data-api-base-url="${API_BASE}"`,
    );

  const server = serveStatic(fixtureHtml);
  await new Promise((resolve) => server.listen(DEMO_PORT, resolve));

  const consoleErrors = [];
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + err.message));

    await page.goto(`${DEMO_ORIGIN}/demo/index.html`, { waitUntil: "networkidle0" });

    const triggerVisible = await page.evaluate(() => {
      const host = document.querySelector("[data-pleaseresolve-widget]");
      const trigger = host?.shadowRoot?.querySelector(".pr-trigger");
      if (!trigger) return false;
      const rect = trigger.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    console.log("1. Trigger button rendered:", triggerVisible);

    await page.evaluate(() => {
      document
        .querySelector("[data-pleaseresolve-widget]")
        .shadowRoot.querySelector(".pr-trigger")
        .click();
    });
    // `open()` now awaits screenshot capture (CDN fetch + html2canvas
    // render) *before* the form itself renders — see widget.ts — so this
    // has to wait for the actual form fields, not a fixed timeout.
    await page.waitForFunction(
      () =>
        !!document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector('input[id^="pr-title-"]'),
      { timeout: 8000 },
    );
    console.log("2. Form opened on click (after screenshot capture): true");

    const screenshotState = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const checkbox = root.querySelector(".pr-checkbox-label input");
      const preview = root.querySelector(".pr-screenshot-preview");
      return {
        html2canvasLoadedGlobally: !!window.html2canvas,
        checkboxPresent: !!checkbox,
        checkboxChecked: checkbox?.checked,
        previewImagePresent: !!preview,
        previewSrcIsBlob: preview?.src?.startsWith("blob:"),
      };
    });
    console.log("2b. Screenshot capture pipeline:", screenshotState);

    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const set = (sel, value) => {
        const el = root.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set('input[id^="pr-title-"]', "E2E: checkout button unresponsive");
      set('textarea[id^="pr-description-"]', "Automated E2E test submission.");
      set('input[id^="pr-name-"]', "Jane Doe");
      set('input[id^="pr-email-"]', "jane@client-site.example");
      // Screenshot checkbox left checked (default) — submitting with it on.
      root.querySelector("form").requestSubmit();
    });

    await page.waitForFunction(
      () =>
        !!document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector(".pr-success-title"),
      { timeout: 5000 },
    );
    console.log("3. Submission succeeded, success UI shown");

    await page.evaluate(() =>
      window.PleaseResolve.identify({ name: "Headless Tester", email: "headless@test.example" }),
    );
    const reportResult = await page.evaluate(() =>
      window.PleaseResolve.report({ title: "E2E: programmatic report", priority: "urgent" }),
    );
    console.log("4. Programmatic report() result:", reportResult);

    const dbCheck = mongoEval(
      `db.reports.find({title: /^E2E:/}).forEach(r => print(r.title + " | source=" + r.source + " | reporter=" + JSON.stringify(r.externalMeta.publicWidget.reporter)))`,
    );
    console.log("5. Verified in database:\n" + dbCheck.trim());

    const attachmentCheck = mongoEval(
      `const r = db.reports.findOne({title: "E2E: checkout button unresponsive"}); ` +
        `const a = db.report_attachments.findOne({reportId: r._id}); ` +
        `print(a ? ("attachment: " + a.mimeType + ", " + a.size + " bytes, " + a.url) : "NO ATTACHMENT FOUND");`,
    );
    console.log("6. Screenshot attachment on the report:\n" + attachmentCheck.trim());
    const s3Url = attachmentCheck.match(/https:\/\/\S+/)?.[0];
    if (s3Url) {
      const s3Check = await fetch(s3Url);
      console.log(`7. Screenshot actually retrievable from S3: ${s3Check.status}`);
    }

    if (consoleErrors.length) {
      console.log("\nConsole errors (favicon 404 is expected/harmless):", consoleErrors);
    }
  } finally {
    await browser.close();
    server.close();
    await cleanup(ctx);
    console.log("\nCleaned up test key + test reports.");
  }
}

run().catch((err) => {
  console.error("E2E TEST FAILED:", err);
  process.exit(1);
});
