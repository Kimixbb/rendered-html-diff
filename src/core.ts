export type BlockKind =
  | "heading"
  | "paragraph"
  | "list-item"
  | "code"
  | "graphic"
  | "quote"
  | "table-row";

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface DiffBlock {
  identity: string;
  kind: BlockKind;
  tagName: string;
  text: string;
  html: string;
  headingPath: string[];
  index: number;
  diffKey?: string;
  comparisonSignature?: string;
  matchGroup?: string;
  matchIndex?: number;
}

export interface DiffEntry {
  identity: string;
  status: DiffStatus;
  kind: BlockKind;
  before?: DiffBlock;
  after?: DiffBlock;
}

export interface DiffSegment {
  type: "same" | "added" | "removed";
  value: string;
}

interface BlockMatch {
  tagName: string;
  attrs: string;
  innerHtml: string;
  fullHtml: string;
  index: number;
  kind?: BlockKind;
}

const BLOCK_PATTERN = /<(h[1-6]|p|li|pre|blockquote|tr)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const GRAPHIC_PATTERN = /<([a-z][\w:-]*)\b(?=[^>]*\bdata-diff-kind\s*=\s*(?:"graphic"|'graphic'|graphic))([^>]*)>([\s\S]*?)<\/\1>/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s+(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s+(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'")
    .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
}

export function extractBlocksFromHtml(html: string): DiffBlock[] {
  const sanitized = sanitizeHtml(html);
  const blocks: DiffBlock[] = [];
  const headingPath: string[] = [];
  const fallbackCounts = new Map<string, number>();
  const matches = collectBlockMatches(sanitized);

  for (const match of matches) {
    const { tagName, attrs, innerHtml, fullHtml } = match;
    const text = normalizeText(htmlToText(innerHtml));
    if (!text) {
      continue;
    }

    const diffKey = extractDiffKey(attrs);
    const kind = match.kind ?? blockKindForTag(tagName);
    const blockHeadingPath = compactHeadingPath(headingPath);
    const headingKey = blockHeadingPath.join(">");
    const matchGroup = `fallback:${tagName}:${headingKey}`;
    const matchIndex = (fallbackCounts.get(matchGroup) ?? 0) + 1;
    fallbackCounts.set(matchGroup, matchIndex);
    const identity = diffKey
      ? `key:${diffKey}`
      // The ordinal keeps repeated same-text blocks clickable as separate
      // targets. `matchGroup` and `matchIndex` still do the stable pairing.
      : `fallback:${tagName}:${headingKey}:${matchIndex}:${fingerprint(text)}`;

    const block: DiffBlock = {
      identity,
      kind,
      tagName,
      text,
      html: fullHtml,
      headingPath: blockHeadingPath,
      index: blocks.length
    };

    if (diffKey) {
      block.diffKey = diffKey;
    } else {
      block.matchGroup = matchGroup;
      block.matchIndex = matchIndex;
    }

    blocks.push(block);

    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName.slice(1));
      headingPath.splice(level - 1);
      headingPath[level - 1] = text;
    }
  }

  return blocks;
}

function collectBlockMatches(html: string): BlockMatch[] {
  const matches: BlockMatch[] = [];
  const graphicRanges: Array<{ start: number; end: number }> = [];

  GRAPHIC_PATTERN.lastIndex = 0;
  let graphicMatch: RegExpExecArray | null;
  while ((graphicMatch = GRAPHIC_PATTERN.exec(html)) !== null) {
    const tagName = graphicMatch[1]?.toLowerCase();
    if (!tagName) {
      continue;
    }

    const fullHtml = graphicMatch[0] ?? "";
    const start = graphicMatch.index;

    // Graphic blocks are visual units. We diff their source as one block so
    // nested labels do not become noisy paragraph or heading changes.
    matches.push({
      tagName,
      attrs: graphicMatch[2] ?? "",
      innerHtml: graphicMatch[3] ?? "",
      fullHtml,
      index: start,
      kind: "graphic"
    });
    graphicRanges.push({ start, end: start + fullHtml.length });
  }

  BLOCK_PATTERN.lastIndex = 0;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = BLOCK_PATTERN.exec(html)) !== null) {
    const tagName = blockMatch[1]?.toLowerCase();
    const start = blockMatch.index;
    if (!tagName || isInsideAnyRange(start, graphicRanges)) {
      continue;
    }

    matches.push({
      tagName,
      attrs: blockMatch[2] ?? "",
      innerHtml: blockMatch[3] ?? "",
      fullHtml: blockMatch[0] ?? "",
      index: start
    });
  }

  return matches.sort((left, right) => left.index - right.index);
}

function compactHeadingPath(headingPath: string[]): string[] {
  // Heading arrays can be sparse when a document starts at h2 or h3. Compacting
  // keeps section keys readable without changing the visible heading order.
  return headingPath.filter(Boolean);
}

