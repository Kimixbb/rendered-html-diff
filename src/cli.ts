#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { renderStandaloneReport } from "./report.js";

const GIT_COMMAND_MAX_BUFFER = 100 * 1024 * 1024;

// The CLI accepts two input shapes. The `kind` field lets TypeScript check that
// every code path handles both the old before/after style and the Git style.
export type CliInput = FilePairInput | GitFileInput;

export interface FilePairInput {
  kind: "file-pair";
  beforePath: string;
  afterPath: string;
}

export interface GitFileInput {
  kind: "git-file";
  filePath: string;
}

export interface CliOptions {
  input: CliInput;
  outPath: string;
}

export interface ReportInput {
  beforeHtml: string;
  afterHtml: string;
  beforePath: string;
  afterPath: string;
}

export async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const outPath = path.resolve(options.outPath);
  const input = await loadReportInput(options.input, process.cwd());

  const report = renderStandaloneReport({
    beforeHtml: input.beforeHtml,
    afterHtml: input.afterHtml,
    beforePath: input.beforePath,
    afterPath: input.afterPath
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, report, "utf8");

  console.log(`Rendered HTML diff written to ${outPath}`);
}

export function parseArgs(argv: string[]): CliOptions {
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

  if (args.length !== 1 && args.length !== 2) {
    throwUsageError("Expected one changed HTML file, or explicit before and after HTML files.");
  }

  if (!args.every(Boolean) || !outPath) {
    throwUsageError("Expected HTML input file paths and --out diff.html.");
  }

  return {
    input: args.length === 1
      ? {
        kind: "git-file",
        filePath: args[0]!
      }
      : {
        kind: "file-pair",
        beforePath: args[0]!,
        afterPath: args[1]!
      },
    outPath
  };
}

export async function loadReportInput(input: CliInput, cwd: string): Promise<ReportInput> {
  if (input.kind === "git-file") {
    return loadGitReportInput(input, cwd);
  }

  const beforePath = path.resolve(cwd, input.beforePath);
  const afterPath = path.resolve(cwd, input.afterPath);
  const [beforeHtml, afterHtml] = await Promise.all([
    readFile(beforePath, "utf8"),
    readFile(afterPath, "utf8")
  ]);

  return {
    beforeHtml,
    afterHtml,
    beforePath: displayPath(cwd, beforePath),
    afterPath: displayPath(cwd, afterPath)
  };
}

async function loadGitReportInput(input: GitFileInput, cwd: string): Promise<ReportInput> {
  const repoRoot = (await runGit(["rev-parse", "--show-toplevel"], cwd)).trim();
  const filePath = path.resolve(cwd, input.filePath);
  const repoRelativePath = path.relative(repoRoot, filePath);

  if (!repoRelativePath || isPathOutsideDirectory(repoRelativePath)) {
    throw new Error(`${input.filePath} must be inside the current Git repository.`);
  }

  // Git pathspecs use forward slashes even on Windows. Convert once and reuse
  // the safe repository-relative path for both labels and Git commands.
  const gitPath = repoRelativePath.split(path.sep).join("/");
  const [beforeHtml, afterHtml] = await Promise.all([
    readGitHeadFile(repoRoot, gitPath),
    readWorkingTreeFile(filePath)
  ]);

  if (beforeHtml === null && afterHtml === null) {
    throw new Error(`Could not read ${gitPath} from Git HEAD or the working tree.`);
  }

  return {
    beforeHtml: beforeHtml ?? "",
    afterHtml: afterHtml ?? "",
    beforePath: `${gitPath} (HEAD)`,
    afterPath: gitPath
  };
}

async function readGitHeadFile(repoRoot: string, gitPath: string): Promise<string | null> {
  try {
    return await runGit(["show", `HEAD:${gitPath}`], repoRoot);
  } catch {
    // A missing file in HEAD means Git sees this as a new file. Returning empty
    // HTML lets the report mark all semantic blocks as additions.
    return null;
  }
}

async function readWorkingTreeFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        encoding: "utf8",
        maxBuffer: GIT_COMMAND_MAX_BUFFER
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }

        resolve(stdout);
      }
    );
  });
}

function displayPath(cwd: string, filePath: string): string {
  return path.relative(cwd, filePath) || filePath;
}

function isPathOutsideDirectory(relativePath: string): boolean {
  return relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT";
}

function throwUsageError(message: string): never {
  console.error(message);
  printUsage();
  process.exit(1);
}

function printUsage(): void {
  console.log(`Usage:
  rendered-html-diff <changed.html> --out <diff.html>
  rendered-html-diff <before.html> <after.html> --out <diff.html>

Examples:
  npm run demo
  npm run rhd -- fixtures/before.html --out dist/demo.html
  npm run rhd -- fixtures/before.html fixtures/after.html --out dist/demo.html`);
}

function isDirectCliRun(): boolean {
  const executedPath = process.argv[1];

  if (!executedPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(executedPath)).href;
}

if (isDirectCliRun()) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
