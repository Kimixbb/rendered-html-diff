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
- Click a changed-block row to scroll to and pulse the target in the `after`
  frame.

Sidebar hover is parent-only UI state. It does not send a frame message, it does
not scroll the `after` frame, and it does not add a native `title` tooltip. The
row keeps the full label in its own text content, while `aria-label` provides the
same label and metadata for assistive technology.

Click focus is the durable navigation action. It is the only sidebar row
interaction that asks the `after` frame to move.

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
