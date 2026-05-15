# Rendered HTML Diff

Rendered HTML Diff is a small CLI for comparing two static HTML documents as rendered developer-facing reports.

```bash
npm install
npm run demo
```

The demo writes a standalone report to `dist/demo.html`.

You can also run it against your own files:

```bash
npm run rhd -- before.html after.html --out diff.html
```

The MVP is intentionally narrow: static HTML in, standalone visual diff report out. Stable `data-diff-key` attributes make the output much cleaner, especially for agent-generated coding reports.
