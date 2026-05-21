# Maintenance Reference

## Commands

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Default demo:

```bash
npm run demo
```

App-flow demo:

```bash
npm run flow-demo
```

Custom report:

```bash
npm run rhd -- before.html after.html --out diff.html
```

Template editor report:

```bash
node dist/cli.js fixtures/template-editor-flow-before.html fixtures/template-editor-flow-after.html --out dist/template-editor-flow-diff.html
```

## Files

- `src/report.ts`: report template, parent runtime, frame bridge, highlighting,
  Mermaid rendering, and sidebar behavior.
- `src/core.ts`: non-executing extraction, diffing, and sanitization helpers.
- `src/cli.ts`: CLI entrypoint.
- `src/__tests__/report.test.ts`: generated report runtime tests.
- `src/__tests__/core.test.ts`: core model tests.
- `fixtures/`: comparison fixtures.
- `dist/`: generated local reports for manual QA.

## Development Checklist

For runtime changes:

1. Add or update a focused test.
2. Confirm the test fails for the expected reason.
3. Implement the runtime change.
4. Run `npm test`.
5. Regenerate relevant demos.
6. Manually inspect the affected generated report.
7. Update docs when behavior or contracts change.

## Extension Guidelines

When adding block types:

- collect only user-visible semantic content
- prefer stable `data-diff-key`
- add kind-specific inline rendering only when generic prose rendering is not
  enough
- preserve input app layout as much as possible

When changing Mermaid behavior:

- test source decoding and rendered styling separately
- keep parser support conservative
- avoid font metric overrides
- match real node groups only
- prefer merged graph layout for removed graph parts

When changing sidebar behavior:

- preserve keyboard access
- keep row hover and keyboard focus as parent-only full-label reveal
- do not reintroduce hover-to-frame preview messages
- keep click focus as the durable frame navigation action
- keep resize limits, drag behavior, and keyboard resizing documented and tested
- use bridge messages instead of parent frame DOM access

## Useful Static Checks

Find report bridge code in generated demos:

```bash
rg -n "buildMergedMermaidGraphSource|isMermaidNodeGroup" dist/app-flow-demo.html
```

Check generated iframe sandbox policy:

```bash
rg -n "allow-same-origin" dist
```

The sandbox check should not find `allow-same-origin` in generated reports.
