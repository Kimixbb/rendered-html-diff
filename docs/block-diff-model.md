# Block Diff Model

## Semantic Blocks

The bridge collects user-visible semantic blocks from the live DOM. Current block
selectors are:

- `data-diff-kind="graphic"`
- `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- `p`
- `li`
- `pre`
- `blockquote`
- `tr`

Hidden elements and elements inside hidden ancestors are skipped.

## Block Fields

Each serialized block includes:

- `identity`: stable matching key used by the diff.
- `displayKey`: readable key shown in diagnostics or sidebar metadata.
- `kind`: semantic kind, such as prose, code, table row, list item, or graphic.
- `tagName`: original DOM tag.
- `text`: normalized visible text.
- `rawText`: raw source text for code and graphics.
- `cellTexts`: normalized table cell values for rows.
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

Use direct `data-diff-key` for important generated content. It gives the most
stable diffs and avoids churn when surrounding layout changes.

## Entry Status

The parent compares `before` and `after` blocks by identity:

- `added`: only exists in `after`.
- `changed`: exists in both, but normalized text differs.
- `removed`: only exists in `before`.
- `unchanged`: exists in both with the same normalized text.

Only added, changed, and removed entries are shown in the sidebar.

## Inline Diff Renderers

The `after` frame renders entry details by kind:

- Prose: word-level `mark` and `del` tokens.
- Code: git-like line rows with signs.
- Tables: changed cells are highlighted and get word diffs.
- Lists: custom markers are preserved and the item body receives word diffs.
- Graphics: Mermaid graph-aware rendering is used when possible.
- Removed blocks: red placeholders are inserted near the closest surviving
  neighbor.

## List Handling

The bridge wraps list item contents with report marker and body spans so list
diffs do not collapse into tight columns. Reapplication unwraps prior report
markup before rebuilding it. This keeps late-render reapplication idempotent.

## Table Handling

Table rows are matched as blocks. When a row changes, each cell is compared by
index. Only cells with changed normalized text receive cell-level highlighting.

## Code Handling

Code blocks use raw text and line diffs. Added and removed lines receive distinct
backgrounds and signs, while unchanged lines remain transparent. This is meant
to read like a small git diff inside the rendered report.
