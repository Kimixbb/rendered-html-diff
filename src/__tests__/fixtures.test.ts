import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mermaidFixturePaths = [
  "fixtures/app-flow-old.html",
  "fixtures/app-flow-new.html",
  "fixtures/q1-financial-report-before.html",
  "fixtures/q1-financial-report-after.html"
];

test("Mermaid source fixtures load the direct-render helper", () => {
  for (const fixturePath of mermaidFixturePaths) {
    const html = readFileSync(fixturePath, "utf8");

    assert.match(html, /class="[^"]*\bmermaid\b/);
    assert.match(
      html,
      /<script src="mermaid-source-render\.js"><\/script>/,
      `${fixturePath} should render Mermaid when opened directly`
    );
  }
});

test("Mermaid source render helper preserves diff-report source collection", () => {
  const helper = readFileSync("fixtures/mermaid-source-render.js", "utf8");

  assert.match(helper, /window\.__rhdBridgeConfig/);
  assert.match(helper, /pre\.mermaid, code\.language-mermaid/);
  assert.match(helper, /mermaid\.render/);
  assert.match(helper, /data-rhd-graphic-source/);
});

test("Mermaid guide tells agents how to render source HTML safely", () => {
  const guide = readFileSync("docs/mermaid-graph-reference.md", "utf8");

  assert.match(guide, /mermaid-source-render\.js/);
  assert.match(guide, /window\.__rhdBridgeConfig/);
  assert.match(guide, /https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@11/);
  assert.match(guide, /data-diff-kind="graphic"/);
});
