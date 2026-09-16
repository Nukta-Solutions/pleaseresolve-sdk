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
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
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

    // The trigger now opens a small menu (New Issue / View Issues) instead
    // of jumping straight to the form — matches llemr's GlobalReportDropdown
    // pattern (see widget.ts's top-level doc comment).
    await page.evaluate(() => {
      document
        .querySelector("[data-pleaseresolve-widget]")
        .shadowRoot.querySelector(".pr-trigger")
        .click();
    });
    const menuState = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const menu = root.querySelector(".pr-menu");
      const items = [...root.querySelectorAll(".pr-menu-item span")].map((s) => s.textContent);
      return { menuVisible: menu && !menu.hidden, items };
    });
    console.log("2. Support menu opened on click:", menuState);

    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      root.querySelectorAll(".pr-menu-item")[0].click(); // "New Issue"
    });
    await page.waitForFunction(
      () =>
        !!document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector('input[id^="pr-title-"]'),
      { timeout: 8000 },
    );
    console.log("3. New Issue form opened from the menu: true");

    // Real file attachment via the dropzone's hidden <input type="file"> —
    // matches how a reporter clicking "browse" actually selects a file
    // (puppeteer's uploadFile() drives the same input the click-to-browse
    // path uses, see widget.ts's buildAttachmentField).
    const attachmentPath = join(ROOT, ".e2e-test-attachment.txt");
    await writeFile(attachmentPath, "E2E test attachment contents.");
    const fileInputHandle = await page.evaluateHandle(() =>
      document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector('input[type="file"]'),
    );
    await fileInputHandle.uploadFile(attachmentPath);
    await fileInputHandle.evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
    const fileListState = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const items = [...root.querySelectorAll(".pr-file-item .pr-file-name")].map((el) => el.textContent);
      return { fileListVisible: !root.querySelector(".pr-file-list").hidden, items };
    });
    console.log("3b. Attachment dropzone — file added:", fileListState);

    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const set = (sel, value) => {
        const el = root.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set('input[id^="pr-title-"]', "E2E: checkout button unresponsive");
      set('textarea[id^="pr-description-"]', "Automated E2E test submission.");
      root.querySelector("form").requestSubmit();
    });

    await page.waitForFunction(
      () =>
        !!document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector(".pr-success-title"),
      { timeout: 5000 },
    );
    console.log("4. Submission succeeded, success UI shown");

    await page.evaluate(() =>
      window.PleaseResolve.identify({ name: "Headless Tester", email: "headless@test.example" }),
    );
    const reportResult = await page.evaluate(() =>
      window.PleaseResolve.report({ title: "E2E: programmatic report", priority: "urgent" }),
    );
    console.log("5. Programmatic report() result:", reportResult);

    const dbCheck = mongoEval(
      `db.reports.find({title: /^E2E:/}).forEach(r => print(r.title + " | source=" + r.source + " | reporter=" + JSON.stringify(r.externalMeta.publicWidget.reporter)))`,
    );
    console.log("6. Verified in database:\n" + dbCheck.trim());

    const attachmentCheck = mongoEval(
      `const r = db.reports.findOne({title: "E2E: checkout button unresponsive"}); ` +
        `const a = db.report_attachments.findOne({reportId: r._id}); ` +
        `print(a ? ("attachment: " + a.mimeType + ", " + a.size + " bytes, " + a.url) : "NO ATTACHMENT FOUND");`,
    );
    console.log("7. Dropzone attachment on the report:\n" + attachmentCheck.trim());
    await rm(attachmentPath);
    const s3Url = attachmentCheck.match(/https:\/\/\S+/)?.[0];
    if (s3Url) {
      const s3Check = await fetch(s3Url);
      console.log(`8. Screenshot actually retrievable from S3: ${s3Check.status}`);
    }

    // "View Issues" — both reports just submitted (form + headless) should
    // be tracked locally (storage.ts) and show a live-fetched status. The
    // success overlay from step 4 is fixed/full-viewport until it
    // auto-closes (2.5s) and would otherwise sit on top of the trigger,
    // same class of issue found in pleaseresolve-sdk-react's own test.
    await page.waitForFunction(
      () =>
        document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelectorAll(
          ".pr-overlay",
        )[0].hidden,
      { timeout: 4000 },
    );
    await page.evaluate(() => {
      document
        .querySelector("[data-pleaseresolve-widget]")
        .shadowRoot.querySelector(".pr-trigger")
        .click();
    });
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      root.querySelectorAll(".pr-menu-item")[1].click(); // "View Issues"
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        const badges = [...root.querySelectorAll(".pr-badge")];
        return badges.length >= 4 && badges.every((b) => b.textContent !== "…");
      },
      { timeout: 6000 },
    );
    const issuesState = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      return [...root.querySelectorAll("tbody tr")].map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          reported: cells[0].textContent,
          title: cells[1].textContent,
          submittedBy: cells[2].textContent,
          priority: cells[3].textContent,
          status: cells[4].textContent,
          dueDate: cells[5].textContent,
        };
      });
    });
    console.log("9. View Issues table, tracked + live status:", issuesState);

    // Action column's View button — opens a real report-detail modal
    // (matching llemr's ReportDetailModal.tsx) over the Issues table, with
    // the report's description (the one extra field beyond the table
    // columns themselves; see public-report.service.ts's getById doc
    // comment for exactly what is/isn't exposed through this read).
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      root.querySelector("[data-view-id]").click();
    });
    const detailState = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const overlays = [...root.querySelectorAll(".pr-overlay")];
      const detailOverlay = overlays[overlays.length - 1];
      return {
        visible: !detailOverlay.hidden,
        title: detailOverlay.querySelector(".pr-title")?.textContent,
        description: detailOverlay.querySelector(".pr-detail-section-body, .pr-detail-section-empty")?.textContent,
      };
    });
    console.log("9b. Action 'View' detail modal:", detailState);
    // Closing it should reveal the Issues table underneath, not dismiss
    // the whole widget.
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const overlays = [...root.querySelectorAll(".pr-overlay")];
      overlays[overlays.length - 1].querySelector(".pr-close").click();
    });
    const afterClose = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const overlays = [...root.querySelectorAll(".pr-overlay")];
      return { detailHidden: overlays[overlays.length - 1].hidden, issuesStillOpen: !overlays[overlays.length - 2].hidden };
    });
    console.log("9c. After closing detail modal:", afterClose);

    // The other tracked row has a real attachment (step 3b/7 above) —
    // confirm its detail modal's Attachments section actually renders it,
    // not just the description.
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const row = [...root.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("checkout button unresponsive"));
      row.querySelector("[data-view-id]").click();
    });
    const attachmentDetail = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const overlays = [...root.querySelectorAll(".pr-overlay")];
      const detail = overlays[overlays.length - 1];
      const fileLink = detail.querySelector(".pr-attachment-file");
      return { fileName: fileLink?.querySelector(".pr-attachment-file-name")?.textContent, href: fileLink?.href };
    });
    console.log("9e. Attachments section on the row with a real upload:", attachmentDetail);

    // Search filter — client-side, over the same rows just rendered.
    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const input = root.querySelector(".pr-search-input");
      input.value = "programmatic";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const filteredState = await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      return [...root.querySelectorAll("tbody tr td.pr-table-title")].map((td) => td.textContent);
    });
    console.log("9d. Search filter ('programmatic'):", filteredState);

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
