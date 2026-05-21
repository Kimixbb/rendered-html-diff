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

The frame scrolls to the rendered target and applies the focus pulse.

### `preview`

Sent when a user hovers or keyboard-focuses a sidebar row.

```ts
{
  source: "rendered-html-diff",
  token: string,
  type: "preview",
  identity: string
}
```

The frame scrolls to the rendered target and applies a temporary preview pulse.

### `clear-preview`

Sent when hover or keyboard focus leaves a sidebar row.

```ts
{
  source: "rendered-html-diff",
  token: string,
  type: "clear-preview"
}
```

The frame removes any preview pulse.

## Custom Focus Hook

Input pages may define:

```js
window.__renderedHtmlDiffFocus = (identity, target) => {
  // optional app-specific behavior
};
```

The bridge calls this hook before applying focus or preview styling. This lets an
app open a tab, reveal a panel, or select internal UI before the report scrolls
to the target.
