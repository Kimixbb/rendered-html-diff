#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  beforeBaseHref?: string | undefined;
  afterBaseHref?: string | undefined;
}

export async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const outPath = path.resolve(options.outPath);
  const input = await loadReportInput(options.input, process.cwd());

  const report = renderStandaloneReport({
    beforeHtml: input.beforeHtml,
    afterHtml: input.afterHtml,
    beforePath: input.beforePath,
    afterPath: input.afterPath,
    beforeBaseHref: input.beforeBaseHref,
    afterBaseHref: input.afterBaseHref
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
  const [beforeSourceHtml, afterSourceHtml] = await Promise.all([
    readFile(beforePath, "utf8"),
    readFile(afterPath, "utf8")
  ]);
  const [beforeHtml, afterHtml] = await Promise.all([
    inlineLocalMediaAssets(beforeSourceHtml, beforePath),
    inlineLocalMediaAssets(afterSourceHtml, afterPath)
  ]);

  return {
    beforeHtml,
    afterHtml,
    beforePath: displayPath(cwd, beforePath),
    afterPath: displayPath(cwd, afterPath),
    beforeBaseHref: directoryBaseHref(beforePath),
    afterBaseHref: directoryBaseHref(afterPath)
  };
}

async function loadGitReportInput(input: GitFileInput, cwd: string): Promise<ReportInput> {
  const filePath = path.resolve(cwd, input.filePath);
  const repoRoot = await findGitRepoRoot(filePath);
  const repoRelativePath = path.relative(repoRoot, filePath);

  if (!repoRelativePath || isPathOutsideDirectory(repoRelativePath)) {
    throw new Error(`${input.filePath} must be inside its Git repository.`);
  }

  // Git pathspecs use forward slashes even on Windows. Convert once and reuse
  // the safe repository-relative path for both labels and Git commands.
  const gitPath = repoRelativePath.split(path.sep).join("/");
  const [beforeHtml, afterHtml] = await Promise.all([
    readGitHeadFile(repoRoot, gitPath),
    readWorkingTreeFile(filePath)
  ]);

  if (beforeHtml === null) {
    throw new Error(
      `${gitPath} does not exist in Git HEAD. Commit a baseline first, or pass explicit before and after HTML files.`
    );
  }

  const processedBeforeHtml = await inlineLocalMediaAssets(beforeHtml, filePath);
  const processedAfterHtml = await inlineLocalMediaAssets(afterHtml ?? "", filePath);

  return {
    beforeHtml: processedBeforeHtml,
    afterHtml: processedAfterHtml,
    beforePath: `${gitPath} (HEAD)`,
    afterPath: gitPath,
    beforeBaseHref: directoryBaseHref(filePath),
    afterBaseHref: directoryBaseHref(filePath)
  };
}

async function findGitRepoRoot(filePath: string): Promise<string> {
  // One-file mode can be launched from anywhere, including a directory that is
  // not a Git repository. Start Git discovery beside the target HTML file so
  // absolute paths and cross-directory invocations still use the correct repo.
  return (await runGit(["rev-parse", "--show-toplevel"], path.dirname(filePath))).trim();
}

async function readGitHeadFile(repoRoot: string, gitPath: string): Promise<string | null> {
  try {
    return await runGit(["show", `HEAD:${gitPath}`], repoRoot);
  } catch {
    // Callers decide how to handle a missing baseline. One-file mode needs a
    // committed before version, so it turns this into a clear usage error.
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

async function inlineLocalMediaAssets(html: string, sourceFilePath: string): Promise<string> {
  const baseDir = path.dirname(sourceFilePath);
  const cache = new Map<string, string | null>();
  let result = await replaceMatches(
    html,
    /\b(src|poster)\s*=\s*(["'])(.*?)\2/gi,
    async (match) => {
      const attrName = match[1]!;
      const quote = match[2]!;
      const rawUrl = match[3]!;
      const dataUri = await dataUriForLocalMedia(rawUrl, baseDir, cache);
      return dataUri ? `${attrName}=${quote}${dataUri}${quote}` : match[0]!;
    }
  );

  result = await replaceMatches(
    result,
    /\b(srcset)\s*=\s*(["'])(.*?)\2/gi,
    async (match) => {
      const attrName = match[1]!;
      const quote = match[2]!;
      const rawSrcset = match[3]!;
      const inlinedSrcset = await inlineLocalSrcset(rawSrcset, baseDir, cache);
      return inlinedSrcset === rawSrcset ? match[0]! : `${attrName}=${quote}${inlinedSrcset}${quote}`;
    }
  );

  return result;
}

async function replaceMatches(
  input: string,
  pattern: RegExp,
  replacer: (match: RegExpMatchArray) => Promise<string>
): Promise<string> {
  const matches = Array.from(input.matchAll(pattern));
  let output = "";
  let cursor = 0;

  for (const match of matches) {
    const index = match.index ?? cursor;
    output += input.slice(cursor, index);
    output += await replacer(match);
    cursor = index + match[0]!.length;
  }

  return output + input.slice(cursor);
}

async function inlineLocalSrcset(
  srcset: string,
  baseDir: string,
  cache: Map<string, string | null>
): Promise<string> {
  const candidates = srcset.split(",");
  const rewritten = await Promise.all(candidates.map(async (candidate) => {
    const leading = candidate.match(/^\s*/)?.[0] ?? "";
    const trailing = candidate.match(/\s*$/)?.[0] ?? "";
    const body = candidate.trim();

    if (!body || body.toLowerCase().startsWith("data:")) {
      return candidate;
    }

    const parts = body.split(/\s+/);
    const rawUrl = parts[0]!;
    const descriptor = parts.slice(1).join(" ");
    const dataUri = await dataUriForLocalMedia(rawUrl, baseDir, cache);

    if (!dataUri) {
      return candidate;
    }

    return `${leading}${dataUri}${descriptor ? ` ${descriptor}` : ""}${trailing}`;
  }));

  return rewritten.join(",");
}

async function dataUriForLocalMedia(
  rawUrl: string,
  baseDir: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const assetPath = resolveLocalMediaPath(rawUrl, baseDir);
  if (!assetPath) {
    return null;
  }

  const cacheKey = assetPath.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const mimeType = mediaMimeType(assetPath);
  if (!mimeType) {
    cache.set(cacheKey, null);
    return null;
  }

  try {
    const bytes = await readFile(assetPath);
    const dataUri = `data:${mimeType};base64,${bytes.toString("base64")}`;
    cache.set(cacheKey, dataUri);
    return dataUri;
  } catch {
    // Missing optional assets should not stop a report from being generated.
    // Leave the original URL in place so the author can still diagnose it.
    cache.set(cacheKey, null);
    return null;
  }
}

function resolveLocalMediaPath(rawUrl: string, baseDir: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("#") || /^(data|blob|javascript|mailto|tel):/i.test(trimmed)) {
    return null;
  }

  const localPart = stripUrlSuffix(trimmed);
  if (!localPart || !hasEmbeddableMediaExtension(localPart)) {
    return null;
  }

  if (/^[a-zA-Z]:[\\/]/.test(localPart) || path.isAbsolute(localPart)) {
    return path.resolve(decodeLocalPath(localPart));
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return url.protocol === "file:" ? fileURLToPath(url) : null;
    } catch {
      return null;
    }
  }

  return path.resolve(baseDir, decodeLocalPath(localPart));
}

function stripUrlSuffix(value: string): string {
  return value.split("#")[0]!.split("?")[0]!;
}

function decodeLocalPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasEmbeddableMediaExtension(filePath: string): boolean {
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(filePath);
}

function mediaMimeType(filePath: string): string | null {
  switch (path.extname(filePath).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

function directoryBaseHref(filePath: string): string {
  // `srcdoc` documents normally resolve relative assets against the report
  // file. A base URL restores the original HTML directory for images and CSS.
  return pathToFileURL(`${path.dirname(filePath)}${path.sep}`).href;
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
