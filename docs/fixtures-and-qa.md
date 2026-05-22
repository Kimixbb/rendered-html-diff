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

## Q1 Financial Report Chart Fixtures

Files:

- `fixtures/q1-financial-report-before.html`
- `fixtures/q1-financial-report-after.html`

Purpose:

- exercise SVG chart diffs with visible financial data changes
- exercise Mermaid flow chart diffs in a finance operations workflow
- exercise a same-key chart type change from pie chart to bar chart
- exercise added and removed chart blocks alongside changed chart blocks
- keep SVG labels compact and horizontal so chart text stays inside the card

Regenerate the local report with:

```bash
node dist/cli.js fixtures/q1-financial-report-before.html fixtures/q1-financial-report-after.html --out dist/q1-financial-report-diff.html
```

The fixture pair is a fictional Q1 board report for Aurora Systems. It is meant
to cover many chart shapes in one easy-to-scan report:

| Key | Chart Or Block | Expected Status | What It Exercises |
| --- | --- | --- | --- |
| `chart-kpi-strip` | KPI strip | Modified | multiple SVG value changes in a wide card |
| `chart-revenue-by-segment` | bar chart | Modified | horizontal bars and compact value labels |
| `chart-monthly-revenue` | line chart | Modified | point labels and trend-line changes |
| `chart-margin-by-segment` | stacked bar chart | Modified | dense adjacent bar labels |
| `chart-pipeline-funnel` | funnel chart | Modified | polygon chart labels |
| `chart-expense-mix` | pie chart to bar chart | Modified | same-key chart type change |
| `chart-cash-waterfall` | waterfall chart | Modified | positive and negative cash bridge values |
| `chart-liquidity-runway` | gauge chart | Added | green added chart block focus behavior |
| `chart-operating-flow` | Mermaid flow chart | Modified | graph-aware node and edge changes |
| `chart-regional-scatter` | bubble chart | Modified | leader-line labels placed away from bubbles |
| `chart-collections-heatmap` | heatmap | Modified | compact matrix labels and value changes |
| `chart-legacy-forecast-risk` | donut chart | Deleted | red deleted chart placeholder and focus |

In the Q1 report, verify:

- SVG chart value diffs render inside the graphic, using red crossed-out old
  values and green new values.
- Stacked chart value diffs do not cover each other.
- Bubble chart labels stay outside the circles and remain readable.
- Waterfall value labels do not collide with the title or subtitle.
- Clicking a modified paragraph in the sidebar shows a full-width focus halo
  around the text block.
- Clicking an added, modified, or deleted chart shows a focus halo in the same
  status color as that chart.
- Clicking a different sidebar row removes the previous focus halo while leaving
  the normal diff highlight in place.

## Manual QA Checklist

After changing report runtime behavior:

1. Run `npm test`.
2. Regenerate demos.
3. Open `dist/demo.html`.
4. Open `dist/app-flow-demo.html`.
5. Open `dist/template-editor-flow-diff.html`.
6. Open `dist/q1-financial-report-diff.html` when chart, graphic, or focus
   behavior changed.

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
- selected focus cleanup, text focus boxes, and status-colored chart focus halos
- SVG chart value diffs and stacked SVG chart label spacing
- Mermaid entity decoding
- Mermaid merged graph layout
- narrow Mermaid node matching
- graph font metric preservation

`src/__tests__/core.test.ts` covers core extraction and diffing plus fixture
keying checks.
