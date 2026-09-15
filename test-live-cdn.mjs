// Verifies the actual hosted script tag — https://nukta-solutions.github.io/pleaseresolve-sdk/widget.js
// — not a local dist/ build. Loads a real HTML page over HTTP with a
// <script src="https://..."> pointed at the live GitHub Pages URL, drives it
// with real headless Chrome, and confirms a submission through it actually
// reaches the local backend. Doesn't touch dist/ or npm run build at all —
// this is specifically catching "the thing GitHub Pages is serving is wrong"
// class of bugs that a local-build test can never catch.
//
// Prereqs: local backend running on :5000, network access to
// nukta-solutions.github.io.
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import puppeteer from "puppeteer-core";

const API_BASE = "http://localhost:5000/api/v1";
const LIVE_WIDGET_URL = "https://nukta-solutions.github.io/pleaseresolve-sdk/widget.js";
const PORT = 8124;
const ORIGIN = `http://localhost:${PORT}`;
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
  return execSync(`${MONGO_EXEC} '${script.replace(/'/g, "'\\''")}'`, { encoding: "utf8" });
}

async function provision() {
  const { token: adminToken } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner0@seed.pleaseresolve.dev", password: "SeedPass123!" }),
  });
  const me = await api("/auth/me", { headers: { Authorization: `Bearer ${adminToken}` } });
  const orgId = me.user.organizationId;
  const projects = await api(`/organizations/${orgId}/projects?limit=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const projectId = projects[0]._id;

  const keyResult = await api(`/organizations/${orgId}/api-keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "live-cdn-check-key",
      keyType: "public",
      allowedProjects: [projectId],
      allowedOrigins: [ORIGIN],
    }),
  });

  return { orgId, projectId, apiKeyId: keyResult.apiKey._id, rawKey: keyResult.rawKey };
}

async function cleanup({ apiKeyId }) {
  mongoEval(
    `const ids = db.reports.find({title: /^LIVE-CDN-CHECK:/}).toArray().map(r => r._id); ` +
      `print(JSON.stringify(db.report_activities.deleteMany({reportId: {$in: ids}}))); ` +
      `print(JSON.stringify(db.reports.deleteMany({_id: {$in: ids}})));`,
  );
  mongoEval(`print(JSON.stringify(db.api_keys.deleteMany({_id: ObjectId("${apiKeyId}")})));`);
}

function pageHtml(rawKey, projectId) {
  return `<!doctype html>
<html><body>
<script
  src="${LIVE_WIDGET_URL}"
  data-key="${rawKey}"
  data-project="${projectId}"
  data-api-base-url="${API_BASE}"
></script>
</body></html>`;
}

async function run() {
  const ctx = await provision();
  console.log("Provisioned public key:", ctx.rawKey.slice(0, 15) + "...");
  console.log("Loading widget from live URL:", LIVE_WIDGET_URL);

  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(pageHtml(ctx.rawKey, ctx.projectId));
  });
  await new Promise((resolve) => server.listen(PORT, resolve));

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

    await page.goto(ORIGIN, { waitUntil: "networkidle0", timeout: 15000 });

    const triggerVisible = await page.evaluate(() => {
      const host = document.querySelector("[data-pleaseresolve-widget]");
      const trigger = host?.shadowRoot?.querySelector(".pr-trigger");
      if (!trigger) return false;
      const rect = trigger.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    console.log("1. Script loaded from GitHub Pages, Support button rendered:", triggerVisible);
    if (!triggerVisible) throw new Error("Trigger button never rendered from the live script");

    const reportResult = await page.evaluate((title) => window.PleaseResolve.report({ title, priority: "high" }), "LIVE-CDN-CHECK: submitted via the hosted widget.js");
    console.log("2. Real submission through the live-hosted script:", reportResult);

    const dbCheck = mongoEval(
      `db.reports.find({title: /^LIVE-CDN-CHECK:/}).forEach(r => print(r.title + " | source=" + r.source))`,
    );
    console.log("3. Verified in database:\n" + dbCheck.trim());
    if (!dbCheck.includes("LIVE-CDN-CHECK:")) throw new Error("Report never reached the database");

    if (consoleErrors.length) {
      console.log("\nConsole errors (favicon 404 is expected/harmless):", consoleErrors);
    }
    console.log("\nLIVE CDN CHECK PASSED — the hosted widget.js genuinely works end-to-end.");
  } finally {
    await browser.close();
    server.close();
    await cleanup(ctx);
    console.log("Cleaned up test key + test reports.");
  }
}

run().catch((err) => {
  console.error("LIVE CDN CHECK FAILED:", err);
  process.exit(1);
});
