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
