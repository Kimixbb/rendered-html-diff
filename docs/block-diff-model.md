# Block Diff Model

## Semantic Blocks

The bridge collects user-visible semantic blocks from the live DOM. Current block
selectors are:

- `data-diff-kind="graphic"`
- `data-diff-key`
- `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- `p`
- `li`
- `pre`
- `blockquote`
- `tr`
- `footer`, `header`, `main`, `article`, `section`
- `figure`, `figcaption`, `img`, `svg`, `canvas`
- `button`, `label`, `summary`, `dt`, `dd`

Hidden elements and elements inside hidden ancestors are skipped. The bridge
checks both the `hidden` attribute and computed `display: none`,
`visibility: hidden`, and `visibility: collapse`.

Some container tags are collected only when they carry `data-diff-key`, have
their own visible text or media, or contain content that would otherwise be
missed. This prevents ordinary layout wrappers from duplicating the child
paragraphs, rows, figures, or controls that are already collected.

## Block Fields

Each serialized block includes:

- `identity`: stable matching key used by the diff.
- `displayKey`: readable key shown in diagnostics or sidebar metadata.
- `kind`: semantic kind, such as prose, code, table row, list item, or graphic.
- `tagName`: original DOM tag.
- `text`: normalized visible text.
- `rawText`: raw source text for code and graphics.
- `cellTexts`: normalized table cell values for rows.
- `comparisonSignature`: rendered visual signature for style, geometry, media,
  text rendering, and table structure.
- `matchGroup`: fallback group used when an unkeyed block's text changes enough
  to change its identity fingerprint.
- `matchIndex`: block position inside `matchGroup`.
- `headingPath`: heading context at collection time.
- `index`: collection order.
- `html`: rendered outer HTML snapshot.
- `label`: full sidebar label. It should not be pre-truncated in data. The
  sidebar may visually clamp the row while idle, then reveal the full label in
  place on hover, pointer hover, keyboard focus, or click.

## Identity Rules

Identity is chosen in this order:

1. Direct `data-diff-key`.
2. Nearest usable ancestor key plus tag name and count.
3. Fallback using tag name, heading path, and text fingerprint.

Fallback blocks also store `matchGroup` and `matchIndex`. If their exact
fingerprint identity does not match, the parent tries the group and index before
classifying the blocks as unrelated additions and removals. This makes large
text rewrites in the same rendered position show as changed more often.

Use direct `data-diff-key` for important generated content. It gives the most
stable diffs and avoids churn when surrounding layout changes.

## Entry Status

The parent compares `before` and `after` blocks by identity:

- `added`: only exists in `after`.
- `changed`: exists in both, but normalized text or `comparisonSignature`
  differs.
- `removed`: only exists in `before`.
- `unchanged`: exists in both with the same normalized text and rendered
  comparison signature.

Only added, changed, and removed entries are shown in the sidebar.

Rendered blocks also receive a compact status attribute in the `after` frame:

- `data-rhd-status="+"` on added targets
- `data-rhd-status="~"` on modified targets
- `data-rhd-status="-"` on deleted placeholders

That status is used for focus colors as well as normal diff styling. If a
visual bug makes selected items look unselected, check whether a more specific
status highlight rule is overriding the focus box-shadow.

## Rendered Comparison Signatures

`comparisonSignature` is a compact rendered fingerprint, not a source checksum.
It intentionally catches visible changes that do not alter normalized text:

- computed style fields such as color, font, margin, padding, border, display,
  position, transform, vertical alignment, text alignment, width, and height
- rounded `getBoundingClientRect()` geometry
- rendered text-node style and geometry for important descendants
- media data for images, SVG, and canvas sizing
- table cell count, spans, text, styles, and geometry

The signature does not make the report a full source diff. Script source,
hidden text, `href`, ARIA, `title`, `class`, and `style` changes only appear
when they affect the rendered visible block signature.

## Inline Diff Renderers

The `after` frame renders entry details by kind:

- Prose: word-level `mark` and `del` tokens.
- Code: git-like line rows with signs.
- Tables: changed cells are highlighted and get word diffs.
- Lists: custom markers are preserved and the item body receives word diffs.
- Graphics: SVG chart text diffs and Mermaid graph-aware rendering are used
  when possible.
- Removed blocks: red placeholders are inserted near the closest surviving
  neighbor.

## Graphic Handling

Use `data-diff-kind="graphic"` for chart-like content that should be treated as
one visual block in the sidebar. A stable `data-diff-key` is strongly
recommended, especially when the chart type changes but the business concept is
the same.

SVG charts:

- The block itself is matched as one semantic block.
- Diffable `<text>` labels inside the SVG can render old and new values
  directly in the chart.
- Title, subtitle, and axis labels are skipped so the report does not mark
  chart scaffolding as data changes.
- When multiple changed labels share a tight column, the bridge spaces the
  rendered old/new label pairs vertically before drawing them.

Mermaid charts and flowcharts:

- Mermaid source is normalized before matching.
- Flowchart node and edge changes are marked when the parser can understand the
  source.
- Removed graph parts are merged into temporary layout source so deleted nodes
  can remain visible in context.

Removed graphic blocks are cloned into red placeholders. These placeholders keep
the deleted chart readable, strike through rendered text, and participate in
sidebar focus through `data-rhd-placeholder-for`.

## List Handling

The bridge wraps list item contents with report marker and body spans so list
diffs do not collapse into tight columns. Reapplication unwraps prior report
markup before rebuilding it. This keeps late-render reapplication idempotent.

## Table Handling

Table rows are matched as blocks. The row signature includes cell count, spans,
cell text, styles, and geometry. When a row changes, each cell is compared by
index. Cells with changed normalized text receive word-level highlighting, while
style-only or structure-only row changes still mark the row as modified.

## Code Handling

Code blocks use raw text and line diffs. Added and removed lines receive distinct
backgrounds and signs, while unchanged lines remain transparent. This is meant
to read like a small git diff inside the rendered report.
