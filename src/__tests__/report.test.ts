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

test("rendered report lets the sidebar collapse and expand", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<h1 data-diff-key=\"title\">Before</h1>",
    afterHtml: "<h1 data-diff-key=\"title\">After</h1>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /<aside class="rhd-sidebar" id="rhd-sidebar-panel">/);
  assert.match(report, /id="rhd-sidebar-toggle"/);
  assert.match(report, /aria-controls="rhd-sidebar-panel"/);
  assert.match(report, /aria-expanded="true"/);
  assert.match(report, /\.rhd-shell\.rhd-sidebar-collapsed/);
  assert.match(report, /function setupSidebarToggle\(\)/);
  assert.match(report, /function setSidebarCollapsed\(collapsed\)/);
  assert.match(report, /sidebarToggle\.addEventListener\("click"/);
  assert.match(report, /sidebarToggle\.setAttribute\("aria-label", collapsed \? "Expand sidebar" : "Collapse sidebar"\)/);
});

test("rendered report lets the sidebar width be resized within limits", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<h1 data-diff-key=\"title\">Before</h1>",
    afterHtml: "<h1 data-diff-key=\"title\">After</h1>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /--rhd-sidebar-min-width: 280px/);
  assert.match(report, /--rhd-sidebar-max-width: 560px/);
  assert.match(report, /id="rhd-sidebar-resizer"/);
  assert.match(report, /role="separator"/);
  assert.match(report, /aria-valuemin="280"/);
  assert.match(report, /aria-valuemax="560"/);
  assert.match(report, /function setupSidebarResize\(\)/);
  assert.match(report, /function startSidebarResize\(event\)/);
  assert.match(report, /function handleSidebarResizeKeydown\(event\)/);
  assert.match(report, /function setSidebarWidth\(width\)/);
  assert.match(report, /function clampSidebarWidth\(width\)/);
  assert.match(report, /sidebarResizer\.addEventListener\("pointerdown", startSidebarResize\)/);
  assert.match(report, /sidebarResizer\.addEventListener\("keydown", handleSidebarResizeKeydown\)/);
  assert.match(report, /Math\.min\(SIDEBAR_MAX_WIDTH, Math\.max\(SIDEBAR_MIN_WIDTH, width\)\)/);
});

test("change list entries reveal their full contents on hover and keyboard focus", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"copy\">Before copy</p>",
    afterHtml: "<p data-diff-key=\"copy\">After copy</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(report, /\.rhd-change-button:hover \.rhd-change-title/);
  assert.match(report, /\.rhd-change-button-expanded \.rhd-change-title/);
  assert.match(report, /\.rhd-change-button:focus-visible \.rhd-change-title/);
  assert.match(report, /\.rhd-change-button:hover \.rhd-change-meta/);
  assert.match(report, /function setSidebarItemExpanded\(button, expanded\)/);
  assert.match(report, /button\.addEventListener\("mouseenter", \(\) => setSidebarItemExpanded\(button, true\)\)/);
  assert.match(report, /button\.addEventListener\("focus", \(\) => setSidebarItemExpanded\(button, true\)\)/);
  assert.match(report, /button\.addEventListener\("mouseleave", \(\) => setSidebarItemExpanded\(button, false\)\)/);
  assert.match(report, /button\.addEventListener\("blur", \(\) => setSidebarItemExpanded\(button, false\)\)/);
  assert.match(report, /const fullLabel = title\.textContent \+ "\\n" \+ meta\.textContent/);
  assert.doesNotMatch(report, /button\.setAttribute\("title", fullLabel\)/);
  assert.match(report, /button\.setAttribute\("aria-label", title\.textContent \+ "\. " \+ meta\.textContent\)/);
  assert.doesNotMatch(report, /text\.slice\(0, 56\) \+ "\.\.\."/);
  assert.doesNotMatch(report, /button\.addEventListener\("mouseenter", \(\) => previewEntry\(entry\)\)/);
  assert.doesNotMatch(report, /type: "preview"/);
  assert.doesNotMatch(bridge, /function previewIdentity\(identity\)/);
});