function isInsideAnyRange(index: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

export function diffBlocks(beforeBlocks: DiffBlock[], afterBlocks: DiffBlock[]): DiffEntry[] {
  const beforeBuckets = bucketBlocksBy(beforeBlocks, (block) => block.identity);
  // Fallback identities include a text fingerprint, so a big rewrite changes
  // the identity. The group and index keep same-position prose paired.
  const fallbackBuckets = bucketBlocksBy(beforeBlocks, fallbackMatchKey);
  const unmatchedBefore = new Set(beforeBlocks);
  const entries: DiffEntry[] = [];

  for (const after of afterBlocks) {
    const before =
      takeUnmatched(beforeBuckets.get(after.identity), unmatchedBefore) ??
      takeUnmatched(fallbackBuckets.get(fallbackMatchKey(after)), unmatchedBefore);

    if (!before) {
      entries.push({
        identity: after.identity,
        status: "added",
        kind: after.kind,
        after
      });
      continue;
    }

    entries.push({
      identity: after.identity,
      status: blocksHaveSameRenderedContent(before, after) ? "unchanged" : "changed",
      kind: after.kind,
      before,
      after
    });
  }

  for (const before of beforeBlocks) {
    if (unmatchedBefore.has(before)) {
      entries.push({
        identity: before.identity,
        status: "removed",
        kind: before.kind,
        before
      });
    }
  }

  return entries;
}

function bucketBlocksBy(
  blocks: DiffBlock[],
  keyForBlock: (block: DiffBlock) => string
): Map<string, DiffBlock[]> {
  const buckets = new Map<string, DiffBlock[]>();

  for (const block of blocks) {
    const key = keyForBlock(block);
    if (!key) {
      continue;
    }

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(block);
    } else {
      buckets.set(key, [block]);
    }
  }

  return buckets;
}

function takeUnmatched(
  bucket: DiffBlock[] | undefined,
  unmatchedBlocks: Set<DiffBlock>
): DiffBlock | undefined {
  while (bucket && bucket.length > 0) {
    const block = bucket.shift();
    if (block && unmatchedBlocks.has(block)) {
      unmatchedBlocks.delete(block);
      return block;
    }
  }

  return undefined;
}

function fallbackMatchKey(block: DiffBlock): string {
  if (!block.identity.startsWith("fallback:") || !block.matchGroup) {
    return "";
  }

  return `${block.matchGroup}:${block.matchIndex ?? ""}`;
}

function blocksHaveSameRenderedContent(before: DiffBlock, after: DiffBlock): boolean {
  return before.text === after.text &&
    (before.comparisonSignature || "") === (after.comparisonSignature || "");
}

export function diffWords(beforeText: string, afterText: string): DiffSegment[] {
  return diffTokenSequences(tokenizeWords(beforeText), tokenizeWords(afterText));
}

export function diffLines(beforeText: string, afterText: string): DiffSegment[] {
  return diffTokenSequences(splitLines(beforeText), splitLines(afterText));
}

export function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|tr|td|th|h[1-6]|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

function extractDiffKey(attrs: string): string | undefined {
  const match =
    attrs.match(/\bdata-diff-key\s*=\s*"([^"]+)"/i) ??
    attrs.match(/\bdata-diff-key\s*=\s*'([^']+)'/i) ??
    attrs.match(/\bdata-diff-key\s*=\s*([^\s>]+)/i);

  return match?.[1]?.trim();
}

function blockKindForTag(tagName: string): BlockKind {
  if (/^h[1-6]$/.test(tagName)) {
    return "heading";
  }

  if (tagName === "li") {
    return "list-item";
  }

  if (tagName === "pre") {
    return "code";
  }

  if (tagName === "blockquote") {
    return "quote";
  }

  if (tagName === "tr") {
    return "table-row";
  }

  return "paragraph";
}

function fingerprint(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function tokenizeWords(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized.length === 0) {
    return [];
  }

  const lines = normalized.split("\n");
  return lines.map((line, index) => (index < lines.length - 1 ? `${line}\n` : line));
}

function diffTokenSequences(beforeTokens: string[], afterTokens: string[]): DiffSegment[] {
  const rows = beforeTokens.length + 1;
  const cols = afterTokens.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = beforeTokens.length - 1; i >= 0; i -= 1) {
    for (let j = afterTokens.length - 1; j >= 0; j -= 1) {
      dp[i]![j] =
        beforeTokens[i] === afterTokens[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < beforeTokens.length && j < afterTokens.length) {
    if (beforeTokens[i] === afterTokens[j]) {
      pushSegment(segments, "same", beforeTokens[i]!);
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      pushSegment(segments, "removed", beforeTokens[i]!);
      i += 1;
    } else {
      pushSegment(segments, "added", afterTokens[j]!);
      j += 1;
    }
  }

  while (i < beforeTokens.length) {
    pushSegment(segments, "removed", beforeTokens[i]!);
    i += 1;
  }

  while (j < afterTokens.length) {
    pushSegment(segments, "added", afterTokens[j]!);
    j += 1;
  }

  return segments;
}

function pushSegment(
  segments: DiffSegment[],
  type: DiffSegment["type"],
  value: string
): void {
  const previous = segments.at(-1);
  if (previous?.type === type) {
    previous.value += value;
    return;
  }

  segments.push({ type, value });
}

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, body: string) => {
    if (body.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }

    if (body.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }

    return namedEntities[body] ?? entity;
  });
}
