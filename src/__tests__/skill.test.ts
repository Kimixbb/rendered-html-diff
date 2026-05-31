import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const skillPath = "SKILL.md";

test("repository is packaged as a Codex skill", () => {
  assert.equal(existsSync(skillPath), true, "SKILL.md should exist at the repo root");

  const skill = readFileSync(skillPath, "utf8");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);

  assert(frontmatter, "SKILL.md should start with YAML frontmatter");

  // Codex only reads the name and description before it decides whether to
  // load a skill, so the trigger metadata needs to be complete and predictable.
  const frontmatterLines = frontmatter[1]!
    .split("\n")
    .filter((line) => line.trim().length > 0);

  assert.deepEqual(
    frontmatterLines.map((line) => line.split(":")[0]),
    ["name", "description"]
  );
  assert.match(frontmatter[1]!, /^name: rendered-html-diff$/m);
  assert.match(frontmatter[1]!, /^description: .+HTML.+diff.+reports.+/m);
});

test("skill gives agents the core rendered-html-diff workflow", () => {
  const skill = readFileSync(skillPath, "utf8");

  assert.match(skill, /npm install/);
  assert.match(skill, /npm run build/);
  assert.match(skill, /npm run rhd -- changed\.html --out diff\.html/);
  assert.match(skill, /npm run rhd -- before\.html after\.html --out diff\.html/);
  assert.match(skill, /data-diff-key/);
  assert.match(skill, /data-diff-kind="graphic"/);
  assert.match(skill, /mermaid-source-render\.js/);
  assert.match(skill, /sandbox="allow-scripts"/);
  assert.match(skill, /allow-same-origin/);
});

test("skill points to detailed references instead of duplicating every detail", () => {
  const skill = readFileSync(skillPath, "utf8");

  assert.match(skill, /\[Report Runtime\]\(docs\/report-runtime\.md\)/);
  assert.match(skill, /\[Bridge Protocol\]\(docs\/bridge-protocol\.md\)/);
  assert.match(skill, /\[Block Diff Model\]\(docs\/block-diff-model\.md\)/);
  assert.match(skill, /\[Mermaid Graph Reference\]\(docs\/mermaid-graph-reference\.md\)/);
  assert.match(skill, /\[Fixtures And QA\]\(docs\/fixtures-and-qa\.md\)/);
  assert.match(skill, /\[Maintenance Reference\]\(docs\/maintenance-reference\.md\)/);
});
