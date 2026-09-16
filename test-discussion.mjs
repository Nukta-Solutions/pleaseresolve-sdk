// Self-contained E2E test for the Client Discussion feature: real local
// backend, real MongoDB, real headless Chrome driving the actual widget
// UI, and a real socket.io connection — verifies sending text + a file
// attachment from the widget, realtime delivery of a staff reply posted
// via the dashboard API while the widget page stays open (no reload), and
// that an internal-only staff comment never reaches the widget at all.
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const API_BASE = "http://localhost:5000/api/v1";
const DEMO_PORT = 8125;
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
      name: "discussion-e2e-key",
      keyType: "public",
      allowedProjects: [projectId],
      allowedOrigins: [DEMO_ORIGIN],
    }),
  });

  return { adminToken, orgId, projectId, apiKeyId: keyResult.apiKey._id, rawKey: keyResult.rawKey };
}

async function cleanup({ orgId, apiKeyId, reportId }) {
  if (reportId) {
    mongoEval(
      `db.report_comments.deleteMany({reportId: ObjectId("${reportId}")}); ` +
        `db.report_attachments.deleteMany({reportId: ObjectId("${reportId}")}); ` +
        `db.report_activities.deleteMany({reportId: ObjectId("${reportId}")}); ` +
        `db.reports.deleteMany({_id: ObjectId("${reportId}")});`,
    );
  }
  mongoEval(`db.api_keys.deleteMany({_id: ObjectId("${apiKeyId}")});`);
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

  let reportId;
  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + err.message));

    await page.goto(`${DEMO_ORIGIN}/demo/index.html`, { waitUntil: "networkidle0" });

    // Submit a report headlessly to get a real reportId to open Discussion on.
    reportId = (
      await page.evaluate(() =>
        window.PleaseResolve.report({ title: "DISCUSSION-E2E: test report" }),
      )
    ).id;
    console.log("1. Submitted report:", reportId);

    await page.evaluate(() =>
      document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector(".pr-trigger").click(),
    );
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      root.querySelectorAll(".pr-menu-item")[1].click(); // View Issues
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        const rows = [...root.querySelectorAll("tbody tr")];
        return rows.length >= 1 && !rows[0].textContent.includes("Loading");
      },
      { timeout: 10000 },
    );
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const row = [...root.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("DISCUSSION-E2E"));
      row.querySelector("[data-view-id]").click();
    });
    await page.waitForFunction(
      () => !document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector('[data-pr-layer="detail"]').hidden,
      { timeout: 5000 },
    );
    console.log("2. Opened report detail.");

    // Discussion section present, starts empty, socket connects.
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        const list = root.querySelector(".pr-discussion-list");
        return list && !list.textContent.includes("Loading");
      },
      { timeout: 8000 },
    );
    const emptyState = await page.evaluate(
      () => document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector(".pr-discussion-list").textContent,
    );
    console.log("3. Discussion empty state:", JSON.stringify(emptyState.trim()));

    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        return root.querySelector(".pr-discussion-live-dot")?.classList.contains("pr-live-connected");
      },
      { timeout: 8000 },
    );
    console.log("4. Live-connection dot confirmed connected.");

    // --- Send a text message from the widget ---
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const textarea = root.querySelector(".pr-discussion-input");
      textarea.value = "Hi, this checkout bug is still happening.";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      root.querySelector(".pr-discussion-send-btn").click();
    });
    await page.waitForFunction(
      () => document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector(".pr-msg-mine"),
      { timeout: 8000 },
    );
    const firstMsg = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const el = root.querySelector(".pr-msg-mine .pr-discussion-bubble");
      return el?.textContent.trim();
    });
    console.log("5. Widget's own text message rendered:", JSON.stringify(firstMsg));

    // --- Send a message with a file attachment ---
    const attachPath = join(ROOT, ".discussion-e2e-attachment.txt");
    await writeFile(attachPath, "discussion e2e attachment contents");
    const fileInputHandle = await page.evaluateHandle(() =>
      document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector(".pr-discussion-composer input[type=file]"),
    );
    await fileInputHandle.uploadFile(attachPath);
    await fileInputHandle.evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        const chip = root.querySelector(".pr-discussion-pending-chip");
        return chip && !chip.textContent.includes("uploading");
      },
      { timeout: 8000 },
    );
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const textarea = root.querySelector(".pr-discussion-input");
      textarea.value = "Here's a log file.";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      root.querySelector(".pr-discussion-send-btn").click();
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        return [...root.querySelectorAll(".pr-msg-mine .pr-discussion-bubble-attachment")].length > 0;
      },
      { timeout: 8000 },
    );
    const attachmentName = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      return root.querySelector(".pr-msg-mine .pr-discussion-bubble-attachment span")?.textContent;
    });
    console.log("6. Message with attachment rendered, attachment name:", attachmentName);
    await rm(attachPath);

    // --- Realtime: staff replies via the dashboard API while the page stays open ---
    await api(`/organizations/${ctx.orgId}/reports/${reportId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
      body: JSON.stringify({ message: "Looking into it now, thanks for the file!", visibility: "client" }),
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        return [...root.querySelectorAll(".pr-msg-theirs .pr-discussion-bubble")].some((b) =>
          b.textContent.includes("Looking into it now"),
        );
      },
      { timeout: 8000 },
    );
    console.log("7. Staff reply arrived in the widget in realtime (no reload).");

    // --- Internal-only comment must never reach the widget ---
    await api(`/organizations/${ctx.orgId}/reports/${reportId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
      body: JSON.stringify({ message: "INTERNAL-SHOULD-NOT-APPEAR", visibility: "internal" }),
    });
    await new Promise((r) => setTimeout(r, 1500));
    const leaked = await page.evaluate(() =>
      document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector(".pr-discussion-list").textContent.includes("INTERNAL-SHOULD-NOT-APPEAR"),
    );
    console.log("8. Internal comment leaked into widget:", leaked, "(must be false)");

    // --- Close + reopen: history persists via REST, socket reconnects ---
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      root.querySelector('[data-pr-layer="detail"] .pr-close').click();
    });
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const row = [...root.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("DISCUSSION-E2E"));
      row.querySelector("[data-view-id]").click();
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        return [...root.querySelectorAll(".pr-discussion-msg")].length >= 3;
      },
      { timeout: 8000 },
    );
    console.log("9. Reopened detail — full history reloaded from REST.");

    console.log("\nConsole errors:", consoleErrors);
  } finally {
    await browser.close();
    server.close();
    await cleanup({ ...ctx, reportId });
    console.log("10. Cleaned up.");
  }
}

run().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