test("sidebar groups changed entries under document sections", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<h1 data-diff-key=\"overview\">Overview</h1><p data-diff-key=\"copy\">Old copy</p>",
    afterHtml: "<h1 data-diff-key=\"overview\">Overview</h1><p data-diff-key=\"copy\">New copy</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /\.rhd-change-section/);
  assert.match(report, /\.rhd-change-section-header/);
  assert.match(report, /\.rhd-change-section-title/);
  assert.match(report, /\.rhd-change-section-counts/);
  assert.match(report, /function groupSidebarEntriesBySection\(entries\)/);
  assert.match(report, /function sectionTitleForEntry\(entry\)/);
  assert.match(report, /function renderSidebarSection\(group\)/);
  assert.match(report, /changeList\.append\(renderSidebarSection\(group\)\)/);
  assert.match(report, /sectionTitle = block\.headingPath\.length > 0 \? block\.headingPath\.join\(" \/ "\) : "Document start"/);
});

test("sidebar stays catalog-only instead of showing before and after snippets", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"copy\">The old customer onboarding copy was short.</p>",
    afterHtml: "<p data-diff-key=\"copy\">The new customer onboarding copy explains each step.</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.doesNotMatch(report, /\.rhd-change-snippets/);
  assert.doesNotMatch(report, /\.rhd-change-snippet-before/);
  assert.doesNotMatch(report, /\.rhd-change-snippet-after/);
  assert.doesNotMatch(report, /function appendChangedSnippets\(main, entry\)/);
  assert.doesNotMatch(report, /beforeText\.textContent = snippetForText\(entry\.before\.text\)/);
  assert.doesNotMatch(report, /afterText\.textContent = snippetForText\(entry\.after\.text\)/);
});

test("sidebar uses concise catalog titles for changed rows", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<h1 data-diff-key=\"report-title\">Old title</h1><p data-diff-key=\"report-summary\">Draft package copy.</p>",
    afterHtml: "<h1 data-diff-key=\"report-title\">New title</h1><p data-diff-key=\"report-summary\">Final package copy.</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });

  assert.match(report, /function sidebarTitleForEntry\(entry\)/);
  assert.match(report, /function blockTitleForSidebar\(block\)/);
  assert.match(report, /function humanizeDisplayKey\(value\)/);
  assert.match(report, /function conciseSidebarText\(text, fallback\)/);
  assert.match(report, /title\.textContent = sidebarTitleForEntry\(entry\)/);
  assert.match(report, /if \(block\.kind === "heading"\) \{/);
  assert.match(report, /if \(block\.identity\.startsWith\("key:"\)\) \{/);
  assert.match(report, /return keyedTitle \|\| conciseSidebarText\(block\.text, readableKind\(block\.kind\)\)/);
  assert.doesNotMatch(report, /title\.textContent = block \? block\.label : entry\.identity/);
  assert.doesNotMatch(report, /headingPath\[headingPath\.length - 1\] \+ ": " \+ text/);
});

test("frame bridge keeps only one focused changed block active", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"one\">Old one</p><p data-diff-key=\"two\">Old two</p>",
    afterHtml: "<p data-diff-key=\"one\">New one</p><p data-diff-key=\"two\">New two</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);
  const focusMatch = bridge.match(/function focusIdentity\(identity\) \{([\s\S]*?)\n  \}/);
  const markerMatch = bridge.match(/function applyFocusMarker\(target\) \{([\s\S]*?)\n  \}/);

  assert(focusMatch, "frame bridge should include focusIdentity");
  assert(markerMatch, "frame bridge should include the shared focus marker helper");
  assert.match(bridge, /function clearFocusedTargets\(\)/);
  assert.match(bridge, /querySelectorAll\("\.rhd-focus-pulse"\)/);
  assert.match(bridge, /focusedTarget\.classList\.remove\("rhd-focus-pulse"\)/);
  assert.match(focusMatch[1]!, /applyFocusMarker\(target\)/);
  assert.ok(
    markerMatch[1]!.indexOf("clearFocusedTargets()") <
      markerMatch[1]!.indexOf('target.classList.add("rhd-focus-pulse")'),
    "previous focused blocks should be cleared before the next focus highlight is applied"
  );
});

