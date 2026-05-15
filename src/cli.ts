#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderStandaloneReport } from "./report.js";

interface CliOptions {
  beforePath: string;
  afterPath: string;
  outPath: string;
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const beforePath = path.resolve(options.beforePath);
  const afterPath = path.resolve(options.afterPath);
  const outPath = path.resolve(options.outPath);

  const [beforeHtml, afterHtml] = await Promise.all([
    readFile(beforePath, "utf8"),
    readFile(afterPath, "utf8")
  ]);

  const report = renderStandaloneReport({
    beforeHtml,
    afterHtml,
    beforePath: path.relative(process.cwd(), beforePath) || beforePath,
    afterPath: path.relative(process.cwd(), afterPath) || afterPath
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, report, "utf8");

  console.log(`Rendered HTML diff written to ${outPath}`);
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const args = [...argv];
  const outFlagIndex = args.indexOf("--out");

  if (outFlagIndex === -1 || !args[outFlagIndex + 1]) {
    throwUsageError("Missing required --out <diff.html> argument.");
  }

  const outPath = args[outFlagIndex + 1];
  args.splice(outFlagIndex, 2);

  if (args.length !== 2) {
    throwUsageError("Expected exactly two HTML input files.");
  }

  const beforePath = args[0];
  const afterPath = args[1];

  if (!beforePath || !afterPath || !outPath) {
    throwUsageError("Expected before.html, after.html, and --out diff.html.");
  }

  return {
    beforePath,
    afterPath,
    outPath
  };
}

function throwUsageError(message: string): never {
  console.error(message);
  printUsage();
  process.exit(1);
}

function printUsage(): void {
  console.log(`Usage:
  rendered-html-diff <before.html> <after.html> --out <diff.html>

Examples:
  npm run demo
  npm run rhd -- fixtures/before.html fixtures/after.html --out dist/demo.html`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
