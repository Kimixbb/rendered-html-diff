---
name: rendered-html-diff
description: Create interactive rendered HTML diff reports with the rendered-html-diff CLI. Use when Codex needs to compare a changed static HTML file against Git HEAD, compare explicit before and after HTML snapshots, build QA fixtures with stable data-diff-key markers, preserve interactive app behavior inside sandboxed frames, or debug Mermaid and SVG graphic diffs.
---

# Rendered HTML Diff

Use this repo to create standalone visual diff reports from two rendered HTML
states. The report keeps the newer document interactive inside a sandboxed
iframe, compares semantic blocks from the live DOM, and shows changed blocks in
the sidebar.

## Fast Workflow

Install dependencies once:

```bash
npm install
```

Build before running the CLI directly:

```bash
npm run build
```

Compare one tracked file against Git `HEAD`:

```bash
npm run rhd -- changed.html --out diff.html
```

Use this one-file mode only when the HTML file already exists in `HEAD`. For
brand-new files, generated snapshots, or archived before and after states, pass
both files explicitly:

```bash
npm run rhd -- before.html after.html --out diff.html
```

Run the built-in demos when you need a known-good report:

```bash
npm run demo
npm run flow-demo
```

Open the generated HTML report locally and inspect the sidebar, highlighted
blocks, changed charts, Mermaid diagrams, and interactive controls.

## Author HTML For Cleaner Diffs

- Put stable `data-diff-key` attributes on visible semantic blocks that should
  match across versions.
- Use `data-diff-kind="graphic"` on charts, SVG summaries, Mermaid diagrams,
  and other visual blocks that should diff as one unit.
- Do not add hidden blocks only to force a diff. Fixtures and generated reports
  should represent user-visible behavior.
- Keep Mermaid source in the HTML when authoring diagrams. For direct file
  preview, include `fixtures/mermaid-source-render.js` near the end of the
  body so Mermaid renders when the source file is opened outside a diff report.
- If an input app needs asynchronous startup, expose
  `window.__renderedHtmlDiffReady` so the frame bridge can wait before it
  collects blocks.
- If a sidebar click needs app-specific reveal behavior, expose
  `window.__renderedHtmlDiffFocus(identity, target)`.

## Runtime Contracts

- Treat generated reports as trusted local artifacts, not as a safe viewer for
  arbitrary untrusted web pages.
- Keep both input frames sandboxed with `sandbox="allow-scripts"`.
- Never add `allow-same-origin`, top navigation, or popup permissions to report
  iframes.
- Keep parent and frame communication on the existing `postMessage` bridge. The
  parent report must not read or mutate `iframe.contentDocument` directly.
- Preserve raw input HTML in the report payload. Input scripts should execute
  only inside the sandboxed before and after frames.
- Let the frame bridge collect blocks after startup, paint settling, and Mermaid
  rendering so diffs match what the user sees.

## Maintenance Workflow

Follow red/green TDD for behavior changes:

1. Add or update a focused test.
2. Run the test and confirm it fails for the expected reason.
3. Implement the change.
4. Run `npm test`.
5. Regenerate any affected demo reports.
6. Manually inspect the generated report when runtime, chart, Mermaid, focus, or
   fixture behavior changed.
7. Update docs when a contract or workflow changes.

Use these fixture-specific report commands when relevant:

```bash
node dist/cli.js fixtures/template-editor-flow-before.html fixtures/template-editor-flow-after.html --out dist/template-editor-flow-diff.html
node dist/cli.js fixtures/q1-financial-report-before.html fixtures/q1-financial-report-after.html --out dist/q1-financial-report-diff.html
```

## Reference Map

Read only the reference needed for the task:

- [Report Runtime](docs/report-runtime.md): report shell, iframe startup,
  sidebar behavior, focus boxes, and late diff reapplication.
- [Bridge Protocol](docs/bridge-protocol.md): parent and frame message shapes,
  focus messages, and custom focus hooks.
- [Block Diff Model](docs/block-diff-model.md): semantic block collection,
  identity rules, entry statuses, and inline renderers.
- [Mermaid Graph Reference](docs/mermaid-graph-reference.md): Mermaid source
  rendering, graph-aware diffs, merged graph layout, and parser limits.
- [Security And Trust Model](docs/security-and-trust-model.md): sandbox policy,
  trust boundary, message guarding, and compatibility limits.
- [Fixtures And QA](docs/fixtures-and-qa.md): fixture intent, manual QA checks,
  and automated coverage expectations.
- [Maintenance Reference](docs/maintenance-reference.md): commands, file map,
  extension guidelines, and useful static checks.

## Troubleshooting

- If blocks match poorly, add direct `data-diff-key` values to the affected
  visible blocks.
- If a chart or diagram diff is too noisy, mark the wrapper with
  `data-diff-kind="graphic"` and give it a stable key.
- If Mermaid renders when opened directly but not in a report, check
  `fixtures/mermaid-source-render.js` and the Mermaid reference before changing
  the bridge.
- If a sidebar click appears to focus the wrong element, check the block
  identity, selected focus cleanup, and whether the app rerenders the target
  after diff application.
- If sandboxed behavior changes, verify generated reports still contain
  `sandbox="allow-scripts"` and do not contain `allow-same-origin`.
