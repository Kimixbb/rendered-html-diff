import assert from "node:assert/strict";
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