test("focused diff blocks use their own status color instead of a blue halo", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"deleted\">Deleted copy</p>",
    afterHtml: "<p data-diff-key=\"kept\">Kept copy</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /placeholder\.setAttribute\("data-rhd-status", "-"\)/);
  assert.match(bridge, /\.rhd-block-added, \[data-rhd-status="\+"\]/);
  assert.match(bridge, /\.rhd-block-changed, \[data-rhd-status="~"\]/);
  assert.match(bridge, /\.rhd-removed-block, \[data-rhd-status="-"\]/);
  assert.match(bridge, /--rhd-focus-ring-color: rgba\(207, 34, 46, 0\.28\)/);
  assert.match(bridge, /\.rhd-focus-pulse \{ box-shadow: inset 4px 0 0 var\(--rhd-marker-color, #0969da\), 0 0 0 5px var\(--rhd-focus-ring-color, rgba\(9, 105, 218, 0\.28\)\)/);
});

test("focused text blocks get a temporary wide bounding box", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"copy\">Old text</p><figure data-diff-key=\"chart\" data-diff-kind=\"graphic\"><svg><text>Old chart</text></svg></figure>",
    afterHtml: "<p data-diff-key=\"copy\">New text</p><figure data-diff-key=\"chart\" data-diff-kind=\"graphic\"><svg><text>New chart</text></svg></figure>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /function shouldUseTextFocusBox\(target\)/);
  assert.match(bridge, /target\.classList\.add\("rhd-text-focus-box"\)/);
  assert.match(bridge, /focusedTarget\.classList\.remove\("rhd-text-focus-box"\)/);
  assert.match(bridge, /\.rhd-focus-pulse\.rhd-text-focus-box \{[^"]*width: 100% !important; max-width: none !important/);
  assert.match(bridge, /\.rhd-focus-pulse\.rhd-text-focus-box \{[^"]*box-shadow: inset 4px 0 0 var\(--rhd-marker-color, #0969da\), 0 0 0 5px var\(--rhd-focus-ring-color/);
  assert.match(bridge, /TEXT_FOCUS_TAGS\.has\(target\.tagName\.toLowerCase\(\)\)/);
  assert.doesNotMatch(bridge, /target\.getAttribute\("data-diff-kind"\) === "graphic"[\s\S]*target\.classList\.add\("rhd-text-focus-box"\)/);
});

test("focused already-highlighted chart blocks keep their selected halo", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<p data-diff-key=\"copy\">Unchanged</p>",
    afterHtml: "<p data-diff-key=\"copy\">Unchanged</p><figure data-diff-key=\"added-chart\" data-diff-kind=\"graphic\"><svg><text>Added chart</text></svg></figure>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);
  const highlightedBlockRule = ".rhd-block-added:not(pre):not(tr)";
  const focusOverrideRule = "[data-rhd-status].rhd-focus-pulse:not(pre):not(tr)";

  assert.match(bridge, /\[data-rhd-status\]\.rhd-focus-pulse:not\(pre\):not\(tr\) \{[^"]*box-shadow: inset 4px 0 0 var\(--rhd-marker-color, #0969da\), 0 0 0 5px var\(--rhd-focus-ring-color/);
  assert.ok(
    bridge.indexOf(focusOverrideRule) > bridge.indexOf(highlightedBlockRule),
    "the selected chart focus rule should come after the base highlighted chart rule so the halo is not overwritten"
  );
});

test("frame bridge waits for deleted placeholders before focusing removed blocks", () => {
  const report = renderStandaloneReport({
    beforeHtml: "<figure data-diff-key=\"removed-chart\" data-diff-kind=\"graphic\"><svg><text>Old chart</text></svg></figure>",
    afterHtml: "<p data-diff-key=\"kept\">Kept copy</p>",
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);
  const focusMatch = bridge.match(/async function focusIdentity\(identity\) \{([\s\S]*?)\n  \}/);

  assert(focusMatch, "focusIdentity should be async so deleted placeholders can be restored before focus");
  assert.match(bridge, /if \(message\.type === "focus"\) \{\n      void focusIdentity\(message\.identity\);\n    \}/);
  assert.match(bridge, /let focusedIdentity = null/);
  assert.match(bridge, /focusedIdentity = identity/);
  assert.match(bridge, /await applyStoredDiff\(\)/);
  assert.match(bridge, /function restoreFocusedTarget\(\)/);
  assert.match(bridge, /restoreFocusedTarget\(\)/);
  assert.ok(
    focusMatch[1]!.indexOf("await applyStoredDiff()") <
      focusMatch[1]!.indexOf("target = findRenderedTarget(identity)"),
    "deleted placeholders should be restored before the focused target is looked up again"
  );
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

test("frame bridge renders SVG chart value changes inside graphic blocks", () => {
  const report = renderStandaloneReport({
    beforeHtml: `
      <figure data-diff-key="chart" data-diff-kind="graphic">
        <svg viewBox="0 0 200 80">
          <text class="chart-title" x="10" y="20">Revenue Chart</text>
          <text class="value" x="10" y="50">$48.2M</text>
        </svg>
      </figure>
    `,
    afterHtml: `
      <figure data-diff-key="chart" data-diff-kind="graphic">
        <svg viewBox="0 0 200 80">
          <text class="chart-title" x="10" y="20">Revenue Chart</text>
          <text class="value" x="10" y="50">$52.6M</text>
        </svg>
      </figure>
    `,
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /function renderSvgChartTextDiff\(entry, doc\)/);
  assert.match(bridge, /function collectSvgChartTextLabels\(root\)/);
  assert.match(bridge, /function renderSvgTextDiff\(textElement, beforeText, afterText, doc\)/);
  assert.match(bridge, /renderSvgChartTextDiff\(entry, doc\)/);
  assert.match(report, /\.rhd-svg-text-diff/);
  assert.match(report, /\.rhd-svg-text-removed/);
  assert.match(report, /\.rhd-svg-text-added/);
});

test("frame bridge spaces stacked SVG chart text diffs before rendering them", () => {
  const report = renderStandaloneReport({
    beforeHtml: `
      <figure data-diff-key="chart" data-diff-kind="graphic">
        <svg viewBox="0 0 300 140">
          <text class="value" x="160" y="60">NA 18%</text>
          <text class="label" x="160" y="78">63% GM</text>
        </svg>
      </figure>
    `,
    afterHtml: `
      <figure data-diff-key="chart" data-diff-kind="graphic">
        <svg viewBox="0 0 300 140">
          <text class="value" x="160" y="60">NA 22%</text>
          <text class="label" x="160" y="78">66% GM</text>
        </svg>
      </figure>
    `,
    beforePath: "before.html",
    afterPath: "after.html"
  });
  const bridge = extractFrameBridge(report);

  assert.match(bridge, /const SVG_TEXT_DIFF_PAIR_HEIGHT = 34/);
  assert.match(bridge, /function layoutSvgTextDiffLabels\(changedLabels\)/);
  assert.match(bridge, /layoutSvgTextDiffLabels\(changedLabels\)/);
  assert.match(bridge, /svgTextCoordinate\(element, "y"\)/);
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
