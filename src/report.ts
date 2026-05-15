import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { sanitizeHtml } from "./core.js";

const nodeRequire = createRequire(import.meta.url);

export interface ReportInput {
  beforeHtml: string;
  afterHtml: string;
  beforePath: string;
  afterPath: string;
}

export function renderStandaloneReport(input: ReportInput): string {
  const payload = {
    beforeHtml: sanitizeHtml(input.beforeHtml),
    afterHtml: sanitizeHtml(input.afterHtml),
    beforePath: input.beforePath,
    afterPath: input.afterPath,
    generatedAt: new Date().toISOString()
  };
  const mermaidRuntime = readMermaidRuntime();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rendered HTML Diff</title>
  <style>
    :root {
      color-scheme: light;
      --canvas: #f6f8fa;
      --surface: #ffffff;
      --surface-muted: #f6f8fa;
      --border: #d0d7de;
      --border-strong: #8c959f;
      --text: #24292f;
      --muted: #57606a;
      --blue: #0969da;
      --add-bg: #dafbe1;
      --add-strong: #2da44e;
      --add-text: #116329;
      --del-bg: #ffebe9;
      --del-strong: #cf222e;
      --del-text: #82071e;
      --mod-bg: #fff8c5;
      --mod-strong: #9a6700;
      --mod-text: #7d4e00;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      height: 100vh;
      overflow: hidden;
      background: var(--canvas);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
    }

    .rhd-shell {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      height: 100vh;
    }

    .rhd-sidebar {
      display: flex;
      min-height: 0;
      flex-direction: column;
      border-right: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
    }

    .rhd-topbar {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-muted);
    }

    .rhd-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0;
    }

    .rhd-subtitle {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .rhd-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }

    .rhd-stat {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      padding: 8px 9px;
    }

    .rhd-stat-added {
      border-left: 4px solid var(--add-strong);
    }

    .rhd-stat-changed {
      border-left: 4px solid var(--mod-strong);
    }

    .rhd-stat-removed {
      border-left: 4px solid var(--del-strong);
    }

    .rhd-stat-value {
      display: block;
      font-size: 17px;
      font-weight: 700;
      line-height: 1;
    }

    .rhd-stat-label {
      display: block;
      margin-top: 5px;
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
    }

    .rhd-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-muted);
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      text-transform: uppercase;
    }

    .rhd-list-header code {
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
      color: var(--muted);
      padding: 2px 5px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      text-transform: none;
    }

    .rhd-change-list {
      min-height: 0;
      overflow: auto;
      padding: 8px 10px 14px;
    }

    .rhd-change-button {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      gap: 9px;
      width: 100%;
      margin: 0 0 4px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: inherit;
      padding: 8px;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }

    .rhd-change-button:hover,
    .rhd-change-button:focus-visible {
      border-color: var(--blue);
      box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.16);
      outline: none;
    }

    .rhd-change-button-added {
      border-left: 4px solid var(--add-strong);
    }

    .rhd-change-button-changed {
      border-left: 4px solid var(--mod-strong);
    }

    .rhd-change-button-removed {
      border-left: 4px solid var(--del-strong);
    }

    .rhd-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 14px;
      font-weight: 800;
    }

    .rhd-status-added {
      background: var(--add-bg);
      color: var(--add-text);
    }

    .rhd-status-changed {
      background: var(--mod-bg);
      color: var(--mod-text);
    }

    .rhd-status-removed {
      background: var(--del-bg);
      color: var(--del-text);
    }

    .rhd-change-main {
      min-width: 0;
    }

    .rhd-change-title {
      display: block;
      overflow: hidden;
      color: var(--text);
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rhd-change-meta {
      display: block;
      margin-top: 3px;
      overflow: hidden;
      color: var(--muted);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rhd-empty {
      padding: 16px 10px;
      color: var(--muted);
      line-height: 1.5;
    }

    .rhd-preview-wrap {
      display: grid;
      min-width: 0;
      min-height: 0;
      grid-template-rows: auto minmax(0, 1fr);
      background: var(--canvas);
    }

    .rhd-preview-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 54px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      padding: 0 16px;
    }

    .rhd-preview-inner {
      min-height: 0;
      padding: 16px;
    }

    .rhd-preview-frame {
      overflow: hidden;
      height: 100%;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
    }

    .rhd-file-pair {
      min-width: 0;
      overflow: hidden;
      color: var(--muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rhd-file-pair strong {
      color: var(--text);
      font-weight: 650;
    }

    .rhd-legend {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 12px;
    }

    .rhd-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }

    .rhd-legend-mark {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid transparent;
    }

    .rhd-legend-added {
      background: var(--add-bg);
      border-color: var(--add-strong);
    }

    .rhd-legend-changed {
      background: var(--mod-bg);
      border-color: var(--mod-strong);
    }

    .rhd-legend-removed {
      background: var(--del-bg);
      border-color: var(--del-strong);
    }

    .rhd-hint {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 12px;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #ffffff;
    }

    @media (max-width: 840px) {
      body {
        overflow: auto;
      }

      .rhd-shell {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(320px, 42vh) minmax(520px, 58vh);
        min-height: 100vh;
      }

      .rhd-sidebar {
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }

      .rhd-preview-toolbar {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
        padding: 10px 14px;
      }

      .rhd-preview-inner {
        padding: 10px;
      }

      .rhd-hint {
        white-space: normal;
      }

      .rhd-legend {
        flex-wrap: wrap;
      }
    }
  </style>
</head>
<body>
  <div class="rhd-shell">
    <aside class="rhd-sidebar">
      <div class="rhd-topbar">
        <h1 class="rhd-title">Rendered HTML Diff</h1>
        <p class="rhd-subtitle" id="rhd-generated"></p>
      </div>
      <div class="rhd-stats" aria-label="Diff summary">
        <div class="rhd-stat rhd-stat-added">
          <span class="rhd-stat-value" id="rhd-added-count">0</span>
          <span class="rhd-stat-label">Added</span>
        </div>
        <div class="rhd-stat rhd-stat-changed">
          <span class="rhd-stat-value" id="rhd-changed-count">0</span>
          <span class="rhd-stat-label">Modified</span>
        </div>
        <div class="rhd-stat rhd-stat-removed">
          <span class="rhd-stat-value" id="rhd-removed-count">0</span>
          <span class="rhd-stat-label">Deleted</span>
        </div>
      </div>
      <div class="rhd-list-header">
        <span>Changed Blocks</span>
        <code>+ / ~ / -</code>
      </div>
      <div class="rhd-change-list" id="rhd-change-list"></div>
    </aside>
    <main class="rhd-preview-wrap">
      <div class="rhd-preview-toolbar">
        <div class="rhd-file-pair" id="rhd-file-pair"></div>
        <div class="rhd-legend" aria-label="Diff color legend">
          <span class="rhd-legend-item"><span class="rhd-legend-mark rhd-legend-added"></span>Added</span>
          <span class="rhd-legend-item"><span class="rhd-legend-mark rhd-legend-changed"></span>Modified</span>
          <span class="rhd-legend-item"><span class="rhd-legend-mark rhd-legend-removed"></span>Deleted</span>
        </div>
      </div>
      <div class="rhd-preview-inner">
        <div class="rhd-preview-frame">
          <iframe id="rhd-preview" sandbox="allow-same-origin" title="Rendered newer HTML"></iframe>
        </div>
      </div>
    </main>
  </div>
  <script id="rhd-mermaid-runtime">
${escapeScriptForInline(mermaidRuntime)}
  </script>
  <script id="rhd-data" type="application/json">${escapeJsonForScript(JSON.stringify(payload))}</script>
  <script>
${viewerScript()}
  </script>
</body>
</html>`;
}

function readMermaidRuntime(): string {
  try {
    const runtimePath = nodeRequire.resolve("mermaid/dist/mermaid.min.js");
    return readFileSync(runtimePath, "utf8");
  } catch {
    // The report still works without Mermaid. Source blocks remain visible and
    // diffable, which is useful when a dependency is missing in a local checkout.
    return "window.__rhdMermaidUnavailable = true;";
  }
}

function escapeScriptForInline(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script");
}

function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function viewerScript(): string {
  return String.raw`(() => {
  const dataNode = document.getElementById("rhd-data");
  const data = JSON.parse(dataNode.textContent);
  const iframe = document.getElementById("rhd-preview");
  const changeList = document.getElementById("rhd-change-list");
  const filePair = document.getElementById("rhd-file-pair");
  const generated = document.getElementById("rhd-generated");
  const addedCount = document.getElementById("rhd-added-count");
  const changedCount = document.getElementById("rhd-changed-count");
  const removedCount = document.getElementById("rhd-removed-count");
  const parser = new DOMParser();
  const beforeDoc = parser.parseFromString(data.beforeHtml, "text/html");
  const mermaid = window.mermaid;

  if (mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      deterministicIds: true,
      deterministicIDSeed: "rendered-html-diff",
      flowchart: {
        curve: "basis",
        htmlLabels: false
      },
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#ddf4ff",
        primaryBorderColor: "#0969da",
        primaryTextColor: "#24292f",
        secondaryColor: "#dafbe1",
        secondaryBorderColor: "#2da44e",
        tertiaryColor: "#fff8c5",
        tertiaryBorderColor: "#9a6700",
        lineColor: "#57606a",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
      }
    });
  }

  filePair.textContent = "";
  const beforeStrong = document.createElement("strong");
  beforeStrong.textContent = data.beforePath;
  const afterStrong = document.createElement("strong");
  afterStrong.textContent = data.afterPath;
  filePair.append(beforeStrong, document.createTextNode(" to "), afterStrong);
  generated.textContent = "Generated " + new Date(data.generatedAt).toLocaleString();

  iframe.addEventListener("load", async () => {
    const afterDoc = iframe.contentDocument;
    if (!afterDoc) {
      renderFailure("Could not access the rendered report frame.");
      return;
    }

    try {
      injectHighlightStyles(afterDoc);
      await renderMermaidBlocks(beforeDoc, "before");
      await renderMermaidBlocks(afterDoc, "after");
      const beforeBlocks = collectBlocks(beforeDoc);
      const afterBlocks = collectBlocks(afterDoc);
      const entries = diffBlocks(beforeBlocks, afterBlocks);

      applyDiff(entries, beforeBlocks, afterBlocks, afterDoc);
      renderSidebar(entries, afterDoc);
    } catch (error) {
      console.error(error);
      renderFailure("The report viewer failed while preparing the rendered diff.");
    }
  });

  iframe.srcdoc = data.afterHtml;

  async function renderMermaidBlocks(doc, scope) {
    const blocks = Array.from((doc.body || doc).querySelectorAll(
      "pre.mermaid[data-diff-kind='graphic'], code.language-mermaid[data-diff-kind='graphic']"
    ));

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const source = normalizeMermaidSource(block.textContent || "");
      block.setAttribute("data-rhd-graphic-source", source);

      if (!source || !mermaid?.render) {
        block.classList.add("rhd-mermaid-source");
        continue;
      }

      try {
        const renderId = "rhd-mermaid-" + scope + "-" + index + "-" + fingerprint(source);
        const result = await mermaid.render(renderId, source);
        const rendered = doc.createElement("div");

        // Preserve the author-provided diff attributes so the rendered SVG
        // still participates in block matching after the source node is replaced.
        for (const attr of Array.from(block.attributes)) {
          rendered.setAttribute(attr.name, attr.value);
        }

        rendered.classList.add("rhd-mermaid-rendered");
        rendered.setAttribute("data-rhd-graphic-source", source);
        rendered.innerHTML = result.svg;
        block.replaceWith(rendered);
      } catch (error) {
        block.classList.add("rhd-mermaid-source", "rhd-mermaid-error");
        block.setAttribute("data-rhd-render-error", error?.message || "Mermaid render failed");
      }
    }
  }

  function normalizeMermaidSource(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    while (lines.length > 0 && lines[0].trim() === "") {
      lines.shift();
    }

    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    const indents = lines
      .filter((line) => line.trim() !== "")
      .map((line) => line.match(/^\s*/)[0].length);
    const smallestIndent = indents.length > 0 ? Math.min(...indents) : 0;

    return lines.map((line) => line.slice(smallestIndent)).join("\n").trim();
  }

  function collectBlocks(doc) {
    const selector = "[data-diff-kind='graphic'],h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,tr";
    const elements = Array.from((doc.body || doc).querySelectorAll(selector));
    const headingPath = [];
    const sectionCounts = new Map();
    const blocks = [];

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      const isGraphicBlock = element.getAttribute("data-diff-kind") === "graphic";
      const graphicAncestor = element.closest("[data-diff-kind='graphic']");
      if (!isGraphicBlock && graphicAncestor) {
        continue;
      }

      if (tagName !== "pre" && element.closest("pre")) {
        continue;
      }

      const kind = isGraphicBlock ? "graphic" : kindForTag(tagName);
      const rawText = extractRawText(element, tagName);
      const text = kind === "code" ? trimTrailingNewlines(rawText) : normalizeText(rawText);

      if (!text) {
        continue;
      }

      const explicitKey = cleanKey(element.getAttribute("data-diff-key"));
      const ancestorKey = explicitKey ? "" : nearestAncestorKey(element);
      let identity;
      let displayKey;

      if (explicitKey) {
        identity = "key:" + explicitKey;
        displayKey = explicitKey;
      } else if (ancestorKey) {
        const countKey = ancestorKey + ":" + tagName;
        const nextCount = (sectionCounts.get(countKey) || 0) + 1;
        sectionCounts.set(countKey, nextCount);
        identity = "section:" + ancestorKey + ":" + tagName + ":" + nextCount;
        displayKey = ancestorKey + "/" + tagName + "-" + nextCount;
      } else {
        identity = "fallback:" + tagName + ":" + headingPath.join(">") + ":" + fingerprint(text);
        displayKey = tagName + " fallback";
      }

      element.setAttribute("data-rhd-identity", identity);

      const block = {
        identity,
        displayKey,
        kind,
        tagName,
        text,
        rawText,
        cellTexts: tagName === "tr" ? Array.from(element.children).map((cell) => normalizeText(cell.textContent || "")) : [],
        headingPath: headingPath.slice(),
        index: blocks.length,
        element,
        label: labelForBlock(text, headingPath, displayKey, kind)
      };

      blocks.push(block);

      if (/^h[1-6]$/.test(tagName)) {
        const level = Number(tagName.slice(1));
        headingPath.splice(level - 1);
        headingPath[level - 1] = text;
      }
    }

    return blocks;
  }

  function diffBlocks(beforeBlocks, afterBlocks) {
    const buckets = new Map();
    for (const block of beforeBlocks) {
      if (!buckets.has(block.identity)) {
        buckets.set(block.identity, []);
      }
      buckets.get(block.identity).push(block);
    }

    const entries = [];

    for (const after of afterBlocks) {
      const bucket = buckets.get(after.identity);
      const before = bucket && bucket.length > 0 ? bucket.shift() : null;

      if (!before) {
        entries.push({ identity: after.identity, kind: after.kind, status: "added", after });
        continue;
      }

      entries.push({
        identity: after.identity,
        kind: after.kind,
        status: before.text === after.text ? "unchanged" : "changed",
        before,
        after
      });
    }

    for (const bucket of buckets.values()) {
      for (const before of bucket) {
        entries.push({ identity: before.identity, kind: before.kind, status: "removed", before });
      }
    }

    return entries;
  }

  function applyDiff(entries, beforeBlocks, afterBlocks, afterDoc) {
    const afterByIdentity = new Map(afterBlocks.map((block) => [block.identity, block]));

    for (const entry of entries) {
      if (entry.status === "added" && entry.after) {
        entry.after.element.classList.add("rhd-block-added");
        entry.after.element.setAttribute("data-rhd-status", "+");
      }

      if (entry.status === "changed" && entry.before && entry.after) {
        entry.after.element.classList.add("rhd-block-changed");
        entry.after.element.setAttribute("data-rhd-status", "~");
        renderInlineDiff(entry, afterDoc);
      }
    }

    for (const entry of entries) {
      if (entry.status === "removed" && entry.before) {
        const placeholder = createRemovedPlaceholder(entry.before, afterDoc);
        insertRemovedPlaceholder(placeholder, entry.before, beforeBlocks, afterByIdentity, afterDoc);
      }
    }

    prepareDiffLists(afterDoc);
  }

  function renderInlineDiff(entry, doc) {
    if (entry.kind === "table-row") {
      renderTableRowDiff(entry, doc);
      return;
    }

    if (entry.kind === "graphic") {
      return;
    }

    if (entry.kind === "code") {
      const segments = diffLines(entry.before.rawText, entry.after.rawText);
      const code = doc.createElement("code");
      code.className = "rhd-code-diff";

      for (const segment of segments) {
        const lines = segment.value.match(/[^\n]*\n|[^\n]+/g) || [];
        for (const line of lines) {
          const row = doc.createElement("span");
          row.className = "rhd-code-line rhd-code-line-" + segment.type;
          const sign = doc.createElement("span");
          sign.className = "rhd-code-sign";
          sign.textContent = signForSegment(segment.type);
          const content = doc.createElement("span");
          content.className = "rhd-code-content";
          content.textContent = line.endsWith("\n") ? line.slice(0, -1) : line;
          row.append(sign, content);
          code.append(row);
        }
      }

      entry.after.element.textContent = "";
      entry.after.element.append(code);
      return;
    }

    entry.after.element.textContent = "";
    entry.after.element.append(renderWordDiffFragment(entry.before.text, entry.after.text, doc));
  }

  function renderTableRowDiff(entry, doc) {
    const beforeCells = Array.from(entry.before.element.children);
    const afterCells = Array.from(entry.after.element.children);

    for (let index = 0; index < afterCells.length; index += 1) {
      const afterCell = afterCells[index];
      const beforeText = normalizeText(beforeCells[index]?.textContent || "");
      const afterText = normalizeText(afterCell.textContent || "");

      if (beforeText === afterText) {
        continue;
      }

      afterCell.classList.add("rhd-table-cell-changed");
      afterCell.textContent = "";
      afterCell.append(renderWordDiffFragment(beforeText, afterText, doc));
    }
  }

  function renderWordDiffFragment(beforeText, afterText, doc) {
    const segments = diffWords(beforeText, afterText);
    const fragment = doc.createDocumentFragment();
    let previousRenderedSegment = null;

    for (const segment of segments) {
      if (!segment.value) {
        continue;
      }

      if (segment.type === "same" || segment.value.trim() === "") {
        fragment.append(doc.createTextNode(segment.value));
        previousRenderedSegment = segment;
        continue;
      }

      if (needsBoundarySpace(previousRenderedSegment, segment)) {
        fragment.append(doc.createTextNode(" "));
      }

      const node = segment.type === "added" ? doc.createElement("mark") : doc.createElement("del");
      node.className = segment.type === "added" ? "rhd-added-token" : "rhd-removed-token";
      node.textContent = segment.value;
      fragment.append(node);
      previousRenderedSegment = segment;
    }

    return fragment;
  }

  function needsBoundarySpace(previous, current) {
    if (!previous || previous.type === current.type || previous.type === "same" || current.type === "same") {
      return false;
    }

    return !/\s$/.test(previous.value) && !/^\s/.test(current.value);
  }

  function createRemovedPlaceholder(block, doc) {
    const placeholder = doc.createElement(block.tagName === "li" ? "li" : "div");
    placeholder.className = "rhd-removed-block";
    placeholder.setAttribute("data-rhd-placeholder-for", block.identity);

    if (block.tagName === "li") {
      placeholder.classList.add("rhd-removed-list-item");
      const deletedText = doc.createElement("del");
      deletedText.className = "rhd-removed-token rhd-removed-list-text";
      deletedText.textContent = block.text;
      placeholder.append(deletedText);
      return placeholder;
    }

    if (block.kind === "table-row") {
      const table = doc.createElement("table");
      const body = doc.createElement("tbody");
      body.append(doc.importNode(block.element, true));
      table.append(body);
      placeholder.append(table);
      return placeholder;
    }

    const clone = doc.importNode(block.element, true);
    clone.classList.add("rhd-removed-clone");
    clone.removeAttribute("data-rhd-identity");
    placeholder.append(clone);
    return placeholder;
  }

  function insertRemovedPlaceholder(placeholder, beforeBlock, beforeBlocks, afterByIdentity, doc) {
    for (let index = beforeBlock.index + 1; index < beforeBlocks.length; index += 1) {
      const candidate = afterByIdentity.get(beforeBlocks[index].identity);
      if (candidate && candidate.element && candidate.element.parentNode) {
        candidate.element.parentNode.insertBefore(placeholder, candidate.element);
        return;
      }
    }

    for (let index = beforeBlock.index - 1; index >= 0; index -= 1) {
      const candidate = afterByIdentity.get(beforeBlocks[index].identity);
      if (candidate && candidate.element && candidate.element.parentNode) {
        candidate.element.parentNode.insertBefore(placeholder, candidate.element.nextSibling);
        return;
      }
    }

    doc.body.prepend(placeholder);
  }

  function prepareDiffLists(doc) {
    const changedListItems = doc.querySelectorAll(
      "li.rhd-block-added, li.rhd-block-changed, li.rhd-removed-list-item"
    );

    for (const item of changedListItems) {
      const list = item.parentElement;
      if (list && /^(ol|ul)$/i.test(list.tagName)) {
        list.classList.add("rhd-diff-list");
        wrapListItemContents(list, doc);
      }
    }
  }

  function wrapListItemContents(list, doc) {
    const items = Array.from(list.children).filter((child) => child.tagName?.toLowerCase() === "li");
    let orderedValue = Number.parseInt(list.getAttribute("start") || "1", 10);

    if (!Number.isFinite(orderedValue)) {
      orderedValue = 1;
    }

    for (const item of items) {
      if (item.classList.contains("rhd-list-item-ready")) {
        continue;
      }

      const explicitValue = Number.parseInt(item.getAttribute("value") || "", 10);
      if (Number.isFinite(explicitValue)) {
        orderedValue = explicitValue;
      }

      const marker = doc.createElement("span");
      marker.className = "rhd-list-marker";
      marker.textContent = list.tagName.toLowerCase() === "ol" ? orderedValue + "." : "-";

      const body = doc.createElement("span");
      body.className = "rhd-list-body";

      while (item.firstChild) {
        body.append(item.firstChild);
      }

      item.append(marker, body);
      item.classList.add("rhd-list-item-ready");
      orderedValue += 1;
    }
  }

  function renderSidebar(entries, afterDoc) {
    const changedEntries = entries.filter((entry) => entry.status !== "unchanged");
    const counts = {
      added: changedEntries.filter((entry) => entry.status === "added").length,
      changed: changedEntries.filter((entry) => entry.status === "changed").length,
      removed: changedEntries.filter((entry) => entry.status === "removed").length
    };

    addedCount.textContent = String(counts.added);
    changedCount.textContent = String(counts.changed);
    removedCount.textContent = String(counts.removed);
    changeList.textContent = "";

    if (changedEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rhd-empty";
      empty.textContent = "No rendered document changes found.";
      changeList.append(empty);
      return;
    }

    for (const entry of changedEntries) {
      const block = entry.after || entry.before;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rhd-change-button rhd-change-button-" + entry.status;

      const badge = document.createElement("span");
      badge.className = "rhd-status rhd-status-" + entry.status;
      badge.textContent = statusGlyph(entry.status);
      badge.setAttribute("aria-label", statusLabel(entry.status));

      const main = document.createElement("span");
      main.className = "rhd-change-main";

      const title = document.createElement("span");
      title.className = "rhd-change-title";
      title.textContent = block ? block.label : entry.identity;

      const meta = document.createElement("span");
      meta.className = "rhd-change-meta";
      meta.textContent = statusLabel(entry.status) + " " + readableKind(entry.kind) + " - " + entry.identity.replace(/^(key|section|fallback):/, "");

      main.append(title, meta);
      button.append(badge, main);
      button.addEventListener("click", () => focusEntry(entry, afterDoc));
      changeList.append(button);
    }
  }

  function focusEntry(entry, afterDoc) {
    const target = findRenderedTarget(entry, afterDoc);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("rhd-focus-pulse");
    void target.offsetWidth;
    target.classList.add("rhd-focus-pulse");
  }

  function findRenderedTarget(entry, afterDoc) {
    const candidates = Array.from(afterDoc.querySelectorAll("[data-rhd-identity], [data-rhd-placeholder-for]"));
    return candidates.find((element) => {
      return element.getAttribute("data-rhd-identity") === entry.identity ||
        element.getAttribute("data-rhd-placeholder-for") === entry.identity;
    }) || null;
  }

  function injectHighlightStyles(doc) {
    const style = doc.createElement("style");
    style.id = "rhd-highlight-style";
    style.textContent = [
      ".rhd-block-added, .rhd-block-changed { box-sizing: border-box !important; border-radius: 4px !important; outline-offset: 2px !important; transition: box-shadow 160ms ease, outline-color 160ms ease !important; }",
      ".rhd-block-added { --rhd-marker-color: #2da44e; --rhd-block-bg: #dafbe1; --rhd-outline-color: rgba(45, 164, 78, 0.7); }",
      ".rhd-block-changed { --rhd-marker-color: #9a6700; --rhd-block-bg: #fff8c5; --rhd-outline-color: rgba(154, 103, 0, 0.65); }",
      ".rhd-block-added:not(pre):not(tr), .rhd-block-changed:not(pre):not(tr) { max-width: 100% !important; overflow-wrap: anywhere !important; background: var(--rhd-block-bg) !important; outline: 1px solid var(--rhd-outline-color) !important; box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; padding-left: max(10px, 0.65em) !important; padding-right: 6px !important; }",
      ".rhd-diff-list { padding-left: 0 !important; list-style: none !important; counter-reset: rhd-list-item !important; }",
      ".rhd-diff-list > li { display: grid !important; grid-template-columns: 2.35em minmax(0, 1fr) !important; column-gap: 0.45em !important; align-items: baseline !important; list-style: none !important; padding-left: 0 !important; }",
      ".rhd-list-marker { grid-column: 1 !important; text-align: right !important; color: inherit !important; font-variant-numeric: tabular-nums !important; user-select: none !important; }",
      ".rhd-list-body { grid-column: 2 !important; min-width: 0 !important; overflow-wrap: anywhere !important; }",
      "li.rhd-block-added:not(pre):not(tr), li.rhd-block-changed:not(pre):not(tr), li.rhd-removed-list-item { padding-left: 0 !important; }",
      "pre.rhd-block-added, pre.rhd-block-changed { outline: 1px solid var(--rhd-outline-color) !important; box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; overflow-x: auto !important; }",
      "tr.rhd-block-added, tr.rhd-block-changed { background: transparent !important; outline: 0 !important; box-shadow: none !important; }",
      "tr.rhd-block-added > th, tr.rhd-block-added > td { background: #dafbe1 !important; }",
      "tr.rhd-block-changed > th, tr.rhd-block-changed > td { background: #fff8c5 !important; }",
      "tr.rhd-block-added > :first-child, tr.rhd-block-changed > :first-child { box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; padding-left: 14px !important; }",
      ".rhd-table-cell-changed { outline: 1px solid rgba(154, 103, 0, 0.35) !important; outline-offset: -1px !important; }",
      "mark.rhd-added-token { background: #aceebb !important; color: #116329 !important; border-radius: 3px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; padding: 0 2px !important; overflow-wrap: anywhere !important; }",
      "del.rhd-removed-token { background: #ffd7d5 !important; color: #82071e !important; border-radius: 3px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; padding: 0 2px !important; text-decoration: line-through !important; overflow-wrap: anywhere !important; }",
      ".rhd-removed-block { box-sizing: border-box !important; max-width: 100% !important; margin: 14px 0 !important; border: 1px solid rgba(207, 34, 46, 0.6) !important; border-left-width: 4px !important; border-radius: 6px !important; background: #ffebe9 !important; padding: 10px 12px !important; color: #82071e !important; overflow-wrap: anywhere !important; }",
      "li.rhd-removed-block { --rhd-marker-color: #cf222e; margin: 6px 0 !important; border: 1px solid rgba(207, 34, 46, 0.6) !important; border-radius: 4px !important; background: #ffebe9 !important; box-shadow: inset 4px 0 0 #cf222e !important; color: #82071e !important; padding: 0 !important; }",
      ".rhd-removed-label { display: inline-block !important; margin-bottom: 6px !important; color: #82071e !important; font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif !important; text-transform: uppercase !important; }",
      ".rhd-removed-block p { margin: 0 !important; }",
      ".rhd-removed-clone { margin: 0 !important; color: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-removed-clone.graph-panel, .rhd-removed-clone svg { width: 100% !important; max-width: 100% !important; }",
      ".rhd-removed-clone svg { opacity: 0.72 !important; filter: sepia(0.35) saturate(1.25) hue-rotate(310deg) !important; }",
      ".rhd-mermaid-rendered { max-width: 100% !important; overflow-x: auto !important; }",
      ".rhd-mermaid-rendered svg { display: block !important; width: 100% !important; max-width: 100% !important; height: auto !important; }",
      ".rhd-mermaid-source { white-space: pre !important; overflow-x: auto !important; }",
      ".rhd-mermaid-error { border-color: rgba(207, 34, 46, 0.65) !important; background: #ffebe9 !important; color: #82071e !important; }",
      ".rhd-removed-list-text { background: transparent !important; padding: 0 !important; }",
      ".rhd-code-diff { display: block !important; min-width: max-content !important; }",
      ".rhd-code-line { display: grid !important; grid-template-columns: 24px minmax(0, 1fr) !important; min-height: 1.35em !important; min-width: 100% !important; white-space: pre !important; }",
      ".rhd-code-sign { user-select: none !important; text-align: center !important; font-weight: 800 !important; opacity: 0.95 !important; }",
      ".rhd-code-content { min-width: 0 !important; padding: 0 4px !important; }",
      ".rhd-code-line-added { background: #dafbe1 !important; color: #116329 !important; }",
      ".rhd-code-line-removed { background: #ffebe9 !important; color: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-code-line-same { background: transparent !important; }",
      ".rhd-focus-pulse { box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px rgba(9, 105, 218, 0.28) !important; }"
    ].join("\n");

    doc.head.append(style);
  }

  function renderFailure(message) {
    changeList.textContent = "";
    const node = document.createElement("div");
    node.className = "rhd-empty";
    node.textContent = message;
    changeList.append(node);
  }

  function extractRawText(element, tagName) {
    const graphicSource = element.getAttribute("data-rhd-graphic-source");
    if (graphicSource) {
      return graphicSource;
    }

    if (tagName === "tr") {
      return Array.from(element.children).map((cell) => cell.textContent || "").join(" | ");
    }

    return element.textContent || "";
  }

  function normalizeText(text) {
    return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function trimTrailingNewlines(text) {
    return text.replace(/\r\n/g, "\n").replace(/\s+$/g, "");
  }

  function cleanKey(value) {
    return value ? value.trim() : "";
  }

  function nearestAncestorKey(element) {
    let current = element.parentElement;
    while (current) {
      const key = cleanKey(current.getAttribute("data-diff-key"));
      if (key) {
        return key;
      }
      current = current.parentElement;
    }
    return "";
  }

  function kindForTag(tagName) {
    if (/^h[1-6]$/.test(tagName)) {
      return "heading";
    }
    if (tagName === "li") {
      return "list-item";
    }
    if (tagName === "pre") {
      return "code";
    }
    if (tagName === "blockquote") {
      return "quote";
    }
    if (tagName === "tr") {
      return "table-row";
    }
    return "paragraph";
  }

  function readableKind(kind) {
    const names = {
      heading: "heading",
      paragraph: "paragraph",
      "list-item": "list item",
      code: "code block",
      graphic: "graphic block",
      quote: "quote",
      "table-row": "table row"
    };
    return names[kind] || kind;
  }

  function statusGlyph(status) {
    if (status === "added") {
      return "+";
    }
    if (status === "removed") {
      return "-";
    }
    if (status === "changed") {
      return "~";
    }
    return " ";
  }

  function statusLabel(status) {
    if (status === "added") {
      return "Added";
    }
    if (status === "removed") {
      return "Deleted";
    }
    if (status === "changed") {
      return "Modified";
    }
    return "Unchanged";
  }

  function signForSegment(type) {
    if (type === "added") {
      return "+";
    }
    if (type === "removed") {
      return "-";
    }
    return " ";
  }

  function labelForBlock(text, headingPath, displayKey, kind) {
    if (kind === "graphic") {
      const sectionTitle = headingPath[headingPath.length - 1];
      return sectionTitle ? sectionTitle + " diagram" : displayKey + " diagram";
    }

    if (text.length <= 72) {
      return text;
    }
    if (headingPath.length > 0) {
      return headingPath[headingPath.length - 1] + ": " + text.slice(0, 56) + "...";
    }
    return displayKey + ": " + text.slice(0, 56) + "...";
  }

  function fingerprint(text) {
    return normalizeText(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  function diffWords(beforeText, afterText) {
    return diffTokenSequences(tokenizeWords(beforeText), tokenizeWords(afterText));
  }

  function diffLines(beforeText, afterText) {
    return diffTokenSequences(splitLines(beforeText), splitLines(afterText));
  }

  function tokenizeWords(text) {
    return text.match(/\S+\s*/g) || [];
  }

  function splitLines(text) {
    const normalized = text.replace(/\r\n/g, "\n");
    if (!normalized) {
      return [];
    }
    const lines = normalized.split("\n");
    return lines.map((line, index) => index < lines.length - 1 ? line + "\n" : line);
  }

  function diffTokenSequences(beforeTokens, afterTokens) {
    const rows = beforeTokens.length + 1;
    const cols = afterTokens.length + 1;
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = beforeTokens.length - 1; i >= 0; i -= 1) {
      for (let j = afterTokens.length - 1; j >= 0; j -= 1) {
        dp[i][j] = beforeTokens[i] === afterTokens[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const segments = [];
    let i = 0;
    let j = 0;

    while (i < beforeTokens.length && j < afterTokens.length) {
      if (beforeTokens[i] === afterTokens[j]) {
        pushSegment(segments, "same", beforeTokens[i]);
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        pushSegment(segments, "removed", beforeTokens[i]);
        i += 1;
      } else {
        pushSegment(segments, "added", afterTokens[j]);
        j += 1;
      }
    }

    while (i < beforeTokens.length) {
      pushSegment(segments, "removed", beforeTokens[i]);
      i += 1;
    }

    while (j < afterTokens.length) {
      pushSegment(segments, "added", afterTokens[j]);
      j += 1;
    }

    return segments;
  }

  function pushSegment(segments, type, value) {
    const previous = segments[segments.length - 1];
    if (previous && previous.type === type) {
      previous.value += value;
      return;
    }
    segments.push({ type, value });
  }
})();`;
}
