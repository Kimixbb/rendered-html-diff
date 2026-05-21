import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderStandaloneReport } from "../report.js";

type CreateFrameHtml = (html: string, frameId: string) => string;

function extractCreateFrameHtml(report: string): CreateFrameHtml {
  const helperMatch = report.match(
    /  function createFrameHtml[\s\S]*?\n  async function renderMermaidBlocks/
  );

  assert(helperMatch, "report should include iframe HTML helpers");

  const helperSource = helperMatch[0]!.replace(/\n  async function renderMermaidBlocks$/, "");
  const buildHelper = new Function(
    "mermaidRuntime",
    "frameBridge",
    "frameToken",
    `${helperSource}; return createFrameHtml;`
  );

  return buildHelper(
    "window.__mermaidRuntimeTest = true;",
    "window.__bridgeRuntimeTest = true;",
    "test-token"
  ) as CreateFrameHtml;
}

function extractFrameBridge(report: string): string {
  const bridgeMatch = report.match(
    /<script id="rhd-frame-bridge" type="text\/plain">([\s\S]*?)<\/script>/
  );

  assert(bridgeMatch, "report should embed the iframe bridge as text");
  return bridgeMatch[1]!;
}

test("rendered report uses sandboxed interactive frames", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<h1 data-diff-key=\"title\">Before</h1>",
    afterHtml: "<h1 data-diff-key=\"title\">After</h1>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /<iframe id="rhd-before-preview"[^>]*sandbox="allow-scripts"/);
  assert.match(report, /<iframe id="rhd-preview"[^>]*sandbox="allow-scripts"/);
  assert.doesNotMatch(report, /sandbox="[^"]*allow-same-origin/);
  assert.match(report, /postMessage/);
  assert.match(report, /__renderedHtmlDiffBridge/);
  assert.match(report, /let lastDiff = null/);
  assert.match(report, /applyDiff\(lastDiff\.entries, lastDiff\.beforeBlocks, lastDiff\.afterBlocks\)/);
});

test("frame runtime is injected at the real document end, not visible source text", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"copy\">Before</p>",
    afterHtml: "<p data-diff-key=\"copy\">After</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const createFrameHtml = extractCreateFrameHtml(report);
  const sourceLikeHtml =
    "<!doctype html><html><body>" +
    "<pre data-diff-key=\"source\">literal </body> marker</pre>" +
    "<main data-diff-key=\"app\">Live app</main>" +
    "</body></html>";

  const frameHtml = createFrameHtml(sourceLikeHtml, "after");
  const injectionIndex = frameHtml.indexOf("<script>window.__mermaidRuntimeTest = true;");
  const appEndIndex = frameHtml.indexOf("</main>");

  assert.ok(injectionIndex > appEndIndex, "bridge scripts should be injected after the rendered app");
  assert.match(frameHtml, /literal <\/body> marker<\/pre>/);
});

test("frame bridge reports blocks only after startup and Mermaid rendering", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA-->B</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA-->C</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const startMatch = report.match(/  async function start\(\) \{([\s\S]*?)\n  \}/);

  assert(startMatch, "bridge should include a startup function");

  const startBody = startMatch[1]!;
  const startupOrder = [
    "injectHighlightStyles(document)",
    "await waitForLoad()",
    "await waitForReadyHook()",
    "await settleFrame()",
    "await renderMermaidBlocks(config.frameId)",
    "collectAndPostBlocks()"
  ];
  let lastIndex = -1;

  for (const step of startupOrder) {
    const nextIndex = startBody.indexOf(step);

    assert.ok(nextIndex > lastIndex, `${step} should happen after the previous startup step`);
    lastIndex = nextIndex;
  }

  assert.equal(startBody.indexOf("collectAndPostBlocks()"), startBody.lastIndexOf("collectAndPostBlocks()"));
});

