import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

export interface ReportInput {
  beforeHtml: string;
  afterHtml: string;
  beforePath: string;
  afterPath: string;
}

export function renderStandaloneReport(input: ReportInput): string {
  const payload = {
    beforeHtml: input.beforeHtml,
    afterHtml: input.afterHtml,
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
      --rhd-sidebar-width: 360px;
      --rhd-sidebar-min-width: 280px;
      --rhd-sidebar-max-width: 560px;
      display: grid;
      grid-template-columns: var(--rhd-sidebar-width) minmax(0, 1fr);
      height: 100vh;
      transition: grid-template-columns 180ms ease;
    }

    .rhd-shell.rhd-sidebar-collapsed {
      grid-template-columns: 48px minmax(0, 1fr);
    }

    .rhd-shell.rhd-sidebar-resizing {
      cursor: col-resize;
      user-select: none;
    }

    .rhd-shell.rhd-sidebar-resizing iframe {
      pointer-events: none;
    }

    .rhd-sidebar {
      position: relative;
      display: flex;
      min-height: 0;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
    }

    .rhd-topbar {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-muted);
    }

    .rhd-topbar-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
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

    .rhd-sidebar-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 30px;
      height: 30px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--muted);
      cursor: pointer;
      font: inherit;
      padding: 0;
    }

    .rhd-sidebar-toggle:hover,
    .rhd-sidebar-toggle:focus-visible {
      border-color: var(--blue);
      color: var(--blue);
      box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.16);
      outline: none;
    }

    .rhd-sidebar-toggle-icon {
      position: relative;
      width: 16px;
      height: 16px;
    }

    .rhd-sidebar-toggle-icon::before {
      content: "";
      position: absolute;
      top: 2px;
      bottom: 2px;
      left: 2px;
      width: 5px;
      border: 1px solid currentColor;
      border-radius: 2px;
    }

    .rhd-sidebar-toggle-icon::after {
      content: "";
      position: absolute;
      top: 5px;
      left: 9px;
      width: 5px;
      height: 5px;
      border-bottom: 2px solid currentColor;
      border-left: 2px solid currentColor;
      transform: rotate(45deg);
      transition: transform 160ms ease, left 160ms ease;
    }

    .rhd-shell.rhd-sidebar-collapsed .rhd-topbar {
      padding: 10px 8px;
    }

    .rhd-shell.rhd-sidebar-collapsed .rhd-topbar-heading {
      justify-content: center;
    }

    .rhd-shell.rhd-sidebar-collapsed .rhd-sidebar-toggle-icon::after {
      left: 6px;
      transform: rotate(225deg);
    }

    .rhd-shell.rhd-sidebar-collapsed .rhd-title,
    .rhd-shell.rhd-sidebar-collapsed .rhd-subtitle,
    .rhd-shell.rhd-sidebar-collapsed .rhd-stats,
    .rhd-shell.rhd-sidebar-collapsed .rhd-list-header,
    .rhd-shell.rhd-sidebar-collapsed .rhd-change-list {
      display: none;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }

    .rhd-shell.rhd-sidebar-collapsed .rhd-sidebar-resizer {
      display: none;
    }

    .rhd-sidebar-resizer {
      position: absolute;
      top: 0;
      right: -4px;
      z-index: 4;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      touch-action: none;
    }

    .rhd-sidebar-resizer::before {
      content: "";
      position: absolute;
      top: 10px;
      right: 3px;
      bottom: 10px;
      width: 2px;
      border-radius: 2px;
      background: transparent;
      transition: background 160ms ease, box-shadow 160ms ease;
    }

    .rhd-sidebar-resizer:hover::before,
    .rhd-sidebar-resizer:focus-visible::before {
      background: var(--blue);
      box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.14);
    }

    .rhd-sidebar-resizer:focus-visible {
      outline: none;
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

    .rhd-change-section {
      margin: 0 0 12px;
    }

    .rhd-change-section-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      gap: 8px;
      padding: 7px 6px 6px;
      color: var(--muted);
    }

    .rhd-change-section-title {
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--text);
      font-size: 12px;
      font-weight: 700;
    }

    .rhd-change-section-counts {
      color: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
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

    .rhd-change-button:hover .rhd-change-title,
    .rhd-change-button-expanded .rhd-change-title,
    .rhd-change-button:focus .rhd-change-title,
    .rhd-change-button:focus-visible .rhd-change-title,
    .rhd-change-button:hover .rhd-change-meta,
    .rhd-change-button-expanded .rhd-change-meta,
    .rhd-change-button:focus .rhd-change-meta,
    .rhd-change-button:focus-visible .rhd-change-meta {
      overflow: visible;
      overflow-wrap: anywhere;
      text-overflow: clip;
      white-space: normal;
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

    .rhd-hidden-frame {
      position: fixed;
      top: 0;
      left: -120vw;
      width: 1024px;
      height: 768px;
      border: 0;
      opacity: 0;
      pointer-events: none;
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

      .rhd-shell.rhd-sidebar-collapsed {
        grid-template-columns: 1fr;
        grid-template-rows: 52px minmax(520px, 1fr);
      }

      .rhd-sidebar {
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }

      .rhd-sidebar-resizer {
        display: none;
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
    <aside class="rhd-sidebar" id="rhd-sidebar-panel">
      <div class="rhd-topbar">
        <div class="rhd-topbar-heading">
          <h1 class="rhd-title">Rendered HTML Diff</h1>
          <button class="rhd-sidebar-toggle" id="rhd-sidebar-toggle" type="button" aria-controls="rhd-sidebar-panel" aria-expanded="true" aria-label="Collapse sidebar" title="Collapse sidebar">
            <span class="rhd-sidebar-toggle-icon" aria-hidden="true"></span>
          </button>
        </div>
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
      <div class="rhd-sidebar-resizer" id="rhd-sidebar-resizer" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-controls="rhd-sidebar-panel" aria-valuemin="280" aria-valuemax="560" aria-valuenow="360" tabindex="0"></div>
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
          <iframe id="rhd-preview" sandbox="allow-scripts" title="Rendered newer HTML"></iframe>
        </div>
      </div>
    </main>
  </div>
  <iframe id="rhd-before-preview" class="rhd-hidden-frame" sandbox="allow-scripts" title="Rendered older HTML"></iframe>
  <script id="rhd-mermaid-runtime">
${escapeScriptForInline(mermaidRuntime)}
  </script>
  <script id="rhd-frame-bridge" type="text/plain">
${escapeScriptForInline(frameBridgeScript())}
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

function frameBridgeScript(): string {
  return String.raw`(() => {
  const MESSAGE_SOURCE = "rendered-html-diff";
  const SVG_TEXT_DIFF_PAIR_HEIGHT = 34;
  const SVG_TEXT_DIFF_COLUMN_TOLERANCE = 8;
  const TEXT_FOCUS_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li"]);
  const config = window.__rhdBridgeConfig || {};
  const blockByIndex = new Map();
  let localBlocks = [];
  let diffApplied = false;
  let lastDiff = null;
  let diffReapplyTimers = [];
  let interactiveDiffReapplyTimer = null;
  let applyingDiffDepth = 0;
  let isApplyingDiff = false;
  let focusedIdentity = null;

  if (!config.token || !config.frameId || window.__renderedHtmlDiffBridge) {
    return;
  }

  window.__renderedHtmlDiffBridge = true;

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.source !== MESSAGE_SOURCE || message.token !== config.token) {
      return;
    }

    if (message.type === "apply-diff") {
      diffApplied = true;
      lastDiff = {
        entries: message.entries || [],
        beforeBlocks: message.beforeBlocks || [],
        afterBlocks: message.afterBlocks || []
      };
      void applyStoredDiff();
      scheduleDiffReapply();
    }

    if (message.type === "focus") {
      void focusIdentity(message.identity);
    }
  });

  start().catch((error) => {
    post("frame-error", {
      message: error && error.message ? error.message : "The report frame failed to initialize."
    });
  });

  async function start() {
    disableMermaidAutostart();
    injectHighlightStyles(document);

    await waitForLoad();
    await waitForReadyHook();
    await settleFrame();
    await renderMermaidBlocks(config.frameId);
    collectAndPostBlocks();
    observeInteractiveMutations();
  }

  function collectAndPostBlocks() {
    localBlocks = collectBlocks(document);
    post("blocks", {
      blocks: localBlocks.map(serializeBlock)
    });
  }

  function post(type, detail) {
    window.parent.postMessage({
      source: MESSAGE_SOURCE,
      token: config.token,
      frameId: config.frameId,
      type,
      ...detail
    }, "*");
  }

  function waitForLoad() {
    if (document.readyState !== "loading") {
      return Promise.resolve();
    }

    // Some srcdoc documents miss the parent-observed load timing. A short
    // fallback keeps the bridge moving after parser-blocking app scripts ran.
    return Promise.race([
      new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true })),
      new Promise((resolve) => window.addEventListener("load", resolve, { once: true })),
      delay(250)
    ]);
  }

  async function waitForReadyHook() {
    const ready = window.__renderedHtmlDiffReady;
    if (!ready) {
      return;
    }

    const value = typeof ready === "function" ? ready() : ready;
    if (!value || typeof value.then !== "function") {
      return;
    }

    await Promise.race([value, delay(2500)]);
  }

  async function settleFrame() {
    // A live app often renders once on load and then again on the next frame.
    // Waiting here makes the collected blocks match the screen the user sees.
    await animationFrame();
    await animationFrame();
    await delay(80);
  }

  function animationFrame() {
    // Hidden comparison frames may throttle animation frames. The timeout keeps
    // collection deterministic while still allowing visible frames to paint.
    return Promise.race([
      new Promise((resolve) => requestAnimationFrame(resolve)),
      delay(50)
    ]);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function disableMermaidAutostart() {
    const mermaid = window.mermaid;
    if (!mermaid || typeof mermaid.initialize !== "function") {
      return;
    }

    // The bundled Mermaid runtime listens for the load event and renders every
    // .mermaid node by default. We disable that eager pass so this bridge can
    // read the original source and then apply its own diff-aware rendering.
    mermaid.initialize({ startOnLoad: false });
  }

  async function renderMermaidBlocks(scope) {
    const mermaid = window.mermaid;
    if (mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        deterministicIds: true,
        deterministicIDSeed: "rendered-html-diff-" + scope,
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

    const blocks = Array.from((document.body || document).querySelectorAll(
      "pre.mermaid[data-diff-kind='graphic'], code.language-mermaid[data-diff-kind='graphic']"
    ));

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const source = extractMermaidSource(block);
      block.setAttribute("data-rhd-graphic-source", source);

      if (!source || !mermaid || !mermaid.render) {
        block.classList.add("rhd-mermaid-source");
        continue;
      }

      try {
        const renderId = "rhd-mermaid-" + scope + "-" + index + "-" + fingerprint(source);
        const result = await mermaid.render(renderId, source);
        const rendered = document.createElement("div");

        // Keep author keys on rendered diagrams so graphic diffs still match.
        for (const attr of Array.from(block.attributes)) {
          rendered.setAttribute(attr.name, attr.value);
        }

        rendered.classList.add("rhd-mermaid-rendered");
        rendered.setAttribute("data-rhd-graphic-source", source);
        rendered.innerHTML = result.svg;
        normalizeMermaidSvgLabels(rendered, document);
        block.replaceWith(rendered);
      } catch (error) {
        block.classList.add("rhd-mermaid-source", "rhd-mermaid-error");
        block.setAttribute("data-rhd-render-error", error && error.message ? error.message : "Mermaid render failed");
      }
    }
  }

  function extractMermaidSource(block) {
    const htmlSource = block.innerHTML || block.textContent || "";
    const sourceWithTextLineBreaks = htmlSource.replace(/<br\s*\/?>/gi, "\n");
    return normalizeMermaidSource(decodeMermaidSourceEntities(sourceWithTextLineBreaks));
  }

  function decodeMermaidSourceEntities(source) {
    const MERMAID_BR_PLACEHOLDER = "__RHD_MERMAID_BR__";

    // srcdoc parsing encodes both Mermaid syntax, such as --> arrows, and safe
    // label markup, such as &lt;br/&gt;. Decode the syntax back to real Mermaid,
    // but protect label line breaks so they stay encoded for Mermaid's parser.
    return source
      .replace(/&amp;lt;/gi, "&lt;")
      .replace(/&amp;gt;/gi, "&gt;")
      .replace(/&amp;nbsp;/gi, " ")
      .replace(/&amp;quot;/gi, "&quot;")
      .replace(/&amp;apos;/gi, "&apos;")
      .replace(/&lt;br\s*\/?&gt;/gi, MERMAID_BR_PLACEHOLDER)
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, "&")
      .replace(/&nbsp;/gi, " ")
      .replace(new RegExp(MERMAID_BR_PLACEHOLDER, "g"), "&lt;br/&gt;");
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

  function normalizeMermaidSvgLabels(root, doc) {
    const MERMAID_LABEL_LINE_PATTERN = /(?:<br\s*\/?>|&lt;br\s*\/?&gt;|&amp;lt;br\s*\/?&amp;gt;)/i;
    const textElements = Array.from(root.querySelectorAll("text, .nodeLabel, [class*='nodeLabel']"));

    for (const textElement of textElements) {
      const sourceText = mermaidTextElementContent(textElement);
      if (!MERMAID_LABEL_LINE_PATTERN.test(sourceText)) {
        continue;
      }

      renderMermaidLabelLines(textElement, splitMermaidLabelLines(sourceText), doc);
    }
  }

  function mermaidTextElementContent(textElement) {
    if (!isSvgTextLabel(textElement)) {
      return textElement.innerHTML || textElement.textContent || "";
    }

    const tspans = Array.from(textElement.querySelectorAll("tspan"));
    if (tspans.length === 0) {
      return textElement.textContent || "";
    }

    return tspans.map((tspan) => tspan.textContent || "").join("\n");
  }

  function splitMermaidLabelLines(label) {
    return String(label)
      .replace(/&amp;lt;br\s*\/?&amp;gt;/gi, "\n")
      .replace(/&lt;br\s*\/?&gt;/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .split("\n")
      .map((line) => cleanMermaidLabel(line))
      .filter((line) => line !== "");
  }

  function renderMermaidLabelLines(labelElement, lines, doc) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const entries = lines.map((line) => typeof line === "string" ? { text: line, className: "" } : line);

    if (labelElement.namespaceURI !== svgNamespace) {
      renderHtmlMermaidLabelLines(labelElement, entries, doc);
      return;
    }

    const firstTspan = labelElement.querySelector("tspan");
    const x = labelElement.getAttribute("x") || firstTspan?.getAttribute("x") || "";
    const y = labelElement.getAttribute("y") || firstTspan?.getAttribute("y") || "";

    labelElement.textContent = "";

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const tspan = doc.createElementNS(svgNamespace, "tspan");
      tspan.textContent = entry.text;
      if (x) {
        tspan.setAttribute("x", x);
      }

      if (entry.className) {
        tspan.classList.add(entry.className);
      }

      if (index === 0) {
        if (y) {
          tspan.setAttribute("y", y);
        }
      } else {
        tspan.setAttribute("dy", "1.2em");
      }

      labelElement.append(tspan);
    }
  }

  function renderHtmlMermaidLabelLines(labelElement, entries, doc) {
    labelElement.textContent = "";

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (index > 0) {
        labelElement.append(doc.createElement("br"));
      }

      const line = doc.createElement("span");
      line.textContent = entry.text;
      if (entry.className) {
        line.classList.add(entry.className);
      }
      labelElement.append(line);
    }
  }

  function isSvgTextLabel(labelElement) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    return labelElement.namespaceURI === svgNamespace && labelElement.tagName.toLowerCase() === "text";
  }

  function collectBlocks(doc) {
    const selector = "[data-diff-kind='graphic'],h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,tr";
    const elements = Array.from((doc.body || doc).querySelectorAll(selector));
    const headingPath = [];
    const sectionCounts = new Map();
    const blocks = [];
    blockByIndex.clear();

    for (const element of elements) {
      if (element.hidden || element.closest("[hidden]")) {
        continue;
      }

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
        html: element.outerHTML,
        element,
        label: labelForBlock(text, headingPath, displayKey, kind)
      };

      blocks.push(block);
      blockByIndex.set(block.index, block);

      if (/^h[1-6]$/.test(tagName)) {
        const level = Number(tagName.slice(1));
        headingPath.splice(level - 1);
        headingPath[level - 1] = text;
      }
    }

    return blocks;
  }

  function serializeBlock(block) {
    return {
      identity: block.identity,
      displayKey: block.displayKey,
      kind: block.kind,
      tagName: block.tagName,
      text: block.text,
      rawText: block.rawText,
      cellTexts: block.cellTexts,
      headingPath: block.headingPath,
      index: block.index,
      html: block.html,
      label: block.label
    };
  }

  async function applyDiff(entries, beforeBlocks, afterBlocks) {
    applyingDiffDepth += 1;
    isApplyingDiff = true;
    try {
      document.querySelectorAll(".rhd-removed-block[data-rhd-placeholder-for]").forEach((node) => node.remove());
      localBlocks = collectBlocks(document);
      const currentByIdentity = new Map(localBlocks.map((block) => [block.identity, block]));
      const afterByIdentity = currentByIdentity;
      const inlineTasks = [];

      for (const entry of entries) {
        const afterBlock = entry.after
          ? currentByIdentity.get(entry.identity) || blockByIndex.get(entry.after.index)
          : null;

        if (entry.status === "added" && afterBlock) {
          afterBlock.element.classList.add("rhd-block-added");
          afterBlock.element.setAttribute("data-rhd-status", "+");
        }

        if (entry.status === "changed" && entry.before && afterBlock) {
          if (entry.kind !== "graphic") {
            afterBlock.element.classList.add("rhd-block-changed");
          }
          afterBlock.element.setAttribute("data-rhd-status", "~");
          inlineTasks.push(renderInlineDiff({
            ...entry,
            after: {
              ...entry.after,
              element: afterBlock.element
            }
          }, document));
        }
      }

      await Promise.all(inlineTasks);

      for (const entry of entries) {
        if (entry.status === "removed" && entry.before) {
          const placeholder = createRemovedPlaceholder(entry.before, document);
          insertRemovedPlaceholder(placeholder, entry.before, beforeBlocks, afterByIdentity, document);
        }
      }

      prepareDiffLists(document);
      restoreFocusedTarget();
    } finally {
      applyingDiffDepth -= 1;
      isApplyingDiff = applyingDiffDepth > 0;
    }
  }

  async function applyStoredDiff() {
    if (!lastDiff) {
      return;
    }

    await applyDiff(lastDiff.entries, lastDiff.beforeBlocks, lastDiff.afterBlocks);
  }

  function scheduleDiffReapply() {
    clearDiffReapplyTimers();

    // Live apps sometimes finish one more render after the frame says it is
    // ready. Reapplying the stored diff restores inline code rows and table
    // cell marks if that late render replaces the highlighted DOM.
    for (const delayMs of [120, 500, 1500]) {
      diffReapplyTimers.push(setTimeout(() => {
        void applyStoredDiff();
      }, delayMs));
    }
  }

  function observeInteractiveMutations() {
    if (config.frameId !== "after") {
      return;
    }

    const target = document.body || document.documentElement;
    if (!target || typeof MutationObserver !== "function") {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      if (!lastDiff || isApplyingDiff) {
        return;
      }

      if (mutations.some(isAppContentMutation)) {
        scheduleInteractiveDiffReapply();
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function isAppContentMutation(mutation) {
    // Class and attribute changes are ignored on purpose. Diff focus pulses and
    // app visibility toggles should not cause a loop; changed text and replaced
    // rows are the cases where highlights need to be rebuilt.
    return mutation.type === "childList" || mutation.type === "characterData";
  }

  function scheduleInteractiveDiffReapply() {
    if (interactiveDiffReapplyTimer !== null) {
      clearTimeout(interactiveDiffReapplyTimer);
    }

    // A click handler may replace several nodes in one turn. Waiting briefly
    // lets the app finish that render, then the stored diff is applied once.
    interactiveDiffReapplyTimer = setTimeout(() => {
      interactiveDiffReapplyTimer = null;
      void applyStoredDiff();
    }, 80);
  }

  function clearDiffReapplyTimers() {
    for (const timer of diffReapplyTimers) {
      clearTimeout(timer);
    }

    diffReapplyTimers = [];
  }

  async function renderInlineDiff(entry, doc) {
    if (entry.kind === "table-row") {
      renderTableRowDiff(entry, doc);
      return;
    }

    if (entry.kind === "list-item") {
      renderListItemDiff(entry, doc);
      return;
    }

    if (entry.kind === "graphic") {
      await renderGraphicDiff(entry, doc);
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

  async function renderGraphicDiff(entry, doc) {
    entry.after.element.classList.remove("rhd-block-changed");

    const beforeParts = parseMermaidFlowchartParts(entry.before.rawText);
    const afterParts = parseMermaidFlowchartParts(entry.after.rawText);
    const mergedSource = buildMergedMermaidGraphSource(entry.before.rawText, entry.after.rawText, beforeParts, afterParts);

    if (mergedSource !== entry.after.rawText) {
      await renderMergedMermaidGraph(entry.after.element, mergedSource, entry.identity, doc);
    }

    clearGraphicDiffMarks(entry.after.element);
    renderSvgChartTextDiff(entry, doc);

    for (const node of afterParts.nodes.values()) {
      const beforeNode = beforeParts.nodes.get(node.id);
      if (!beforeNode) {
        markMermaidNode(entry.after.element, node.id, "added", node, null, doc);
      } else if (beforeNode.label !== node.label) {
        markMermaidNode(entry.after.element, node.id, "changed", node, beforeNode, doc);
      }
    }

    for (const node of beforeParts.nodes.values()) {
      if (!afterParts.nodes.has(node.id)) {
        markMermaidNode(entry.after.element, node.id, "removed", node, null, doc);
      }
    }

    for (const edge of afterParts.edges.values()) {
      if (!beforeParts.edges.has(edge.key)) {
        markMermaidEdge(entry.after.element, edge, "added");
      }
    }

    for (const edge of beforeParts.edges.values()) {
      if (!afterParts.edges.has(edge.key)) {
        markMermaidEdge(entry.after.element, edge, "removed");
      }
    }
  }

  function renderSvgChartTextDiff(entry, doc) {
    if (!entry.before.html || !entry.after.html || !entry.after.element.querySelector("svg")) {
      return false;
    }

    const beforeRoot = parseGraphicHtml(entry.before.html, doc);
    const expectedAfterRoot = parseGraphicHtml(entry.after.html, doc);
    if (!beforeRoot || !expectedAfterRoot) {
      return false;
    }

    const beforeLabels = collectSvgChartTextLabels(beforeRoot);
    const expectedAfterLabels = collectSvgChartTextLabels(expectedAfterRoot);
    const actualAfterLabels = collectSvgChartTextLabels(entry.after.element);
    if (
      beforeLabels.length === 0 ||
      beforeLabels.length !== expectedAfterLabels.length ||
      expectedAfterLabels.length !== actualAfterLabels.length
    ) {
      return false;
    }

    const changedLabels = [];
    for (let index = 0; index < actualAfterLabels.length; index += 1) {
      const beforeLabel = beforeLabels[index];
      const afterLabel = expectedAfterLabels[index];
      const actualLabel = actualAfterLabels[index];

      // Reset the rendered label first so repeated diff applications stay
      // idempotent even after a previous pass inserted tspans.
      actualLabel.element.textContent = afterLabel.text;
      actualLabel.element.classList.remove("rhd-svg-text-diff");
      if (Number.isFinite(afterLabel.x)) {
        actualLabel.element.setAttribute("x", formatSvgNumber(afterLabel.x));
      }
      if (Number.isFinite(afterLabel.y)) {
        actualLabel.element.setAttribute("y", formatSvgNumber(afterLabel.y));
      }

      if (beforeLabel.text === afterLabel.text) {
        continue;
      }

      changedLabels.push({
        element: actualLabel.element,
        beforeText: beforeLabel.text,
        afterText: afterLabel.text,
        x: afterLabel.x,
        y: afterLabel.y
      });
    }

    layoutSvgTextDiffLabels(changedLabels);
    for (const label of changedLabels) {
      renderSvgTextDiff(label.element, label.beforeText, label.afterText, doc);
    }

    return changedLabels.length > 0;
  }

  function parseGraphicHtml(html, doc) {
    const template = doc.createElement("template");
    template.innerHTML = String(html || "").trim();
    return template.content.firstElementChild;
  }

  function collectSvgChartTextLabels(root) {
    return Array.from(root.querySelectorAll("svg text"))
      .filter(isDiffableSvgChartText)
      .map((element) => ({
        element,
        text: normalizeText(svgTextContent(element)),
        x: svgTextCoordinate(element, "x"),
        y: svgTextCoordinate(element, "y")
      }))
      .filter((label) => label.text !== "");
  }

  function isDiffableSvgChartText(element) {
    const className = String(element.getAttribute("class") || "");
    return !hasClassName(className, "chart-title") &&
      !hasClassName(className, "chart-subtitle") &&
      !hasClassName(className, "axis");
  }

  function hasClassName(className, expected) {
    return className.split(/\s+/).includes(expected);
  }

  function svgTextContent(element) {
    const tspans = Array.from(element.querySelectorAll("tspan"));
    if (tspans.length === 0) {
      return element.textContent || "";
    }

    return tspans.map((tspan) => tspan.textContent || "").join(" ");
  }

  function svgTextCoordinate(element, name) {
    const ownValue = Number.parseFloat(element.getAttribute(name) || "");
    if (Number.isFinite(ownValue)) {
      return ownValue;
    }

    const firstTspan = element.querySelector("tspan");
    const tspanValue = Number.parseFloat(firstTspan?.getAttribute(name) || "");
    return Number.isFinite(tspanValue) ? tspanValue : Number.NaN;
  }

  function layoutSvgTextDiffLabels(changedLabels) {
    const placedLabels = [];
    const orderedLabels = changedLabels
      .filter((label) => Number.isFinite(label.x) && Number.isFinite(label.y))
      .sort((left, right) => left.y - right.y || left.x - right.x);

    for (const label of orderedLabels) {
      let nextY = label.y;

      for (const placed of placedLabels) {
        if (Math.abs(placed.x - label.x) > SVG_TEXT_DIFF_COLUMN_TOLERANCE) {
          continue;
        }

        if (nextY < placed.bottom) {
          nextY = placed.bottom;
        }
      }

      label.y = nextY;
      label.element.setAttribute("y", formatSvgNumber(nextY));
      placedLabels.push({
        x: label.x,
        bottom: nextY + SVG_TEXT_DIFF_PAIR_HEIGHT
      });
    }
  }

  function formatSvgNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }

  function renderSvgTextDiff(textElement, beforeText, afterText, doc) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const firstTspan = textElement.querySelector("tspan");
    const x = textElement.getAttribute("x") || firstTspan?.getAttribute("x") || "";
    const y = textElement.getAttribute("y") || firstTspan?.getAttribute("y") || "";
    const removed = doc.createElementNS(svgNamespace, "tspan");
    const added = doc.createElementNS(svgNamespace, "tspan");

    textElement.classList.add("rhd-svg-text-diff");
    textElement.textContent = "";

    removed.classList.add("rhd-svg-text-removed");
    removed.textContent = beforeText;
    added.classList.add("rhd-svg-text-added");
    added.textContent = afterText;

    if (x) {
      removed.setAttribute("x", x);
      added.setAttribute("x", x);
    }
    if (y) {
      removed.setAttribute("y", y);
    }
    added.setAttribute("dy", "1.15em");

    textElement.append(removed, added);
  }

  function clearGraphicDiffMarks(root) {
    root.querySelectorAll(".rhd-graphic-node-added, .rhd-graphic-node-changed, .rhd-graphic-node-removed, .rhd-graphic-edge-added, .rhd-graphic-edge-removed, .rhd-graphic-node-inline-diff, .rhd-svg-text-diff, .rhd-svg-text-removed, .rhd-svg-text-added").forEach((node) => {
      node.classList.remove("rhd-graphic-node-added", "rhd-graphic-node-changed", "rhd-graphic-node-removed", "rhd-graphic-edge-added", "rhd-graphic-edge-removed", "rhd-graphic-node-inline-diff", "rhd-svg-text-diff", "rhd-svg-text-removed", "rhd-svg-text-added");
    });
    root.querySelectorAll(".rhd-graphic-node-diff").forEach((node) => node.remove());
  }

  async function renderMergedMermaidGraph(root, source, identity, doc) {
    const mermaid = window.mermaid;
    if (!mermaid || !mermaid.render) {
      return false;
    }

    if (root.getAttribute("data-rhd-merged-graphic-source") === source && root.querySelector("svg")) {
      return true;
    }

    try {
      const renderId = "rhd-mermaid-merged-" + fingerprint(identity + ":" + source);
      const result = await mermaid.render(renderId, source);
      root.innerHTML = result.svg;
      root.setAttribute("data-rhd-merged-graphic-source", source);
      normalizeMermaidSvgLabels(root, doc);
      return true;
    } catch (error) {
      root.setAttribute("data-rhd-render-error", error && error.message ? error.message : "Merged Mermaid render failed");
      return false;
    }
  }

  function buildMergedMermaidGraphSource(beforeSource, afterSource, beforeParts, afterParts) {
    const mergedLines = [];

    for (const node of afterParts.nodes.values()) {
      const beforeNode = beforeParts.nodes.get(node.id);
      if (beforeNode && beforeNode.label !== node.label) {
        mergedLines.push(formatMermaidNode(node.id, nodeDiffLayoutLabel(beforeNode.label, node.label), node));
      }
    }

    for (const node of beforeParts.nodes.values()) {
      if (!afterParts.nodes.has(node.id)) {
        mergedLines.push(formatMermaidNode(node.id, escapeMermaidLabel(node.label), node));
      }
    }

    for (const edge of beforeParts.edges.values()) {
      if (!afterParts.edges.has(edge.key)) {
        mergedLines.push(formatMermaidEdge(edge));
      }
    }

    if (mergedLines.length === 0) {
      return afterSource;
    }

    // The after graph remains the base document. We append changed labels,
    // deleted nodes, and deleted edges so Mermaid can calculate one coherent
    // graph layout before we apply red, green, and inline-diff styling.
    return [
      afterSource.trimEnd(),
      "",
      "  %% rendered-html-diff merged graph context",
      ...uniqueLines(mergedLines)
    ].join("\n");
  }

  function formatMermaidNode(nodeId, escapedLabel, node) {
    const shape = mermaidNodeShape(node);
    return "  " + nodeId + shape.open + "\"" + escapedLabel + "\"" + shape.close;
  }

  function formatMermaidEdge(edge) {
    return "  " + edge.from + " --> " + edge.to;
  }

  function nodeDiffLayoutLabel(beforeLabel, afterLabel) {
    return escapeMermaidLabel(beforeLabel) + "&lt;br/&gt;" + escapeMermaidLabel(afterLabel);
  }

  function escapeMermaidLabel(label) {
    return String(label)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mermaidNodeShape(node) {
    return node.shape || { open: "[", close: "]" };
  }

  function uniqueLines(lines) {
    const seen = new Set();
    const unique = [];
    for (const line of lines) {
      if (!seen.has(line)) {
        seen.add(line);
        unique.push(line);
      }
    }
    return unique;
  }

  function parseMermaidFlowchartParts(source) {
    const nodes = new Map();
    const edges = new Map();
    const lines = source.replace(/\r\n/g, "\n").split("\n");

    for (const line of lines) {
      const cleaned = line.replace(/%%.*$/, "").trim();
      if (!cleaned || /^(flowchart|graph|classDef|class|style|linkStyle|subgraph|end)\b/.test(cleaned)) {
        continue;
      }

      for (const node of parseMermaidNodesFromLine(cleaned)) {
        nodes.set(node.id, node);
      }

      for (const edge of parseMermaidEdgesFromLine(cleaned)) {
        edges.set(edge.key, edge);
      }
    }

    return { nodes, edges };
  }

  function parseMermaidNodesFromLine(line) {
    const nodes = [];
    const nodePattern = /\b([A-Za-z][\w-]*)\s*(\[[^\]]+\]|\{[^}]+\}|\([^)]+\))/g;
    let match;

    while ((match = nodePattern.exec(line))) {
      const rawLabel = match[2].slice(1, -1).trim();
      nodes.push({
        id: match[1],
        label: cleanMermaidLabel(rawLabel),
        shape: {
          open: match[2][0],
          close: match[2][match[2].length - 1]
        }
      });
    }

    return nodes;
  }

  function parseMermaidEdgesFromLine(line) {
    if (!/(--|==|-\.)/.test(line)) {
      return [];
    }

    const edgeLine = line.replace(/\b([A-Za-z][\w-]*)\s*(\[[^\]]+\]|\{[^}]+\}|\([^)]+\))/g, "$1");
    const ids = edgeLine.match(/\b[A-Za-z][\w-]*\b/g) || [];
    const edges = [];

    for (let index = 0; index < ids.length - 1; index += 1) {
      const from = ids[index];
      const to = ids[index + 1];
      const key = from + "->" + to;
      edges.push({ from, to, key });
    }

    return edges;
  }

  function cleanMermaidLabel(label) {
    return label
      .replace(/^["']|["']$/g, "")
      .replace(/&amp;lt;br\s*\/?&amp;gt;/gi, " ")
      .replace(/&lt;br\s*\/?&gt;/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/&lt;\/?(?:p|span|div)[^&]*&gt;/gi, "")
      .replace(/<\/?(?:p|span|div)[^>]*>/gi, "")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  function markMermaidNode(root, nodeId, status, node, beforeNode, doc) {
    const target = findMermaidNode(root, nodeId, node ? node.label : "");
    if (!target) {
      return;
    }

    target.classList.add("rhd-graphic-node-" + status);
    if (status === "changed" && beforeNode && node) {
      replaceMermaidNodeLabelWithDiff(target, beforeNode.label, node.label, doc);
    }
  }

  function markMermaidEdge(root, edge, status) {
    for (const target of findMermaidEdges(root, edge)) {
      target.classList.add("rhd-graphic-edge-" + status);
    }
  }

  function findMermaidNode(root, nodeId, label) {
    const candidates = Array.from(root.querySelectorAll("g")).filter(isMermaidNodeGroup);
    return candidates.find((candidate) => {
      const id = candidate.getAttribute("id") || "";
      const text = normalizeText(candidate.textContent || "");
      return id.includes("flowchart-" + nodeId + "-") ||
        id === nodeId ||
        candidate.getAttribute("data-id") === nodeId ||
        (label && text.includes(label));
    }) || null;
  }

  function isMermaidNodeGroup(candidate) {
    const classTokens = String(candidate.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    const id = candidate.getAttribute("id") || "";
    return classTokens.includes("node") ||
      candidate.hasAttribute("data-id") ||
      /^flowchart-[A-Za-z][\w-]*-\d+$/.test(id);
  }

  function findMermaidEdges(root, edge) {
    const candidates = Array.from(root.querySelectorAll("path, line, polyline, g.edgePath, g.edgeLabel"));
    return candidates.filter((candidate) => {
      const id = candidate.getAttribute("id") || "";
      const className = String(candidate.getAttribute("class") || "");
      return (className.includes("LS-" + edge.from) && className.includes("LE-" + edge.to)) ||
        id.includes(edge.from + "-" + edge.to) ||
        id.includes(edge.from + "_" + edge.to);
    });
  }

  function replaceMermaidNodeLabelWithDiff(nodeElement, beforeLabel, afterLabel, doc) {
    const labelElement = findMermaidNodeLabelElement(nodeElement);
    if (!labelElement) {
      return;
    }

    labelElement.classList.add("rhd-graphic-node-inline-diff");
    labelElement.textContent = "";
    renderMermaidLabelLines(labelElement, [
      { text: beforeLabel, className: "rhd-graphic-diff-removed" },
      { text: afterLabel, className: "rhd-graphic-diff-added" }
    ], doc);
  }

  function findMermaidNodeLabelElement(nodeElement) {
    const textElement = nodeElement.querySelector("text");
    if (textElement) {
      return textElement;
    }

    return nodeElement.querySelector(".nodeLabel, [class*='nodeLabel']");
  }

  function renderListItemDiff(entry, doc) {
    const target = findListItemBody(entry.after.element) || entry.after.element;
    target.textContent = "";
    target.append(renderWordDiffFragment(entry.before.text, entry.after.text, doc));
  }

  function renderTableRowDiff(entry, doc) {
    const beforeCells = entry.before.cellTexts || [];
    const expectedAfterCells = entry.after.cellTexts || [];
    const afterCells = Array.from(entry.after.element.children);

    for (let index = 0; index < afterCells.length; index += 1) {
      const afterCell = afterCells[index];
      const beforeText = beforeCells[index] || "";
      const afterText = expectedAfterCells[index] || normalizeText(afterCell.textContent || "");

      if (beforeText === afterText) {
        continue;
      }

      afterCell.classList.add("rhd-table-cell-changed");
      afterCell.textContent = "";
      afterCell.append(renderWordDiffFragment(beforeText, afterText, doc));
    }
  }

  function signForSegment(type) {
    // Code diffs use the familiar left gutter from source-control tools:
    // plus for inserted lines, minus for removed lines, and a blank for context.
    if (type === "added") {
      return "+";
    }
    if (type === "removed") {
      return "-";
    }
    return " ";
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
    placeholder.setAttribute("data-rhd-status", "-");

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
      const template = doc.createElement("template");
      template.innerHTML = "<table><tbody>" + (block.html || "") + "</tbody></table>";
      const row = template.content.querySelector("tr");
      if (row) {
        body.append(row.cloneNode(true));
      }
      table.append(body);
      placeholder.append(table);
      return placeholder;
    }

    const template = doc.createElement("template");
    template.innerHTML = (block.html || "").trim();
    const clone = template.content.firstElementChild || doc.createElement(block.tagName || "div");
    clone.classList.add("rhd-removed-clone");
    clone.removeAttribute("data-rhd-identity");
    if (!clone.textContent) {
      clone.textContent = block.text;
    }
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
    const items = Array.from(list.children).filter((child) => child.tagName && child.tagName.toLowerCase() === "li");
    let orderedValue = Number.parseInt(list.getAttribute("start") || "1", 10);

    if (!Number.isFinite(orderedValue)) {
      orderedValue = 1;
    }

    for (const item of items) {
      if (item.classList.contains("rhd-list-item-ready") && findListItemBody(item)) {
        continue;
      }

      const explicitValue = Number.parseInt(item.getAttribute("value") || "", 10);
      if (Number.isFinite(explicitValue)) {
        orderedValue = explicitValue;
      }

      unwrapListItemContents(item);

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

  function unwrapListItemContents(item) {
    const marker = findListItemMarker(item);
    const body = findListItemBody(item);

    if (marker) {
      marker.remove();
    }

    if (body) {
      while (body.firstChild) {
        item.append(body.firstChild);
      }
      body.remove();
    }

    item.classList.remove("rhd-list-item-ready");
  }

  function findListItemMarker(item) {
    return Array.from(item.children).find((child) => child.classList && child.classList.contains("rhd-list-marker")) || null;
  }

  function findListItemBody(item) {
    return Array.from(item.children).find((child) => child.classList && child.classList.contains("rhd-list-body")) || null;
  }

  async function focusIdentity(identity) {
    focusedIdentity = identity;
    // Reapplying the diff rebuilds deleted placeholders. Wait for that work
    // to finish so sidebar clicks can focus deleted charts, text, and rows.
    await applyStoredDiff();
    const target = findRenderedTarget(identity);
    scheduleDiffReapply();

    if (!target) {
      clearFocusedTargets();
      return;
    }

    const customFocus = window.__renderedHtmlDiffFocus;
    if (typeof customFocus === "function") {
      customFocus(identity, target);
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    applyFocusMarker(target);
  }

  function clearFocusedTargets() {
    // The sidebar represents one selected change at a time. Clearing the old
    // focus marker keeps the blue navigation halo from looking like a diff.
    for (const focusedTarget of document.querySelectorAll(".rhd-focus-pulse")) {
      focusedTarget.classList.remove("rhd-focus-pulse");
      focusedTarget.classList.remove("rhd-text-focus-box");
    }
  }

  function restoreFocusedTarget() {
    if (!focusedIdentity) {
      return;
    }

    const target = findRenderedTarget(focusedIdentity);
    if (target) {
      applyFocusMarker(target);
    }
  }

  function applyFocusMarker(target) {
    clearFocusedTargets();
    if (shouldUseTextFocusBox(target)) {
      target.classList.add("rhd-text-focus-box");
    }
    void target.offsetWidth;
    target.classList.add("rhd-focus-pulse");
  }

  function shouldUseTextFocusBox(target) {
    return TEXT_FOCUS_TAGS.has(target.tagName.toLowerCase());
  }

  function findRenderedTarget(identity) {
    const candidates = Array.from(document.querySelectorAll("[data-rhd-identity], [data-rhd-placeholder-for]"));
    return candidates.find((element) => {
      return element.getAttribute("data-rhd-identity") === identity ||
        element.getAttribute("data-rhd-placeholder-for") === identity;
    }) || null;
  }

  function injectHighlightStyles(doc) {
    if (doc.getElementById("rhd-highlight-style")) {
      return;
    }

    const style = doc.createElement("style");
    style.id = "rhd-highlight-style";
    style.textContent = [
      ".rhd-block-added, .rhd-block-changed { box-sizing: border-box !important; border-radius: 4px !important; outline-offset: 2px !important; transition: box-shadow 160ms ease, outline-color 160ms ease !important; }",
      '.rhd-block-added, [data-rhd-status="+"] { --rhd-marker-color: #2da44e; --rhd-block-bg: #dafbe1; --rhd-outline-color: rgba(45, 164, 78, 0.7); --rhd-halo-color: rgba(45, 164, 78, 0.16); --rhd-focus-ring-color: rgba(45, 164, 78, 0.28); }',
      '.rhd-block-changed, [data-rhd-status="~"] { --rhd-marker-color: #9a6700; --rhd-block-bg: #fff8c5; --rhd-outline-color: rgba(154, 103, 0, 0.65); --rhd-halo-color: rgba(154, 103, 0, 0.18); --rhd-focus-ring-color: rgba(154, 103, 0, 0.28); }',
      '.rhd-removed-block, [data-rhd-status="-"] { --rhd-marker-color: #cf222e; --rhd-focus-ring-color: rgba(207, 34, 46, 0.28); }',
      ".rhd-block-added:not(pre):not(tr), .rhd-block-changed:not(pre):not(tr) { max-width: 100% !important; overflow-wrap: anywhere !important; background: var(--rhd-block-bg) !important; outline: 1px solid var(--rhd-outline-color) !important; box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; padding-left: max(10px, 0.65em) !important; padding-right: 6px !important; }",
      ".rhd-diff-list { padding-left: 0 !important; list-style: none !important; counter-reset: rhd-list-item !important; }",
      ".rhd-diff-list > li { display: grid !important; grid-template-columns: 2.35em minmax(0, 1fr) !important; column-gap: 0.45em !important; align-items: baseline !important; list-style: none !important; padding-left: 0 !important; }",
      ".rhd-list-marker { grid-column: 1 !important; text-align: right !important; color: inherit !important; font-variant-numeric: tabular-nums !important; user-select: none !important; }",
      ".rhd-list-body { grid-column: 2 !important; min-width: 0 !important; overflow-wrap: anywhere !important; }",
      "li.rhd-block-added:not(pre):not(tr), li.rhd-block-changed:not(pre):not(tr), li.rhd-removed-list-item { padding-left: 0 !important; }",
      "pre.rhd-block-added { border-color: var(--rhd-outline-color) !important; outline: 2px solid var(--rhd-outline-color) !important; box-shadow: inset 6px 0 0 var(--rhd-marker-color), 0 0 0 3px var(--rhd-halo-color) !important; overflow-x: auto !important; }",
      "pre.rhd-block-changed { border-color: var(--rhd-outline-color) !important; outline: 0 !important; box-shadow: none !important; overflow-x: auto !important; }",
      "tr.rhd-block-added, tr.rhd-block-changed { background: transparent !important; outline: 0 !important; box-shadow: none !important; }",
      "tr.rhd-block-added > th, tr.rhd-block-added > td { background: #dafbe1 !important; }",
      "tr.rhd-block-changed > th, tr.rhd-block-changed > td { background: #fff8c5 !important; }",
      "tr.rhd-block-added > :first-child, tr.rhd-block-changed > :first-child { box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; padding-left: 14px !important; }",
      ".rhd-table-cell-changed { background: #fff1a6 !important; box-shadow: inset 0 0 0 2px rgba(154, 103, 0, 0.45) !important; outline: 1px solid rgba(154, 103, 0, 0.35) !important; outline-offset: -1px !important; }",
      "mark.rhd-added-token { background: #aceebb !important; color: #116329 !important; border-radius: 3px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; padding: 0 2px !important; overflow-wrap: anywhere !important; }",
      "del.rhd-removed-token { background: #ffd7d5 !important; color: #82071e !important; border-radius: 3px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; padding: 0 2px !important; text-decoration: line-through !important; overflow-wrap: anywhere !important; }",
      ".rhd-removed-block { box-sizing: border-box !important; max-width: 100% !important; margin: 14px 0 !important; border: 1px solid rgba(207, 34, 46, 0.6) !important; border-left-width: 4px !important; border-radius: 6px !important; background: #ffebe9 !important; padding: 10px 12px !important; color: #82071e !important; overflow-wrap: anywhere !important; }",
      "li.rhd-removed-block { --rhd-marker-color: #cf222e; margin: 6px 0 !important; border: 1px solid rgba(207, 34, 46, 0.6) !important; border-radius: 4px !important; background: #ffebe9 !important; box-shadow: inset 4px 0 0 #cf222e !important; color: #82071e !important; padding: 0 !important; }",
      ".rhd-removed-label { display: inline-block !important; margin-bottom: 6px !important; color: #82071e !important; font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif !important; text-transform: uppercase !important; }",
      ".rhd-removed-block p { margin: 0 !important; }",
      ".rhd-removed-clone { margin: 0 !important; color: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-removed-clone.graph-panel, .rhd-removed-clone svg { width: 100% !important; max-width: 100% !important; }",
      ".rhd-removed-clone svg { opacity: 0.72 !important; filter: sepia(0.35) saturate(1.25) hue-rotate(310deg) !important; }",
      ".rhd-removed-clone svg text { fill: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-mermaid-rendered { max-width: 100% !important; overflow-x: auto !important; }",
      ".rhd-mermaid-rendered svg { display: block !important; width: 100% !important; max-width: 100% !important; height: auto !important; }",
      ".rhd-graphic-node-added rect, .rhd-graphic-node-added polygon, .rhd-graphic-node-added circle, .rhd-graphic-node-added ellipse, .rhd-graphic-node-added path { stroke: #2da44e !important; stroke-width: 3px !important; fill: #dafbe1 !important; }",
      ".rhd-graphic-node-changed rect, .rhd-graphic-node-changed polygon, .rhd-graphic-node-changed circle, .rhd-graphic-node-changed ellipse, .rhd-graphic-node-changed path { stroke: #9a6700 !important; stroke-width: 3px !important; fill: #fff8c5 !important; }",
      ".rhd-graphic-edge-added, .rhd-graphic-edge-added path, .rhd-graphic-edge-added line, .rhd-graphic-edge-added polyline { stroke: #2da44e !important; stroke-width: 3px !important; }",
      ".rhd-graphic-edge-removed, .rhd-graphic-edge-removed path, .rhd-graphic-edge-removed line, .rhd-graphic-edge-removed polyline { stroke: #cf222e !important; stroke-width: 3px !important; stroke-dasharray: 7 5 !important; }",
      ".rhd-graphic-node-diff { font: 700 11px/1 ui-sans-serif, system-ui, sans-serif !important; pointer-events: none !important; paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; }",
      ".rhd-graphic-node-inline-diff { paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; }",
      ".rhd-graphic-node-removed rect { fill: #ffebe9 !important; stroke: #cf222e !important; stroke-width: 2px !important; }",
      ".rhd-graphic-node-removed text, .rhd-graphic-node-removed tspan, .rhd-graphic-node-removed .nodeLabel { color: #82071e !important; fill: #82071e !important; paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; text-decoration: line-through !important; }",
      ".rhd-graphic-diff-removed { color: #82071e !important; fill: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-graphic-diff-added { color: #116329 !important; fill: #116329 !important; }",
      ".rhd-svg-text-diff { paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; }",
      ".rhd-svg-text-removed { color: #82071e !important; fill: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-svg-text-added { color: #116329 !important; fill: #116329 !important; }",
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
      "[data-rhd-status].rhd-focus-pulse:not(pre):not(tr) { box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px var(--rhd-focus-ring-color, rgba(9, 105, 218, 0.28)) !important; }",
      ".rhd-focus-pulse.rhd-text-focus-box { display: block !important; width: 100% !important; max-width: none !important; box-sizing: border-box !important; border-radius: 6px !important; box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px var(--rhd-focus-ring-color, rgba(9, 105, 218, 0.28)) !important; }",
      ".rhd-focus-pulse { box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px var(--rhd-focus-ring-color, rgba(9, 105, 218, 0.28)) !important; }"
    ].join("\n");

    doc.head.append(style);
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

  function labelForBlock(text, headingPath, displayKey, kind) {
    if (kind === "graphic") {
      const sectionTitle = headingPath[headingPath.length - 1];
      return sectionTitle ? sectionTitle + " diagram" : displayKey + " diagram";
    }

    return text.length <= 96 ? text : displayKey + ": " + text.slice(0, 93).trimEnd() + "...";
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

function viewerScript(): string {
  return String.raw`(() => {
  const dataNode = document.getElementById("rhd-data");
  const data = JSON.parse(dataNode.textContent);
  const shell = document.querySelector(".rhd-shell");
  const beforeIframe = document.getElementById("rhd-before-preview");
  const iframe = document.getElementById("rhd-preview");
  const sidebarToggle = document.getElementById("rhd-sidebar-toggle");
  const sidebarResizer = document.getElementById("rhd-sidebar-resizer");
  const changeList = document.getElementById("rhd-change-list");
  const filePair = document.getElementById("rhd-file-pair");
  const generated = document.getElementById("rhd-generated");
  const addedCount = document.getElementById("rhd-added-count");
  const changedCount = document.getElementById("rhd-changed-count");
  const removedCount = document.getElementById("rhd-removed-count");
  const mermaidRuntime = document.getElementById("rhd-mermaid-runtime").textContent || "";
  const frameBridge = document.getElementById("rhd-frame-bridge").textContent || "";
  const frameToken = data.generatedAt + ":" + Math.random().toString(36).slice(2);
  const SIDEBAR_MIN_WIDTH = 280;
  const SIDEBAR_MAX_WIDTH = 560;
  const SIDEBAR_DEFAULT_WIDTH = 360;
  const TEXT_FOCUS_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li"]);
  const frameBlocks = {
    before: null,
    after: null
  };

  filePair.textContent = "";
  const beforeStrong = document.createElement("strong");
  beforeStrong.textContent = data.beforePath;
  const afterStrong = document.createElement("strong");
  afterStrong.textContent = data.afterPath;
  filePair.append(beforeStrong, document.createTextNode(" to "), afterStrong);
  generated.textContent = "Generated " + new Date(data.generatedAt).toLocaleString();
  setupSidebarToggle();
  setupSidebarResize();

  window.addEventListener("message", handleFrameMessage);
  beforeIframe.srcdoc = createFrameHtml(data.beforeHtml, "before");
  iframe.srcdoc = createFrameHtml(data.afterHtml, "after");

  function setupSidebarToggle() {
    if (!shell || !sidebarToggle) {
      return;
    }

    setSidebarCollapsed(false);
    sidebarToggle.addEventListener("click", () => {
      setSidebarCollapsed(!shell.classList.contains("rhd-sidebar-collapsed"));
    });
  }

  function setSidebarCollapsed(collapsed) {
    shell.classList.toggle("rhd-sidebar-collapsed", collapsed);
    // Keep the expanded state available to assistive technology users.
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    sidebarToggle.setAttribute("title", collapsed ? "Expand sidebar" : "Collapse sidebar");
    if (sidebarResizer) {
      sidebarResizer.setAttribute("aria-hidden", String(collapsed));
      sidebarResizer.tabIndex = collapsed ? -1 : 0;
    }
  }

  function setupSidebarResize() {
    if (!shell || !sidebarResizer) {
      return;
    }

    setSidebarWidth(readSidebarWidth());
    sidebarResizer.addEventListener("pointerdown", startSidebarResize);
    sidebarResizer.addEventListener("keydown", handleSidebarResizeKeydown);
  }

  function startSidebarResize(event) {
    if (shell.classList.contains("rhd-sidebar-collapsed")) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = readSidebarWidth();
    shell.classList.add("rhd-sidebar-resizing");

    if (typeof sidebarResizer.setPointerCapture === "function") {
      sidebarResizer.setPointerCapture(event.pointerId);
    }

    const handlePointerMove = (moveEvent) => {
      setSidebarWidth(startWidth + moveEvent.clientX - startX);
    };

    const stopSidebarResize = () => {
      shell.classList.remove("rhd-sidebar-resizing");
      sidebarResizer.removeEventListener("pointermove", handlePointerMove);
      sidebarResizer.removeEventListener("pointerup", stopSidebarResize);
      sidebarResizer.removeEventListener("pointercancel", stopSidebarResize);
      if (typeof sidebarResizer.releasePointerCapture === "function") {
        sidebarResizer.releasePointerCapture(event.pointerId);
      }
    };

    sidebarResizer.addEventListener("pointermove", handlePointerMove);
    sidebarResizer.addEventListener("pointerup", stopSidebarResize);
    sidebarResizer.addEventListener("pointercancel", stopSidebarResize);
  }

  function handleSidebarResizeKeydown(event) {
    if (shell.classList.contains("rhd-sidebar-collapsed")) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const step = event.shiftKey ? 32 : 16;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setSidebarWidth(readSidebarWidth() + direction * step);
  }

  function setSidebarWidth(width) {
    const nextWidth = clampSidebarWidth(width);
    shell.style.setProperty("--rhd-sidebar-width", nextWidth + "px");
    if (sidebarResizer) {
      sidebarResizer.setAttribute("aria-valuenow", String(nextWidth));
    }
  }

  function readSidebarWidth() {
    const customWidth = Number.parseFloat(shell.style.getPropertyValue("--rhd-sidebar-width"));
    if (Number.isFinite(customWidth)) {
      return customWidth;
    }

    const currentWidth = document.getElementById("rhd-sidebar-panel")?.getBoundingClientRect().width;
    return Number.isFinite(currentWidth) && currentWidth > 0 ? currentWidth : SIDEBAR_DEFAULT_WIDTH;
  }

  function clampSidebarWidth(width) {
    return Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)));
  }

  function handleFrameMessage(event) {
    const message = event.data;
    if (!message || message.source !== "rendered-html-diff" || message.token !== frameToken) {
      return;
    }

    if (message.type === "frame-error") {
      renderFailure(message.message || "The report viewer failed while preparing the rendered diff.");
      return;
    }

    if (message.type !== "blocks" || (message.frameId !== "before" && message.frameId !== "after")) {
      return;
    }

    frameBlocks[message.frameId] = message.blocks || [];
    if (frameBlocks.before && frameBlocks.after) {
      renderLiveDiff();
    }
  }

  function renderLiveDiff() {
    try {
      const beforeBlocks = frameBlocks.before;
      const afterBlocks = frameBlocks.after;
      const entries = diffBlocks(beforeBlocks, afterBlocks);
      postToAfterFrame({
        type: "apply-diff",
        entries: serializeEntries(entries),
        beforeBlocks,
        afterBlocks
      });
      renderSidebar(entries);
    } catch (error) {
      console.error(error);
      renderFailure("The report viewer failed while preparing the rendered diff.");
    }
  }

  function serializeEntries(entries) {
    return entries.map((entry) => ({
      identity: entry.identity,
      status: entry.status,
      kind: entry.kind,
      before: entry.before || null,
      after: entry.after || null
    }));
  }

  function postToAfterFrame(message) {
    iframe.contentWindow?.postMessage({
      source: "rendered-html-diff",
      token: frameToken,
      ...message
    }, "*");
  }

  function createFrameHtml(html, frameId) {
    const configScript = "window.__rhdBridgeConfig = " + JSON.stringify({
      token: frameToken,
      frameId
    }) + ";";
    const injection = [
      scriptTag(mermaidRuntime),
      scriptTag(configScript),
      scriptTag(frameBridge)
    ].join("\n");

    // Source editors often display literal HTML such as "</body>". Insert at
    // the final document close so trusted bridge code never lands in visible text.
    const bodyCloseIndex = findLastCaseInsensitive(html, "</body>");
    if (bodyCloseIndex !== -1) {
      return html.slice(0, bodyCloseIndex) + injection + "\n" + html.slice(bodyCloseIndex);
    }

    const htmlCloseIndex = findLastCaseInsensitive(html, "</html>");
    if (htmlCloseIndex !== -1) {
      return html.slice(0, htmlCloseIndex) + injection + "\n" + html.slice(htmlCloseIndex);
    }

    return html + "\n" + injection;
  }

  function findLastCaseInsensitive(value, needle) {
    return value.toLowerCase().lastIndexOf(needle.toLowerCase());
  }

  function scriptTag(source) {
    return "<script>" + source.replace(/<\/script/gi, "<\\/script") + "<\/script>";
  }

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

    if (entry.kind === "list-item") {
      renderListItemDiff(entry, doc);
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

  function renderListItemDiff(entry, doc) {
    const target = findListItemBody(entry.after.element) || entry.after.element;
    target.textContent = "";
    target.append(renderWordDiffFragment(entry.before.text, entry.after.text, doc));
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
    placeholder.setAttribute("data-rhd-status", "-");

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
      if (item.classList.contains("rhd-list-item-ready") && findListItemBody(item)) {
        continue;
      }

      const explicitValue = Number.parseInt(item.getAttribute("value") || "", 10);
      if (Number.isFinite(explicitValue)) {
        orderedValue = explicitValue;
      }

      unwrapListItemContents(item);

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

  function unwrapListItemContents(item) {
    const marker = findListItemMarker(item);
    const body = findListItemBody(item);

    if (marker) {
      marker.remove();
    }

    if (body) {
      while (body.firstChild) {
        item.append(body.firstChild);
      }
      body.remove();
    }

    item.classList.remove("rhd-list-item-ready");
  }

  function findListItemMarker(item) {
    return Array.from(item.children).find((child) => child.classList && child.classList.contains("rhd-list-marker")) || null;
  }

  function findListItemBody(item) {
    return Array.from(item.children).find((child) => child.classList && child.classList.contains("rhd-list-body")) || null;
  }

  function renderSidebar(entries) {
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

    for (const group of groupSidebarEntriesBySection(changedEntries)) {
      changeList.append(renderSidebarSection(group));
    }
  }

  function groupSidebarEntriesBySection(entries) {
    const groups = [];
    const groupsByTitle = new Map();

    for (const entry of entries) {
      const sectionTitle = sectionTitleForEntry(entry);
      let group = groupsByTitle.get(sectionTitle);

      if (!group) {
        group = {
          title: sectionTitle,
          counts: { added: 0, changed: 0, removed: 0 },
          entries: []
        };
        groupsByTitle.set(sectionTitle, group);
        groups.push(group);
      }

      group.entries.push(entry);
      if (typeof group.counts[entry.status] === "number") {
        group.counts[entry.status] += 1;
      }
    }

    return groups;
  }

  function sectionTitleForEntry(entry) {
    const block = entry.after || entry.before;
    if (!block) {
      return "Document start";
    }

    // The heading path is collected from rendered content, so the sidebar can
    // organize rows around document sections instead of raw DOM order.
    const sectionTitle = block.headingPath.length > 0 ? block.headingPath.join(" / ") : "Document start";
    return sectionTitle;
  }

  function renderSidebarSection(group) {
    const section = document.createElement("section");
    section.className = "rhd-change-section";

    const header = document.createElement("div");
    header.className = "rhd-change-section-header";

    const title = document.createElement("span");
    title.className = "rhd-change-section-title";
    title.textContent = group.title;

    const counts = document.createElement("span");
    counts.className = "rhd-change-section-counts";
    counts.textContent = formatSectionCounts(group.counts);

    header.append(title, counts);
    section.append(header);

    for (const entry of group.entries) {
      section.append(renderSidebarEntry(entry));
    }

    return section;
  }

  function renderSidebarEntry(entry) {
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
    title.textContent = sidebarTitleForEntry(entry);

    const meta = document.createElement("span");
    meta.className = "rhd-change-meta";
    meta.textContent = statusLabel(entry.status) + " " + readableKind(entry.kind) + " - " + entry.identity.replace(/^(key|section|fallback):/, "");

    const fullLabel = title.textContent + "\n" + meta.textContent;
    button.setAttribute("aria-label", title.textContent + ". " + meta.textContent);
    main.append(title, meta);
    button.append(badge, main);
    button.addEventListener("mouseenter", () => setSidebarItemExpanded(button, true));
    button.addEventListener("pointerenter", () => setSidebarItemExpanded(button, true));
    button.addEventListener("focus", () => setSidebarItemExpanded(button, true));
    button.addEventListener("mouseleave", () => setSidebarItemExpanded(button, false));
    button.addEventListener("pointerleave", () => setSidebarItemExpanded(button, false));
    button.addEventListener("blur", () => setSidebarItemExpanded(button, false));
    button.addEventListener("click", () => {
      setSidebarItemExpanded(button, true);
      postToAfterFrame({
        type: "focus",
        identity: entry.identity
      });
    });

    return button;
  }

  function formatSectionCounts(counts) {
    const parts = [];
    if (counts.added > 0) {
      parts.push("+" + counts.added);
    }
    if (counts.changed > 0) {
      parts.push("~" + counts.changed);
    }
    if (counts.removed > 0) {
      parts.push("-" + counts.removed);
    }
    return parts.length > 0 ? parts.join(" ") : "0";
  }

  function sidebarTitleForEntry(entry) {
    const block = entry.after || entry.before;
    return block ? blockTitleForSidebar(block) : entry.identity;
  }

  function blockTitleForSidebar(block) {
    if (block.kind === "heading") {
      return conciseSidebarText(block.text, "Heading");
    }

    if (block.kind === "graphic") {
      const keyedTitle = block.identity.startsWith("key:") ? humanizeDisplayKey(block.displayKey) : "";
      return keyedTitle || "Diagram";
    }

    if (block.kind === "code") {
      const keyedTitle = block.identity.startsWith("key:") ? humanizeDisplayKey(block.displayKey) : "";
      return keyedTitle || conciseSidebarText(firstNonEmptyLine(block.rawText || block.text), "Code block");
    }

    if (block.kind === "table-row") {
      const cells = Array.isArray(block.cellTexts) ? block.cellTexts.filter(Boolean) : [];
      return conciseSidebarText(cells.length > 0 ? cells.slice(0, 3).join(" | ") : block.text, "Table row");
    }

    if (block.identity.startsWith("key:")) {
      const keyedTitle = humanizeDisplayKey(block.displayKey);
      return keyedTitle || conciseSidebarText(block.text, readableKind(block.kind));
    }

    return conciseSidebarText(block.text, readableKind(block.kind));
  }

  function humanizeDisplayKey(value) {
    const normalized = normalizeText(String(value || "")
      .replace(/\/[a-z]+-\d+$/i, "")
      .replace(/[-_:/]+/g, " "));
    if (!normalized) {
      return "";
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function conciseSidebarText(text, fallback) {
    const normalized = normalizeText(text || fallback || "Changed block");
    if (normalized.length <= 72) {
      return normalized;
    }
    return normalized.slice(0, 69).trimEnd() + "...";
  }

  function firstNonEmptyLine(text) {
    const lines = String(text || "").split(/\r?\n/);
    return lines.find((line) => line.trim()) || "";
  }

  function setSidebarItemExpanded(button, expanded) {
    button.classList.toggle("rhd-change-button-expanded", expanded);
  }

  function focusEntry(entry, afterDoc) {
    const target = findRenderedTarget(entry, afterDoc);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    applyFocusMarker(target, afterDoc);
  }

  function clearFocusedTargets(root) {
    for (const focusedTarget of root.querySelectorAll(".rhd-focus-pulse")) {
      focusedTarget.classList.remove("rhd-focus-pulse");
      focusedTarget.classList.remove("rhd-text-focus-box");
    }
  }

  function applyFocusMarker(target, root) {
    clearFocusedTargets(root);
    if (shouldUseTextFocusBox(target)) {
      target.classList.add("rhd-text-focus-box");
    }
    void target.offsetWidth;
    target.classList.add("rhd-focus-pulse");
  }

  function shouldUseTextFocusBox(target) {
    return TEXT_FOCUS_TAGS.has(target.tagName.toLowerCase());
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
      '.rhd-block-added, [data-rhd-status="+"] { --rhd-marker-color: #2da44e; --rhd-block-bg: #dafbe1; --rhd-outline-color: rgba(45, 164, 78, 0.7); --rhd-halo-color: rgba(45, 164, 78, 0.16); --rhd-focus-ring-color: rgba(45, 164, 78, 0.28); }',
      '.rhd-block-changed, [data-rhd-status="~"] { --rhd-marker-color: #9a6700; --rhd-block-bg: #fff8c5; --rhd-outline-color: rgba(154, 103, 0, 0.65); --rhd-halo-color: rgba(154, 103, 0, 0.18); --rhd-focus-ring-color: rgba(154, 103, 0, 0.28); }',
      '.rhd-removed-block, [data-rhd-status="-"] { --rhd-marker-color: #cf222e; --rhd-focus-ring-color: rgba(207, 34, 46, 0.28); }',
      ".rhd-block-added:not(pre):not(tr), .rhd-block-changed:not(pre):not(tr) { max-width: 100% !important; overflow-wrap: anywhere !important; background: var(--rhd-block-bg) !important; outline: 1px solid var(--rhd-outline-color) !important; box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; padding-left: max(10px, 0.65em) !important; padding-right: 6px !important; }",
      ".rhd-diff-list { padding-left: 0 !important; list-style: none !important; counter-reset: rhd-list-item !important; }",
      ".rhd-diff-list > li { display: grid !important; grid-template-columns: 2.35em minmax(0, 1fr) !important; column-gap: 0.45em !important; align-items: baseline !important; list-style: none !important; padding-left: 0 !important; }",
      ".rhd-list-marker { grid-column: 1 !important; text-align: right !important; color: inherit !important; font-variant-numeric: tabular-nums !important; user-select: none !important; }",
      ".rhd-list-body { grid-column: 2 !important; min-width: 0 !important; overflow-wrap: anywhere !important; }",
      "li.rhd-block-added:not(pre):not(tr), li.rhd-block-changed:not(pre):not(tr), li.rhd-removed-list-item { padding-left: 0 !important; }",
      "pre.rhd-block-added { border-color: var(--rhd-outline-color) !important; outline: 2px solid var(--rhd-outline-color) !important; box-shadow: inset 6px 0 0 var(--rhd-marker-color), 0 0 0 3px var(--rhd-halo-color) !important; overflow-x: auto !important; }",
      "pre.rhd-block-changed { border-color: var(--rhd-outline-color) !important; outline: 0 !important; box-shadow: none !important; overflow-x: auto !important; }",
      "tr.rhd-block-added, tr.rhd-block-changed { background: transparent !important; outline: 0 !important; box-shadow: none !important; }",
      "tr.rhd-block-added > th, tr.rhd-block-added > td { background: #dafbe1 !important; }",
      "tr.rhd-block-changed > th, tr.rhd-block-changed > td { background: #fff8c5 !important; }",
      "tr.rhd-block-added > :first-child, tr.rhd-block-changed > :first-child { box-shadow: inset 4px 0 0 var(--rhd-marker-color) !important; padding-left: 14px !important; }",
      ".rhd-table-cell-changed { background: #fff1a6 !important; box-shadow: inset 0 0 0 2px rgba(154, 103, 0, 0.45) !important; outline: 1px solid rgba(154, 103, 0, 0.35) !important; outline-offset: -1px !important; }",
      "mark.rhd-added-token { background: #aceebb !important; color: #116329 !important; border-radius: 3px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; padding: 0 2px !important; overflow-wrap: anywhere !important; }",
      "del.rhd-removed-token { background: #ffd7d5 !important; color: #82071e !important; border-radius: 3px !important; box-decoration-break: clone !important; -webkit-box-decoration-break: clone !important; padding: 0 2px !important; text-decoration: line-through !important; overflow-wrap: anywhere !important; }",
      ".rhd-removed-block { box-sizing: border-box !important; max-width: 100% !important; margin: 14px 0 !important; border: 1px solid rgba(207, 34, 46, 0.6) !important; border-left-width: 4px !important; border-radius: 6px !important; background: #ffebe9 !important; padding: 10px 12px !important; color: #82071e !important; overflow-wrap: anywhere !important; }",
      "li.rhd-removed-block { --rhd-marker-color: #cf222e; margin: 6px 0 !important; border: 1px solid rgba(207, 34, 46, 0.6) !important; border-radius: 4px !important; background: #ffebe9 !important; box-shadow: inset 4px 0 0 #cf222e !important; color: #82071e !important; padding: 0 !important; }",
      ".rhd-removed-label { display: inline-block !important; margin-bottom: 6px !important; color: #82071e !important; font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif !important; text-transform: uppercase !important; }",
      ".rhd-removed-block p { margin: 0 !important; }",
      ".rhd-removed-clone { margin: 0 !important; color: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-removed-clone.graph-panel, .rhd-removed-clone svg { width: 100% !important; max-width: 100% !important; }",
      ".rhd-removed-clone svg { opacity: 0.72 !important; filter: sepia(0.35) saturate(1.25) hue-rotate(310deg) !important; }",
      ".rhd-removed-clone svg text { fill: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-mermaid-rendered { max-width: 100% !important; overflow-x: auto !important; }",
      ".rhd-mermaid-rendered svg { display: block !important; width: 100% !important; max-width: 100% !important; height: auto !important; }",
      ".rhd-graphic-node-added rect, .rhd-graphic-node-added polygon, .rhd-graphic-node-added circle, .rhd-graphic-node-added ellipse, .rhd-graphic-node-added path { stroke: #2da44e !important; stroke-width: 3px !important; fill: #dafbe1 !important; }",
      ".rhd-graphic-node-changed rect, .rhd-graphic-node-changed polygon, .rhd-graphic-node-changed circle, .rhd-graphic-node-changed ellipse, .rhd-graphic-node-changed path { stroke: #9a6700 !important; stroke-width: 3px !important; fill: #fff8c5 !important; }",
      ".rhd-graphic-edge-added, .rhd-graphic-edge-added path, .rhd-graphic-edge-added line, .rhd-graphic-edge-added polyline { stroke: #2da44e !important; stroke-width: 3px !important; }",
      ".rhd-graphic-edge-removed, .rhd-graphic-edge-removed path, .rhd-graphic-edge-removed line, .rhd-graphic-edge-removed polyline { stroke: #cf222e !important; stroke-width: 3px !important; stroke-dasharray: 7 5 !important; }",
      ".rhd-graphic-node-diff { font: 700 11px/1 ui-sans-serif, system-ui, sans-serif !important; pointer-events: none !important; paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; }",
      ".rhd-graphic-node-inline-diff { paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; }",
      ".rhd-graphic-node-removed rect { fill: #ffebe9 !important; stroke: #cf222e !important; stroke-width: 2px !important; }",
      ".rhd-graphic-node-removed text, .rhd-graphic-node-removed tspan, .rhd-graphic-node-removed .nodeLabel { color: #82071e !important; fill: #82071e !important; paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; text-decoration: line-through !important; }",
      ".rhd-graphic-diff-removed { color: #82071e !important; fill: #82071e !important; text-decoration: line-through !important; }",
      ".rhd-graphic-diff-added { color: #116329 !important; fill: #116329 !important; }",
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
      "[data-rhd-status].rhd-focus-pulse:not(pre):not(tr) { box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px var(--rhd-focus-ring-color, rgba(9, 105, 218, 0.28)) !important; }",
      ".rhd-focus-pulse.rhd-text-focus-box { display: block !important; width: 100% !important; max-width: none !important; box-sizing: border-box !important; border-radius: 6px !important; box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px var(--rhd-focus-ring-color, rgba(9, 105, 218, 0.28)) !important; }",
      ".rhd-focus-pulse { box-shadow: inset 4px 0 0 var(--rhd-marker-color, #0969da), 0 0 0 5px var(--rhd-focus-ring-color, rgba(9, 105, 218, 0.28)) !important; }"
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

    return text.length <= 96 ? text : displayKey + ": " + text.slice(0, 93).trimEnd() + "...";
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
