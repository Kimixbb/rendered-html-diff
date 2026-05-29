# Mermaid Graph Reference

## Graphic Blocks

Mermaid diagrams participate in graph-aware diffing when they are marked as
graphic blocks:

```html
<pre class="mermaid" data-diff-key="flow" data-diff-kind="graphic">
flowchart LR
  A["Start"] --> B["Finish"]
</pre>
```

The bridge also supports:

```html
<code class="language-mermaid" data-diff-key="flow" data-diff-kind="graphic">
...
</code>
```

## Direct Source Rendering

Agent-authored HTML should render Mermaid when the source file is opened
directly. Keep the graph source in the document, mark it with
`data-diff-kind="graphic"`, and load the source renderer near the end of the
body:

```html
<pre class="mermaid" data-diff-key="flow" data-diff-kind="graphic">
flowchart LR
  A["Start"] --> B["Finish"]
</pre>
<script src="mermaid-source-render.js"></script>
```

The repo helper first tries the local Mermaid package at
`../node_modules/mermaid/dist/mermaid.min.js`, then falls back to
`https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js`. It calls
`mermaid.render()` and replaces each source block with an SVG container while
copying the original `data-diff-key` and `data-diff-kind` attributes.

The helper must stay inert inside rendered-html-diff reports. It checks
`window.__rhdBridgeConfig` and `window.__renderedHtmlDiffBridge` before it
loads Mermaid, so the report bridge can collect and render the original source
itself. Agents that inline their own helper should keep the same guard.

## Render Flow

For each Mermaid block, the frame bridge:

1. Reads the source from `innerHTML` so encoded label markup is preserved.
2. Decodes Mermaid syntax entities.
3. Keeps label line breaks encoded for Mermaid's parser.
4. Calls `mermaid.render()`.
5. Replaces the source block with the rendered SVG container.
6. Stores the original source on `data-rhd-graphic-source`.
7. Normalizes rendered labels so literal `<br/>` becomes line breaks.

## Parsed Graph Parts

The graph parser extracts:

- node ids
- node labels
- basic node shape delimiters
- simple directed edges

The parser is intentionally conservative. It is built for common flowchart
fixtures, not every Mermaid diagram type.

## Merged Graph Layout

When a graph changes, the bridge builds a temporary merged Mermaid source:

- Start from the `after` graph.
- Add removed nodes from the `before` graph.
- Add removed edges from the `before` graph.
- Add changed-label layout hints so Mermaid sizes the node for both old and new
  labels.

Mermaid lays out the merged graph. The bridge then decorates the rendered graph
parts in place.

This keeps removed nodes in the graph flow instead of drawing detached
placeholder boxes.

## Visual Conventions

- Added nodes: green fill and border.
- Changed nodes: yellow fill and border.
- Removed nodes: red fill and border.
- Added edges: green stroke.
- Removed edges: red dashed stroke.
- Changed labels: old label crossed out, new label green.

Diff CSS must not change Mermaid font size, font family, or font weight. It may
change color, fill, stroke, and text decoration.

## Node Matching

Mermaid can render wrapper groups with class names like `nodes`. Those wrappers
must never receive node-level diff classes.

The bridge treats a group as a real node only when it matches one of these
conditions:

- class token includes `node`
- it has `data-id`
- its id matches Mermaid's flowchart node id pattern

This prevents one removed node from marking every graph label as deleted.

## Label Handling

Mermaid may render labels as SVG `<text>` or HTML `.nodeLabel` content. The
bridge handles both forms.

Line-break forms normalized by the bridge include:

- `<br/>`
- `<br>`
- `&lt;br/&gt;`
- `&amp;lt;br/&amp;gt;`

## Known Limits

The graph diff parser does not fully support every Mermaid feature. Areas that
may need future work include:

- subgraphs
- uncommon edge operators
- custom edge labels
- advanced shape syntax
- non-flowchart diagram types
- complex class and style directives

When adding support, add tests first and keep the parser narrow.
