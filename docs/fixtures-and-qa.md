# Fixtures And QA

## Fixture Rules

Fixtures should represent user-visible behavior. Do not add hidden blocks only
to make a diff appear.

Use stable `data-diff-key` attributes on visible blocks that should match across
versions.

## Template Editor Fixtures

Files:

- `fixtures/template-editor-flow-before.html`
- `fixtures/template-editor-flow-after.html`

Purpose:

- verify raw app scripts are preserved in the frame payload
- verify the report remains interactive
- verify visible semantic blocks stay keyed and unchanged

Important source difference:

- before: `return ["Scan result: Check harness label"...`
- after: `return ["Check harness label"...`

The visible semantic block diff should remain empty for these fixtures. Script
preservation is tested separately.

## App Flow Fixtures

Files:

- `fixtures/app-flow-old.html`
- `fixtures/app-flow-new.html`

Purpose:

- exercise prose diffs
- exercise code line diffs
- exercise table cell diffs
- exercise list marker handling
- exercise Mermaid graph diffs

Use `dist/app-flow-demo.html` for manual visual checks.

## Manual QA Checklist

After changing report runtime behavior:

1. Run `npm test`.
2. Regenerate demos.
3. Open `dist/demo.html`.
4. Open `dist/app-flow-demo.html`.
5. Open `dist/template-editor-flow-diff.html`.

In the template editor report, verify:

- `New`, `Duplicate`, and `Edit` switch modes.
- Add-item actions open the dialog.
- AI, OCR, and Split Text tabs respond.
- OCR sample behavior matches the fixture version.
- Sidebar click navigation focuses the changed block.
- Sidebar hover, pointer hover, keyboard focus, and click reveal the full row
  label inside the sidebar item itself.
- Sidebar rows do not depend on a native `title` tooltip for full text.
- Sidebar resizing works with the drag separator and keyboard controls.
- Sidebar width stays between 280px and 560px.
- Sidebar collapse and expand works, and resizing is unavailable while
  collapsed.

In the app flow report, verify:

- code blocks look like git-style line diffs
- changed table cells are visibly marked
- list items keep readable marker spacing
- Mermaid removed nodes stay in the graph flow
- Mermaid removed edges are red and dashed
- graph labels are not all crossed out
- added and modified Mermaid graphs use consistent font sizing

## Automated Coverage

`src/__tests__/report.test.ts` covers generated report behavior:

- sandbox attributes
- bridge injection placement
- startup ordering
- raw script preservation
- sidebar collapse
- sidebar bounded resizing
- sidebar full-label reveal without hover-to-frame preview
- late diff reapplication
- code, table, and list highlighting
- Mermaid entity decoding
- Mermaid merged graph layout
- narrow Mermaid node matching
- graph font metric preservation

`src/__tests__/core.test.ts` covers core extraction and diffing plus fixture
keying checks.
