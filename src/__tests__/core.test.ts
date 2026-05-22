import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  diffBlocks,
  diffLines,
  diffWords,
  extractBlocksFromHtml,
  sanitizeHtml
} from "../core.js";

test("extracts keyed semantic blocks from HTML", () => {
  const blocks = extractBlocksFromHtml(`
    <article>
      <h1 data-diff-key="title">Implementation Report</h1>
      <p data-diff-key="summary">Added workspace cleanup validation.</p>
      <pre data-diff-key="guard-code"><code>if (!safe) throw new Error();</code></pre>
      <script>window.__bad = true;</script>
    </article>
  `);

  assert.deepEqual(
    blocks.map((block) => block.diffKey),
    ["title", "summary", "guard-code"]
  );
  assert.equal(blocks[1]?.kind, "paragraph");
  assert.equal(blocks[2]?.kind, "code");
});

test("extracts keyed graphic blocks as one semantic block", () => {
  const blocks = extractBlocksFromHtml(`
    <article>
      <h2 data-diff-key="flow-heading">App Flow</h2>
      <pre class="mermaid" data-diff-key="runtime-flow" data-diff-kind="graphic">
        flowchart LR
          report[Report] --> parser[DOMParser]
          parser --> viewer[Rendered viewer]
      </pre>
      <div data-diff-key="nested-graphic" data-diff-kind="graphic">
        <p>This nested label should stay inside the graphic block.</p>
      </div>
    </article>
  `);

  assert.deepEqual(
    blocks.map((block) => [block.diffKey, block.kind]),
    [
      ["flow-heading", "heading"],
      ["runtime-flow", "graphic"],
      ["nested-graphic", "graphic"]
    ]
  );
});

test("matches stable keys and classifies added, changed, removed, and unchanged blocks", () => {
  const before = extractBlocksFromHtml(`
    <h1 data-diff-key="title">Implementation Report</h1>
    <p data-diff-key="summary">Added basic cleanup.</p>
    <p data-diff-key="risk">Path validation is still pending.</p>
    <li data-diff-key="old-next-step">Add tests later.</li>
  `);
  const after = extractBlocksFromHtml(`
    <h1 data-diff-key="title">Implementation Report</h1>
    <p data-diff-key="summary">Added workspace cleanup validation.</p>
    <p data-diff-key="risk">Path validation is still pending.</p>
    <li data-diff-key="new-next-step">Document Windows path behavior.</li>
  `);

  const entries = diffBlocks(before, after);
  const statuses = new Map(entries.map((entry) => [entry.identity, entry.status]));

  assert.equal(statuses.get("key:title"), "unchanged");
  assert.equal(statuses.get("key:summary"), "changed");
  assert.equal(statuses.get("key:risk"), "unchanged");
  assert.equal(statuses.get("key:new-next-step"), "added");
  assert.equal(statuses.get("key:old-next-step"), "removed");
});

test("performs inline word diff for prose blocks", () => {
  const segments = diffWords(
    "Added basic cleanup.",
    "Added workspace cleanup validation."
  );

  assert(segments.some((segment) => segment.type === "removed" && segment.value.includes("basic")));
  assert(segments.some((segment) => segment.type === "added" && segment.value.includes("workspace")));
  assert(segments.some((segment) => segment.type === "added" && segment.value.includes("validation")));
});

test("performs line diff for code blocks", () => {
  const segments = diffLines(
    "const safe = false;\ncleanup(path);",
    "const safe = validatePath(path);\ncleanup(path);"
  );

  assert(segments.some((segment) => segment.type === "removed" && segment.value.includes("false")));
  assert(segments.some((segment) => segment.type === "added" && segment.value.includes("validatePath")));
  assert(segments.some((segment) => segment.type === "same" && segment.value.includes("cleanup(path);")));
});

test("sanitizes executable HTML before report embedding", () => {
  const sanitized = sanitizeHtml(`
    <p onclick="window.bad = true">Hello</p>
    <a href="javascript:alert(1)">Bad link</a>
    <script>window.bad = true;</script>
    <iframe src="https://example.com"></iframe>
  `);

  assert(!sanitized.includes("<script"));
  assert(!sanitized.includes("onclick"));
  assert(!sanitized.includes("javascript:"));
  assert(!sanitized.includes("<iframe"));
});

test("template editor flow fixtures keep visible semantic blocks keyed", () => {
  const beforeHtml = readFileSync("fixtures/template-editor-flow-before.html", "utf8");
  const afterHtml = readFileSync("fixtures/template-editor-flow-after.html", "utf8");
  const beforeBlocks = extractBlocksFromHtml(beforeHtml);
  const afterBlocks = extractBlocksFromHtml(afterHtml);

  // Visible fixture text should carry stable keys. The OCR behavior now lives in
  // runnable app scripts, which the interactive report preserves separately.
  assert(beforeBlocks.every((block) => block.diffKey));
  assert(afterBlocks.every((block) => block.diffKey));

  const changedEntries = diffBlocks(beforeBlocks, afterBlocks).filter(
    (entry) => entry.status !== "unchanged"
  );

  assert.deepEqual(changedEntries, []);
  assert(beforeHtml.includes('return ["Scan result: Check harness label"'));
  assert(afterHtml.includes('return ["Check harness label"'));
});

