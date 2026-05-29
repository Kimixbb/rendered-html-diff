import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadReportInput, parseArgs } from "../cli.js";

test("parseArgs keeps the explicit before and after file style", () => {
  assert.deepEqual(
    parseArgs(["before.html", "after.html", "--out", "dist/diff.html"]),
    {
      input: {
        kind: "file-pair",
        beforePath: "before.html",
        afterPath: "after.html"
      },
      outPath: "dist/diff.html"
    }
  );
});

test("parseArgs accepts one HTML file for a Git-based diff", () => {
  assert.deepEqual(parseArgs(["page.html", "--out", "dist/diff.html"]), {
    input: {
      kind: "git-file",
      filePath: "page.html"
    },
    outPath: "dist/diff.html"
  });
});

test("loadReportInput reads Git HEAD as before and the working tree as after", async () => {
  const workspace = mkdtempSync(path.join(tmpdir(), "rhd-cli-git-"));
  const pagePath = path.join(workspace, "reports", "page.html");

  mkdirSync(path.dirname(pagePath), { recursive: true });
  runGit(workspace, "init");
  runGit(workspace, "config", "user.email", "test@example.com");
  runGit(workspace, "config", "user.name", "Rendered HTML Diff Test");

  writeFileSync(
    pagePath,
    "<h1 data-diff-key=\"title\">Before report</h1>",
    "utf8"
  );
  runGit(workspace, "add", "reports/page.html");
  runGit(workspace, "commit", "-m", "Add before report fixture");

  writeFileSync(
    pagePath,
    "<h1 data-diff-key=\"title\">After report</h1>",
    "utf8"
  );

  const input = await loadReportInput(
    {
      kind: "git-file",
      filePath: "reports/page.html"
    },
    workspace
  );

  assert.match(input.beforeHtml, /Before report/);
  assert.match(input.afterHtml, /After report/);
  assert.equal(input.beforePath, "reports/page.html (HEAD)");
  assert.equal(input.afterPath, "reports/page.html");
});

test("one-file CLI mode renders a rich software change report from mocked Git changes", () => {
  const workspace = mkdtempSync(path.join(tmpdir(), "rhd-cli-software-report-"));
  const reportFileName = "software-delivery-change-report.html";
  const reportPath = path.join(workspace, reportFileName);
  const outputPath = path.join(workspace, "software-delivery-diff.html");
  const cliPath = fileURLToPath(new URL("../cli.js", import.meta.url));

  runGit(workspace, "init");
  runGit(workspace, "config", "user.email", "test@example.com");
  runGit(workspace, "config", "user.name", "Rendered HTML Diff Test");
  writeFileSync(
    path.join(workspace, "mermaid-source-render.js"),
    readFileSync("fixtures/mermaid-source-render.js", "utf8"),
    "utf8"
  );

  // This file is the Git baseline. The CLI should read it through
  // `git show HEAD:<path>` when it builds the before side of the report.
  writeFileSync(reportPath, softwareDeliveryReportBeforeHtml(), "utf8");
  runGit(workspace, "add", reportFileName);
  runGit(workspace, "commit", "-m", "Add software delivery baseline report");

  // This rewrite simulates the working tree after a software delivery change.
  // It keeps the same file path so the one-argument CLI can compare Git HEAD
  // with the current file.
  writeFileSync(reportPath, softwareDeliveryReportAfterHtml(), "utf8");

  const stdout = execFileSync(
    process.execPath,
    [cliPath, reportFileName, "--out", outputPath],
    {
      cwd: workspace,
      encoding: "utf8"
    }
  );
  const report = readFileSync(outputPath, "utf8");
  const payload = extractReportPayload(report);

  assert.match(stdout, /Rendered HTML diff written to/);
  assert.equal(payload.beforePath, `${reportFileName} (HEAD)`);
  assert.equal(payload.afterPath, reportFileName);

  assert.match(payload.beforeHtml, /Manual QA Sign-off/);
  assert.match(payload.afterHtml, /Automated Preview Gate/);
  assert.match(payload.beforeHtml, /function publishRelease\(channel\)/);
  assert.match(payload.afterHtml, /async function publishRelease\(channel\)/);
  assert.match(payload.beforeHtml, /Deploy window/);
  assert.match(payload.afterHtml, /Preview confidence/);
  assert.match(payload.beforeHtml, /Lead time baseline/);
  assert.match(payload.afterHtml, /Lead time after automation/);

  assert.match(payload.afterHtml, /<table/);
  assert.match(payload.afterHtml, /<svg/);
  assert.match(payload.afterHtml, /<pre class="mermaid"/);
  assert.match(payload.afterHtml, /<script src="mermaid-source-render\.js"><\/script>/);
  assert.match(payload.afterHtml, /data-diff-kind="graphic"/);
});

