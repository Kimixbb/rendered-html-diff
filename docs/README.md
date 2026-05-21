# Rendered HTML Diff Docs

These docs describe how the report system works today. They are written as a
reference for future work, so a maintainer should be able to understand the
runtime, data model, test expectations, and fixture rules without reading
`src/report.ts` first.

## Reading Guide

| Need | Read |
| --- | --- |
| Understand the generated report shell and iframe runtime | [Report Runtime](report-runtime.md) |
| Work on parent and iframe messaging | [Bridge Protocol](bridge-protocol.md) |
| Add or debug block matching and inline highlights | [Block Diff Model](block-diff-model.md) |
| Work on Mermaid diagrams and graph-aware highlights | [Mermaid Graph Reference](mermaid-graph-reference.md) |
| Check script execution and sandbox rules | [Security And Trust Model](security-and-trust-model.md) |
| Update fixtures or run manual checks | [Fixtures And QA](fixtures-and-qa.md) |
| Build, regenerate, and maintain the project | [Maintenance Reference](maintenance-reference.md) |

## System Summary

Rendered HTML Diff produces a standalone HTML report from two input HTML files.
The report renders both files in sandboxed iframes, waits for each page to finish
startup, collects semantic blocks from the live DOM, computes a diff in the
parent report, and sends highlight instructions back to the visible `after`
iframe.

Reports are interactive. Input page scripts, inline handlers, buttons, dialogs,
tabs, form controls, and Mermaid diagrams run in the sandboxed frame instead of
being converted into a static preview.

## Core Contracts

- Input HTML is preserved in the report payload and executed only inside
  sandboxed iframes.
- Both report frames use `sandbox="allow-scripts"` and must not use
  `allow-same-origin`.
- The parent report communicates with frames through `postMessage`; it does not
  read `iframe.contentDocument`.
- Diffing happens after app startup, optional app readiness, a short paint
  settle delay, and Mermaid rendering.
- Stable `data-diff-key` attributes are the preferred way to identify blocks.
- Mermaid graph diffs decorate graph parts, not the entire graph, whenever the
  parser can understand the flowchart source.

## Glossary

- **Parent report**: the outer generated HTML document that owns the sidebar,
  counts, iframe creation, and diff computation.
- **Frame bridge**: the trusted script injected into each sandboxed input frame.
  It collects rendered blocks, applies highlights, and handles focus or preview
  commands.
- **Semantic block**: a user-visible unit such as a heading, paragraph, list
  item, table row, code block, or graphic block.
- **Graphic block**: a diff block with `data-diff-kind="graphic"`, currently
  used for Mermaid diagrams.
- **Live DOM**: the DOM after the input page has run its scripts and rendered
  its startup state.
- **Merged graph**: a temporary Mermaid source that combines the `after` graph
  with removed graph parts so Mermaid can lay out deleted nodes in context.
