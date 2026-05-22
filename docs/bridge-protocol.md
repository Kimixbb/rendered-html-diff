# Bridge Protocol

## Purpose

The bridge protocol connects the parent report to the sandboxed `before` and
`after` frames. It exists because frames intentionally do not use
`allow-same-origin`, so the parent cannot access `iframe.contentDocument`.

All communication uses `postMessage`.

## Message Envelope

Every report message uses this envelope:

```ts
{
  source: "rendered-html-diff",
  token: string,
  frameId?: "before" | "after",
  type: string
}
```

The token is generated per report. A message is ignored unless both `source` and
`token` match.

## Frame To Parent Messages

### `blocks`

Sent by both frames after startup and Mermaid rendering.

```ts
{
  source: "rendered-html-diff",
  token: string,
  frameId: "before" | "after",
  type: "blocks",
  blocks: SerializedBlock[]
}
```

The parent waits for both frame ids before computing the diff.

### `frame-error`

Sent when the frame bridge cannot initialize or collect blocks.

```ts
{
  source: "rendered-html-diff",
  token: string,
  frameId: "before" | "after",
  type: "frame-error",
  message: string
}
```

The parent shows a report failure message.

## Parent To Frame Messages

### `apply-diff`

Sent to the visible `after` frame after the parent computes entries.

```ts
{
  source: "rendered-html-diff",
  token: string,
  type: "apply-diff",
  entries: SerializedEntry[],
  beforeBlocks: SerializedBlock[],
  afterBlocks: SerializedBlock[]
}
```

The `after` bridge applies highlights and stores this payload for later
reapplication.

### `focus`

Sent when a user clicks a sidebar row.

```ts
{
  source: "rendered-html-diff",
  token: string,
  type: "focus",
  identity: string
}
```

The frame scrolls to the rendered target and applies the focus pulse. The focus
handler is asynchronous because it first reapplies the latest stored diff. That
reapplication rebuilds deleted placeholders, restores inline diffs after late
app renders, and makes sure the focus lookup sees the same target the user sees.

Focus is durable frame state. The frame remembers the selected identity and
restores the marker after later diff reapplications. Only one rendered target
should have `rhd-focus-pulse` at a time.

Focus styling follows the target status:

| Target Status | Status Attribute | Focus Color |
| --- | --- | --- |
| Added | `data-rhd-status="+"` | green |
| Modified | `data-rhd-status="~"` | amber |
| Deleted | `data-rhd-status="-"` | red |

Text blocks also receive `rhd-text-focus-box` while selected. That class makes
the focus halo span the full text block width. The class is removed when another
sidebar item is selected.

Sidebar hover, pointer hover, and keyboard focus are handled entirely inside the
parent report. They expand the sidebar row text in place and do not send bridge
messages.

## Custom Focus Hook

Input pages may define:

```js
window.__renderedHtmlDiffFocus = (identity, target) => {
  // optional app-specific behavior
};
```

The bridge calls this hook before applying focus styling. This lets an app open
a tab, reveal a panel, or select internal UI before the report scrolls to the
target.