function runGit(cwd: string, ...args: string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore"
  });
}

function extractReportPayload(report: string): {
  beforeHtml: string;
  afterHtml: string;
  beforePath: string;
  afterPath: string;
} {
  const dataMatch = report.match(/<script id="rhd-data" type="application\/json">([\s\S]*?)<\/script>/);

  assert(dataMatch, "report should embed its before and after HTML payload");
  return JSON.parse(
    dataMatch[1]!
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&")
  ) as {
    beforeHtml: string;
    afterHtml: string;
    beforePath: string;
    afterPath: string;
  };
}

function softwareDeliveryReportBeforeHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Software Delivery Change Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
    section { margin-block: 28px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    pre { background: #f8fafc; padding: 14px; overflow: auto; }
    .chart-card { border: 1px solid #cbd5e1; padding: 12px; }
  </style>
</head>
<body>
  <main>
    <h1 data-diff-key="report-title">Software Delivery Change Report</h1>
    <p data-diff-key="summary">The release dashboard still relies on a Manual QA Sign-off before deploys can move from staging to production.</p>

    <section data-diff-key="workflow-section">
      <h2 data-diff-key="workflow-heading">Workflow</h2>
      <pre class="mermaid" data-diff-key="release-gate-flow" data-diff-kind="graphic">flowchart LR
  A["Merge request"] --> B["Build package"]
  B --> C["Manual QA Sign-off"]
  C --> D["Deploy window"]
  D --> E["Production release"]</pre>
    </section>

    <section data-diff-key="code-section">
      <h2 data-diff-key="code-heading">Release Function</h2>
      <pre data-diff-key="release-code"><code>function publishRelease(channel) {
  const approved = qaChecklist.isSigned();
  if (!approved) {
    throw new Error("Manual approval required");
  }
  return deploy(channel);
}</code></pre>
    </section>

    <section data-diff-key="table-section">
      <h2 data-diff-key="table-heading">Operational Data</h2>
      <table>
        <thead>
          <tr data-diff-key="metrics-head"><th>Metric</th><th>Before automation</th><th>Owner</th></tr>
        </thead>
        <tbody>
          <tr data-diff-key="metric-lead-time"><td>Lead time baseline</td><td>3 days</td><td>Release manager</td></tr>
          <tr data-diff-key="metric-failure-rate"><td>Rollback rate</td><td>7%</td><td>Platform team</td></tr>
          <tr data-diff-key="metric-approval"><td>Approval wait</td><td>18 hours</td><td>QA lead</td></tr>
        </tbody>
      </table>
    </section>

    <section data-diff-key="chart-section">
      <h2 data-diff-key="chart-heading">Delivery Metrics Chart</h2>
      <figure class="chart-card" data-diff-key="delivery-chart" data-diff-kind="graphic">
        <svg viewBox="0 0 360 180" role="img" aria-label="Delivery metrics before automation">
          <text class="chart-title" x="18" y="24">Lead time baseline</text>
          <rect x="40" y="70" width="70" height="82" fill="#94a3b8"></rect>
          <rect x="145" y="102" width="70" height="50" fill="#94a3b8"></rect>
          <rect x="250" y="118" width="70" height="34" fill="#94a3b8"></rect>
          <text class="label" x="44" y="166">Lead</text>
          <text class="label" x="144" y="166">Rollback</text>
          <text class="label" x="254" y="166">Approval</text>
          <text class="value" x="50" y="62">3d</text>
          <text class="value" x="166" y="94">7%</text>
          <text class="value" x="264" y="110">18h</text>
        </svg>
      </figure>
    </section>
  </main>
  <script src="mermaid-source-render.js"></script>
</body>
</html>`;
}

function softwareDeliveryReportAfterHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Software Delivery Change Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
    section { margin-block: 28px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    pre { background: #f8fafc; padding: 14px; overflow: auto; }
    .chart-card { border: 1px solid #cbd5e1; padding: 12px; }
  </style>
</head>
<body>
  <main>
    <h1 data-diff-key="report-title">Software Delivery Change Report</h1>
    <p data-diff-key="summary">The release dashboard now uses an Automated Preview Gate before canary deploys promote from staging to production.</p>

    <section data-diff-key="workflow-section">
      <h2 data-diff-key="workflow-heading">Workflow</h2>
      <pre class="mermaid" data-diff-key="release-gate-flow" data-diff-kind="graphic">flowchart LR
  A["Merge request"] --> B["Build package"]
  B --> C["Automated Preview Gate"]
  C --> D["Canary rollout"]
  D --> E["Production release"]
  C --> F["Preview confidence"]</pre>
    </section>

    <section data-diff-key="code-section">
      <h2 data-diff-key="code-heading">Release Function</h2>
      <pre data-diff-key="release-code"><code>async function publishRelease(channel) {
  const preview = await previewGate.measure(channel);
  if (preview.confidence < 0.98) {
    throw new Error("Preview confidence is below threshold");
  }
  return deployCanary(channel, preview.traceId);
}</code></pre>
    </section>

    <section data-diff-key="table-section">
      <h2 data-diff-key="table-heading">Operational Data</h2>
      <table>
        <thead>
          <tr data-diff-key="metrics-head"><th>Metric</th><th>After automation</th><th>Owner</th></tr>
        </thead>
        <tbody>
          <tr data-diff-key="metric-lead-time"><td>Lead time after automation</td><td>9 hours</td><td>Platform team</td></tr>
          <tr data-diff-key="metric-failure-rate"><td>Rollback rate</td><td>2%</td><td>Platform team</td></tr>
          <tr data-diff-key="metric-approval"><td>Approval wait</td><td>25 minutes</td><td>Release bot</td></tr>
        </tbody>
      </table>
    </section>

    <section data-diff-key="chart-section">
      <h2 data-diff-key="chart-heading">Delivery Metrics Chart</h2>
      <figure class="chart-card" data-diff-key="delivery-chart" data-diff-kind="graphic">
        <svg viewBox="0 0 360 180" role="img" aria-label="Delivery metrics after automation">
          <text class="chart-title" x="18" y="24">Lead time after automation</text>
          <rect x="40" y="118" width="70" height="34" fill="#22c55e"></rect>
          <rect x="145" y="132" width="70" height="20" fill="#22c55e"></rect>
          <rect x="250" y="144" width="70" height="8" fill="#22c55e"></rect>
          <text class="label" x="44" y="166">Lead</text>
          <text class="label" x="144" y="166">Rollback</text>
          <text class="label" x="254" y="166">Approval</text>
          <text class="value" x="49" y="110">9h</text>
          <text class="value" x="166" y="124">2%</text>
          <text class="value" x="264" y="136">25m</text>
        </svg>
      </figure>
    </section>
  </main>
  <script src="mermaid-source-render.js"></script>
</body>
</html>`;
}