test("frame bridge disables Mermaid auto-start before page load settles", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA-->B</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA-->C</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const startMatch = report.match(/  async function start\(\) \{([\s\S]*?)\n  \}/);

  assert(startMatch, "bridge should include a startup function");

  const startBody = startMatch[1]!;
  assert.ok(
    startBody.indexOf("disableMermaidAutostart()") < startBody.indexOf("await waitForLoad()"),
    "Mermaid auto-start must be disabled before the load event can render source blocks"
  );
  assert.match(report, /function disableMermaidAutostart\(\)/);
  assert.match(report, /startOnLoad: false/);
});

test("frame bridge preserves encoded Mermaid labels before rendering", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;old\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;new\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /function extractMermaidSource\(block\)/);
  assert.match(bridge, /block\.innerHTML/);
  assert.match(bridge, /decodeMermaidSourceEntities/);
});

test("frame bridge keeps Mermaid html labels encoded when srcdoc double-encodes them", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&amp;lt;br/&amp;gt;old\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&amp;lt;br/&amp;gt;new\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /replace\(\s*\/&amp;lt;\/gi,\s*"&lt;"\s*\)/);
  assert.match(bridge, /replace\(\s*\/&amp;gt;\/gi,\s*"&gt;"\s*\)/);
});

test("frame bridge decodes Mermaid syntax entities while preserving label breaks", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;old\"] --&gt; B[\"Done\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;new\"] --&gt; B[\"Done\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /MERMAID_BR_PLACEHOLDER/);
  assert.match(bridge, /replace\(\s*\/&gt;\/gi,\s*">"\s*\)/);
  assert.match(bridge, /replace\(\s*\/&lt;\/gi,\s*"<"\s*\)/);
});

test("frame bridge marks changed Mermaid graph parts instead of the whole graph", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load\"] --> B[\"Save\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load\"] --> C[\"Review\"] --> B[\"Save\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /if \(entry\.kind !== "graphic"\) \{/);
  assert.match(bridge, /function renderGraphicDiff\(entry, doc\)/);
  assert.match(bridge, /parseMermaidFlowchartParts\(entry\.before\.rawText\)/);
  assert.match(bridge, /markMermaidNode\(entry\.after\.element, node\.id, "added"/);
  assert.match(bridge, /markMermaidEdge\(entry\.after\.element, edge, "added"/);
  assert.match(report, /\.rhd-graphic-node-added/);
  assert.match(report, /\.rhd-graphic-node-changed/);
  assert.match(report, /\.rhd-graphic-edge-added/);
});

test("frame bridge cleans Mermaid label breaks and renders graph diffs inside labels", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;old\"] --> B[\"Save\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;new\"] --> C[\"Review\"] --> B[\"Save\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /normalizeMermaidSvgLabels\(rendered, document\)/);
  assert.match(bridge, /function normalizeMermaidSvgLabels\(root, doc\)/);
  assert.match(bridge, /MERMAID_LABEL_LINE_PATTERN/);
  assert.match(bridge, /function replaceMermaidNodeLabelWithDiff\(nodeElement, beforeLabel, afterLabel, doc\)/);
  assert.match(bridge, /function findMermaidNodeLabelElement\(nodeElement\)/);
  assert.match(bridge, /labelElement\.textContent = ""/);
  assert.doesNotMatch(bridge, /function appendMermaidNodeDiff/);
  assert.match(report, /\.rhd-graphic-node-inline-diff/);
});

test("frame bridge cleans Mermaid HTML labels as well as SVG text labels", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;old\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load&lt;br/&gt;new\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /querySelectorAll\("text, \.nodeLabel, \[class\*='nodeLabel'\]"\)/);
  assert.match(bridge, /function renderHtmlMermaidLabelLines\(labelElement, entries, doc\)/);
  assert.match(bridge, /doc\.createElement\("br"\)/);
  assert.match(bridge, /doc\.createElement\("span"\)/);
  assert.match(bridge, /labelElement\.namespaceURI === svgNamespace/);
});