test("Q1 financial report chart fixtures cover data and chart type changes", () => {
  const beforeHtml = readFileSync("fixtures/q1-financial-report-before.html", "utf8");
  const afterHtml = readFileSync("fixtures/q1-financial-report-after.html", "utf8");
  const beforeBlocks = extractBlocksFromHtml(beforeHtml);
  const afterBlocks = extractBlocksFromHtml(afterHtml);

  // Stable keys make chart rewrites compare as changed visual blocks instead
  // of unrelated additions and removals.
  assert(beforeBlocks.every((block) => block.diffKey));
  assert(afterBlocks.every((block) => block.diffKey));

  const entriesByIdentity = new Map(
    diffBlocks(beforeBlocks, afterBlocks).map((entry) => [entry.identity, entry])
  );
  const changedGraphicCount = [...entriesByIdentity.values()].filter(
    (entry) => entry.kind === "graphic" && entry.status === "changed"
  ).length;

  assert(changedGraphicCount >= 7);
  assert.equal(entriesByIdentity.get("key:chart-revenue-by-segment")?.status, "changed");
  assert.equal(entriesByIdentity.get("key:chart-monthly-revenue")?.status, "changed");
  assert.equal(entriesByIdentity.get("key:chart-expense-mix")?.status, "changed");
  assert.equal(entriesByIdentity.get("key:chart-cash-waterfall")?.status, "changed");
  assert.equal(entriesByIdentity.get("key:chart-operating-flow")?.status, "changed");
  assert.equal(entriesByIdentity.get("key:chart-liquidity-runway")?.status, "added");
  assert.equal(entriesByIdentity.get("key:chart-legacy-forecast-risk")?.status, "removed");
  assert(beforeHtml.includes("Operating Expense Mix Pie Chart"));
  assert(afterHtml.includes("Operating Expense Mix Bar Chart"));
});

test("Q1 financial report chart fixtures keep SVG labels compact", () => {
  const fixturePaths = [
    "fixtures/q1-financial-report-before.html",
    "fixtures/q1-financial-report-after.html"
  ];

  for (const fixturePath of fixturePaths) {
    const html = readFileSync(fixturePath, "utf8");
    const chartLabelPattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
    let match: RegExpExecArray | null;

    while ((match = chartLabelPattern.exec(html)) !== null) {
      const attrs = match[1] ?? "";
      const rawText = match[2] ?? "";
      const className = attrs.match(/\bclass="([^"]*)"/)?.[1] ?? "";

      if (!/\b(axis|label|value)\b/.test(className)) {
        continue;
      }

      // Chart labels sit inside small plotted areas. Keeping them compact
      // prevents the fixture from becoming a text-layout test by accident.
      const label = rawText
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

      assert(label.length <= 16, `${fixturePath} has an overlong chart label: ${label}`);
    }
  }
});

test("Q1 financial report after fixture keeps tight chart labels clear of marks", () => {
  const afterHtml = readFileSync("fixtures/q1-financial-report-after.html", "utf8");
  const scatterChart = extractFixtureGraphic(afterHtml, "chart-regional-scatter");
  const circles = [...scatterChart.matchAll(/<circle\b([^>]*)>/gi)].map((match) => {
    const attrs = match[1] ?? "";

    return {
      cx: numericSvgAttr(attrs, "cx"),
      cy: numericSvgAttr(attrs, "cy"),
      r: numericSvgAttr(attrs, "r")
    };
  });

  const scatterLabels = [...scatterChart.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)]
    .map((match) => ({
      attrs: match[1] ?? "",
      label: (match[2] ?? "").replace(/\s+/g, " ").trim()
    }))
    .filter(({ attrs }) => /\bclass="(?:value|label)"/.test(attrs));

  for (const { attrs, label } of scatterLabels) {
    const x = numericSvgAttr(attrs, "x");
    const y = numericSvgAttr(attrs, "y");

    for (const circle of circles) {
      const distanceFromCenter = Math.hypot(x - circle.cx, y - circle.cy);

      assert(
        distanceFromCenter > circle.r + 6,
        `Bubble label "${label}" is too close to a marker`
      );
    }
  }

  const waterfallChart = extractFixtureGraphic(afterHtml, "chart-cash-waterfall");
  const subtitleMatch = waterfallChart.match(/<text\b([^>]*)class="chart-subtitle"([^>]*)>/i);
  assert(subtitleMatch);
  const subtitleY = numericSvgAttr(`${subtitleMatch[1] ?? ""} ${subtitleMatch[2] ?? ""}`, "y");

  for (const match of waterfallChart.matchAll(/<text\b([^>]*)class="value"([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const attrs = `${match[1] ?? ""} ${match[2] ?? ""}`;
    const label = (match[3] ?? "").replace(/\s+/g, " ").trim();

    assert(
      numericSvgAttr(attrs, "y") >= subtitleY + 24,
      `Waterfall value "${label}" is too close to the subtitle`
    );
  }
});

function extractFixtureGraphic(html: string, diffKey: string): string {
  const pattern = new RegExp(
    `<figure\\b(?=[^>]*\\bdata-diff-key="${diffKey}")[^>]*>([\\s\\S]*?)<\\/figure>`,
    "i"
  );
  const match = html.match(pattern);

  assert(match, `Missing fixture graphic ${diffKey}`);
  return match[1] ?? "";
}

function numericSvgAttr(attrs: string, name: string): number {
  const match = attrs.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`));

  assert(match, `Missing numeric SVG attribute ${name}`);
  return Number(match[1]);
}
