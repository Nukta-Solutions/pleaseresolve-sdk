// Proves the actual claim: "install the package, set env vars, nothing
// else" — no explicit init() call anywhere in the test app's own code.
// Simulates exactly what a consumer's Next.js/CRA build does with
// `NEXT_PUBLIC_PLEASERESOLVE_KEY` — esbuild's `--define` does the identical
// literal `process.env.EXACT_NAME` text substitution Next.js's webpack
// config performs, so bundling this way is a faithful stand-in for "a real
// app's build pipeline processed this package", not a shortcut around it.
import { execSync, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const API_BASE = "http://localhost:5000/api/v1";
const PORT = 8125;
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
  const { token } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner0@seed.pleaseresolve.dev", password: "SeedPass123!" }),
  });
  const me = await api("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  const orgId = me.user.organizationId;
  const projects = await api(`/organizations/${orgId}/projects?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projectId = projects[0]._id;
  const keyResult = await api(`/organizations/${orgId}/api-keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "e2e-auto-init-test-key",
      keyType: "public",
      allowedProjects: [projectId],
      allowedOrigins: [ORIGIN],
    }),
  });
  return { orgId, projectId, apiKeyId: keyResult.apiKey._id, rawKey: keyResult.rawKey };
}

async function cleanup({ apiKeyId }) {
  mongoEval(
    `const ids = db.reports.find({title: /^AUTO-INIT-E2E:/}).toArray().map(r => r._id); ` +
      `print(JSON.stringify(db.report_activities.deleteMany({reportId: {$in: ids}}))); ` +
      `print(JSON.stringify(db.reports.deleteMany({_id: {$in: ids}})));`,
  );
  mongoEval(`print(JSON.stringify(db.api_keys.deleteMany({_id: ObjectId("${apiKeyId}")})));`);
}

async function run() {
  const ctx = await provision();
  console.log("Provisioned public key:", ctx.rawKey.slice(0, 15) + "...");

  // The "app entry point" — deliberately contains NO reference to `init`,
  // `key`, or `projectId` at all. If this test passes, that's the proof.
  const entryPath = join(ROOT, ".auto-init-test-entry.mjs");
  await writeFile(
    entryPath,
    `import "${join(ROOT, "dist/auto.js")}";\n`,
  );

  const bundlePath = join(ROOT, ".auto-init-test-bundle.js");
  try {
    // execFileSync, not execSync — no shell involved, so the JSON-quoted
    // --define values (esbuild requires a JS string literal, i.e.
    // "\"actual value\"") reach esbuild exactly as written instead of
    // getting their quotes stripped by an intermediate `/bin/sh -c`.
    execFileSync(
      "node_modules/.bin/esbuild",
      [
        entryPath,
        "--bundle",
        "--format=iife",
        "--platform=browser",
        `--outfile=${bundlePath}`,
        `--define:process.env.NEXT_PUBLIC_PLEASERESOLVE_KEY=${JSON.stringify(ctx.rawKey)}`,
        `--define:process.env.NEXT_PUBLIC_PLEASERESOLVE_PROJECT_ID=${JSON.stringify(ctx.projectId)}`,
        `--define:process.env.NEXT_PUBLIC_PLEASERESOLVE_API_BASE_URL=${JSON.stringify(API_BASE)}`,
      ],
      { cwd: ROOT, stdio: "inherit" },
    );
    console.log("Bundled the test app with esbuild (Next.js-equivalent env substitution).");

    const bundleSrc = await readFile(bundlePath, "utf8");
    const hasNoInitCall = !/\binit\s*\(\s*\{/.test(
      await readFile(entryPath, "utf8"),
    );
    console.log("1. Test app's own source has zero init() calls:", hasNoInitCall);
    const keyBaked = bundleSrc.includes(ctx.rawKey);
    console.log("2. Env var substitution actually happened (key baked into bundle):", keyBaked);

    const pageHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script src="/bundle.js"></script>
</body></html>`;

    const server = createServer(async (req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(pageHtml);
      }
      if (req.url === "/bundle.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        return res.end(bundleSrc);
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => server.listen(PORT, resolve));

    const consoleMessages = [];
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
      page.on("pageerror", (err) => consoleMessages.push("PAGEERROR: " + err.message));

      await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

      const triggerAppeared = await page.evaluate(() => {
        const host = document.querySelector("[data-pleaseresolve-widget]");
        const trigger = host?.shadowRoot?.querySelector(".pr-trigger");
        if (!trigger) return false;
        const rect = trigger.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      console.log(
        "3. Widget mounted itself with zero init() calls in app code:",
        triggerAppeared,
      );

      await page.evaluate(() => {
        document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector(".pr-trigger")
          .click();
      });
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

      await page.evaluate(() => {
        const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
        const titleInput = root.querySelector('input[id^="pr-title-"]');
        titleInput.value = "AUTO-INIT-E2E: real submission through the auto-init path";
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
        root.querySelector("form").requestSubmit();
      });
      await page.waitForFunction(
        () =>
          !!document
            .querySelector("[data-pleaseresolve-widget]")
            .shadowRoot.querySelector(".pr-success-title"),
        { timeout: 5000 },
      );
      console.log("4. Real submission through the auto-mounted widget succeeded");

      const dbCheck = mongoEval(
        `db.reports.findOne({title: /^AUTO-INIT-E2E:/}, {title: 1, source: 1});`,
      );
      console.log("5. Verified in database:\n" + dbCheck.trim());

      const errors = consoleMessages.filter(
        (m) => m.startsWith("[error]") && !m.includes("404"),
      );
      if (errors.length) console.log("\nUnexpected console errors:", errors);
    } finally {
      await browser.close();
      server.close();
    }
  } finally {
    await rm(entryPath, { force: true });
    await rm(bundlePath, { force: true });
    await cleanup(ctx);
    console.log("\nCleaned up test key + test reports + scratch bundle files.");
  }
}

run().catch((err) => {
  console.error("AUTO-INIT E2E TEST FAILED:", err);
  process.exit(1);
});
