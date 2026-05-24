# Report Runtime

## Generated Report Anatomy

Every report returned by `renderStandaloneReport()` is a single HTML file. It
contains:

- A parent shell with a collapsible sidebar, summary counts, changed-block list,
  and preview toolbar.
- A visible `after` iframe that displays the interactive newer document.
- A hidden `before` iframe used only to collect comparison blocks.
- Embedded Mermaid runtime source.
- Embedded frame bridge source stored as text until the parent injects it into
  each iframe.
- A JSON payload with raw escaped `beforeHtml`, `afterHtml`, source paths, and a
  generation timestamp.

The parent report owns report UI. The iframes own input-page behavior and all
DOM mutation inside the rendered documents.

## Startup Sequence

Each frame bridge performs startup in this order:

1. Disable Mermaid auto-start.
2. Inject report highlight styles into the frame.
3. Wait until the document is no longer loading.
4. If `window.__renderedHtmlDiffReady` exists, wait for it with a timeout.
5. Wait for two animation frames.
6. Wait for a short settle delay.
7. Render Mermaid blocks in the frame.
8. Collect semantic blocks from the live DOM.
9. Send serialized blocks to the parent report.

This sequence is part of the runtime contract. It keeps the collected block list
aligned with what the user sees on screen.

## Parent Diff Sequence

The parent waits until both frames send block lists. It then:

1. Diffs the serialized `before` and `after` blocks.
2. Renders summary counts.
3. Builds changed-block sidebar buttons.
4. Sends the diff instructions to the `after` frame.
5. Sends a focus command to the `after` frame when the user clicks a sidebar
   row.

The parent never directly reads or writes the frame DOM.

## Sidebar Behavior

The sidebar supports four interactions:

- Collapse or expand the sidebar to give the live app more room. The collapsed
  state keeps a narrow rail visible so the user can expand it again.
- Resize the sidebar with the vertical separator between the sidebar and the
  iframe. Width is clamped between 280px and 560px. The separator also supports
  keyboard resizing: `ArrowLeft` and `ArrowRight` move by 16px, `Shift` plus an
  arrow moves by 32px, `Home` jumps to 280px, and `End` jumps to 560px.
- Hover, pointer-hover, keyboard-focus, or click a changed-block row to expand
  that row in place. The expanded row shows the full sidebar label and metadata,
  with wrapping allowed for long paths or summaries.
- Changed-block rows are grouped by their collected heading path. Each group
  shows compact added, modified, and deleted counts for that section.
- Row titles are catalog labels. They favor heading text, readable
  `data-diff-key` names, and compact block summaries instead of repeating full
  before/after content that is already visible in the rendered diff.
- Click a changed-block row to scroll to and pulse the target in the `after`
  frame.

Sidebar hover is parent-only UI state. It does not send a frame message, it does
not scroll the `after` frame, and it does not add a native `title` tooltip. The
row keeps the full label in its own text content, while `aria-label` provides the
same label and metadata for assistive technology.

Click focus is the durable navigation action. It is the only sidebar row
interaction that asks the `after` frame to move.

## Diff Highlights And Focus Boxes

The frame bridge uses two visual layers:

- **Diff highlight** shows what changed. It stays visible whether or not the
  block is selected.
- **Focus box** shows the one sidebar row the user selected most recently. It
  moves when the user clicks another sidebar row.

Diff highlight colors follow entry status:

| Status | Block Marker | Inline Tokens | Meaning |
| --- | --- | --- | --- |
| Added | green | green `mark` tokens | exists only in `after` |
| Modified | amber | red `del` and green `mark` tokens | matched block changed |
| Deleted | red | red `del` tokens or deleted placeholder | exists only in `before` |

The bridge stores status on rendered targets with `data-rhd-status`:

- `+` for added
- `~` for modified
- `-` for deleted placeholders

The selected focus box uses the same status color. This matters because added
and modified blocks already have their own `box-shadow` for the normal diff
marker. The selected-state CSS must be at least as specific as the base diff
CSS, otherwise the focus halo can be overwritten and appear missing.

Focus behavior by target type:

- Text blocks, such as headings, paragraphs, list items, and blockquotes, get a
  temporary full-width focus box. This makes short text changes easier to see in
  dense reports.
- Graphic blocks, including SVG charts and Mermaid diagrams, use the whole
  graphic card or deleted placeholder as the focus target.
- Code blocks and table rows keep their specialized highlighting and receive
  the shared focus pulse when selected.

Only one target should have focus styling at a time. Before a new focus marker
is applied, the bridge removes both `rhd-focus-pulse` and `rhd-text-focus-box`
from the previous target. The normal diff highlight remains in place.

## Frame Injection

The parent injects the Mermaid runtime, bridge config, and frame bridge into each
input document before assigning `srcdoc`.

Injection is placed at the last real document close:

1. The last `</body>` if present.
2. Otherwise the last `</html>` if present.
3. Otherwise the end of the string.

This prevents bridge scripts from appearing inside visible source blocks that
contain literal strings like `</body>`.

## Late Rendering

Some input apps replace DOM nodes shortly after startup. The bridge stores the
latest diff instructions and reapplies them after short delays. This makes
inline diffs survive late app renders without taking away the page's normal
interactivity.

When the user clicks a sidebar row, the frame waits for the stored diff to
reapply before finding the focus target. This is important for deleted blocks:
deleted placeholders are removed and rebuilt during reapplication, so focusing
too early can make a click appear to do nothing.
