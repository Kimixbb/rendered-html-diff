# Security And Trust Model

## Trust Boundary

Generated reports are trusted local artifacts. They execute input HTML scripts
inside sandboxed frames so interactive app behavior works.

Do not use the interactive report as a safe viewer for arbitrary untrusted web
pages.

## Iframe Sandbox

Both input documents are rendered with:

```html
sandbox="allow-scripts"
```

Do not add:

- `allow-same-origin`
- `allow-top-navigation`
- popup permissions

This allows app JavaScript to run while keeping the frame in an opaque origin.
The parent report cannot read frame DOM directly.

## Parent Isolation

Input scripts should execute only inside the `before` and `after` frames. They
should not execute in the parent report document.

The parent stores raw input HTML in an escaped JSON payload, creates frame HTML,
injects the trusted bridge, and assigns `srcdoc`.

## `postMessage` Guarding

Messages are accepted only when both values match:

- `source === "rendered-html-diff"`
- `token === frameToken`

This keeps unrelated messages from controlling the report. It does not make
untrusted input safe.

## Sanitization

`sanitizeHtml()` remains available in `src/core.ts` for non-executing extraction
tests and any future static mode.

The interactive report does not sanitize input HTML before frame rendering. It
escapes the input for safe embedding in the parent JSON payload, then executes it
inside sandboxed frames.

## Compatibility Constraints

Because frames do not use `allow-same-origin`, some app features may not work:

- direct access to the parent window
- same-origin storage assumptions
- top navigation
- popups
- APIs blocked by sandbox or opaque-origin behavior

Fixtures and generated reports should avoid relying on those features.