test("frame bridge lays out removed Mermaid nodes through a merged graph", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load\"] --> B[\"Save\"] --> D[\"Archive\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Load\"] --> B[\"Save\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /for \(const node of beforeParts\.nodes\.values\(\)\) \{/);
  assert.match(bridge, /!afterParts\.nodes\.has\(node\.id\)/);
  assert.match(bridge, /buildMergedMermaidGraphSource\(entry\.before\.rawText, entry\.after\.rawText, beforeParts, afterParts\)/);
  assert.match(bridge, /await renderMergedMermaidGraph\(entry\.after\.element, mergedSource, entry\.identity, doc\)/);
  assert.match(bridge, /markMermaidNode\(entry\.after\.element, node\.id, "removed", node, null, doc\)/);
  assert.match(bridge, /markMermaidEdge\(entry\.after\.element, edge, "removed"\)/);
  assert.doesNotMatch(bridge, /function renderRemovedMermaidNode/);
  assert.doesNotMatch(bridge, /svg\.setAttribute\("viewBox"/);
  assert.match(report, /\.rhd-graphic-node-removed/);
  assert.match(report, /\.rhd-graphic-edge-removed/);
});

test("frame bridge sizes changed Mermaid node labels before applying inline diff styling", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"CLI\"] --> B[\"Report\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"CLI parse args and read files\"] --> B[\"Report\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /function buildMergedMermaidGraphSource\(beforeSource, afterSource, beforeParts, afterParts\)/);
  assert.match(bridge, /formatMermaidNode\(node\.id, nodeDiffLayoutLabel\(beforeNode\.label, node\.label\), node\)/);
  assert.match(bridge, /function nodeDiffLayoutLabel\(beforeLabel, afterLabel\)/);
  assert.match(bridge, /return escapeMermaidLabel\(beforeLabel\) \+ "&lt;br\/&gt;" \+ escapeMermaidLabel\(afterLabel\)/);
  assert.match(bridge, /function escapeMermaidLabel\(label\)/);
});

test("frame bridge marks only real Mermaid node groups", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"One\"] --> B[\"Two\"] --> C[\"Three\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"One\"] --> B[\"Two\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /function isMermaidNodeGroup\(candidate\)/);
  assert.match(bridge, /classTokens\.includes\("node"\)/);
  assert.match(bridge, /Array\.from\(root\.querySelectorAll\("g"\)\)\.filter\(isMermaidNodeGroup\)/);
  assert.doesNotMatch(bridge, /querySelectorAll\("g\.node, g\[class\*='node'\]"\)/);
});

test("graph diff label styles do not change Mermaid font metrics", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Old\"] --> B[\"Delete\"]</pre>",
    afterHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"New\"]</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.doesNotMatch(report, /\.rhd-graphic-node-inline-diff \{[^"]*font-weight/);
  assert.doesNotMatch(report, /\.rhd-graphic-node-removed text[^"]*font-weight/);
});

test("deleted graphic block clones strike through their rendered text", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre class=\"mermaid\" data-diff-key=\"flow\" data-diff-kind=\"graphic\">flowchart LR\nA[\"Delete me\"] --> B[\"Gone\"]</pre>",
    afterHtml: "<p data-diff-key=\"copy\">No graph here</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /\.rhd-removed-clone svg text/);
  assert.match(report, /\.rhd-removed-clone svg text \{[^"]*text-decoration: line-through/);
  assert.match(report, /\.rhd-removed-clone svg text \{[^"]*fill: #82071e/);
});

test("interactive highlights make code blocks and table cells visibly marked", () => {
  const report = renderStandaloneReport({
    beforeHtml: `
      <pre data-diff-key="code">const mode = "old";</pre>
      <table><tbody><tr data-diff-key="row"><td>Status</td><td>Old</td></tr></tbody></table>
    `,
    afterHtml: `
      <pre data-diff-key="code">const mode = "new";</pre>
      <table><tbody><tr data-diff-key="row"><td>Status</td><td>New</td></tr></tbody></table>
    `,
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(report, /pre\.rhd-block-added \{[^"]*border-color: var\(--rhd-outline-color\)/);
  assert.match(report, /pre\.rhd-block-changed \{[^"]*box-shadow: none/);
  assert.match(report, /pre\.rhd-block-changed \{[^"]*outline: 0/);
  assert.match(report, /\.rhd-table-cell-changed \{[^"]*background: #fff1a6/);
  assert.match(report, /\.rhd-table-cell-changed \{[^"]*box-shadow: inset 0 0 0 2px/);
  assert.match(bridge, /sign\.textContent = signForSegment\(segment\.type\)/);
  assert.match(bridge, /function signForSegment\(type\)/);
});

test("frame bridge reapplies stored inline diffs after late app rendering", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<pre data-diff-key=\"code\">old</pre>",
    afterHtml: "<pre data-diff-key=\"code\">new</pre>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /function applyStoredDiff\(\)/);
  assert.match(report, /function scheduleDiffReapply\(\)/);
  assert.match(report, /setTimeout\(\(\) => \{\s+void applyStoredDiff\(\);\s+\}, delayMs\)/);
});

test("frame bridge preserves wrapped list-item bodies when reapplying inline diffs", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<ul><li data-diff-key=\"item\">Updated folders.</li></ul>",
    afterHtml: "<ul><li data-diff-key=\"item\">Updated folders after validation.</li></ul>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /if \(entry\.kind === "list-item"\) \{/);
  assert.match(bridge, /function renderListItemDiff\(entry, doc\)/);
  assert.match(bridge, /const target = findListItemBody\(entry\.after\.element\) \|\| entry\.after\.element/);
  assert.match(bridge, /item\.classList\.contains\("rhd-list-item-ready"\) && findListItemBody\(item\)/);
});

test("rendered report preserves input scripts inside the frame payload only", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"copy\">Old</p><script>window.beforeRan = true;</script>",
    afterHtml: "<button onclick=\"window.clicked = true\">Click</button><script>window.afterRan = true;</script>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  const dataMatch = report.match(/<script id="rhd-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert(dataMatch, "report should embed JSON payload");

  const payload = JSON.parse(
    dataMatch[1]!
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&")
  );

  assert.match(payload.beforeHtml, /<script>window\.beforeRan = true;<\/script>/);
  assert.match(payload.afterHtml, /onclick="window\.clicked = true"/);
  assert.match(payload.afterHtml, /<script>window\.afterRan = true;<\/script>/);
  assert.doesNotMatch(report.replace(dataMatch[0], ""), /window\.afterRan = true/);
});

test("template editor report keeps scripts and has only the OCR source-file delta", () => {
  const beforeHtml = readFileSync("fixtures/template-editor-flow-before.html", "utf8");
  const afterHtml = readFileSync("fixtures/template-editor-flow-after.html", "utf8");
  const report = renderStandaloneReport({
    beforeHtml,
    afterHtml,
    beforePath: "fixtures/template-editor-flow-before.html",
    afterPath: "fixtures/template-editor-flow-after.html"
  });

  assert.match(report, /function ocrItems\(\)/);
  assert.match(report, /Append sample OCR result/);
  assert.match(report, /__renderedHtmlDiffFocus/);
  assert.match(beforeHtml, /<p class="preview-item" data-diff-key="\$\{target\.id\}-item-\$\{index \+ 1\}">/);
  assert.match(afterHtml, /<p class="preview-item" data-diff-key="\$\{target\.id\}-item-\$\{index \+ 1\}">/);

  for (const fixtureHtml of [beforeHtml, afterHtml]) {
    const focusHook = fixtureHtml.match(/window\.__renderedHtmlDiffFocus[\s\S]*?\n    };/)?.[0] || "";

    assert.match(focusHook, /showMethodWithoutRendering\("ocr"\)/);
    assert.doesNotMatch(focusHook, /openDialog\("ocr"\)/);
  }

  const withoutOcrReturn = (value: string) =>
    value.replace(
      /return \["(?:Scan result: )?Check harness label", "(?:Scan result: )?Verify ladder feet", "(?:Scan result: )?Log inspection photo"\];/g,
      "return [OCR_ITEMS];"
    );

  assert.equal(withoutOcrReturn(beforeHtml), withoutOcrReturn(afterHtml));
});
