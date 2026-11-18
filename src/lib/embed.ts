import { cosine } from "./stats";

const DIM = 64;

export function embedText(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return v;
  for (const tok of tokens) {
    v[hash32(tok) % DIM] += 1;
    if (tok.length > 4) v[hash32(tok.slice(0, 4)) % DIM] += 0.4;
  }
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  if (n === 0) return v;
  return v.map((x) => x / n);
}

export function similarity(a: number[], b: number[]): number {
  return cosine(a, b);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "was",
  "were",
  "this",
  "that",
  "with",
  "from",
  "have",
  "had",
  "but",
  "not",
  "you",
  "your",
  "are",
  "our",
  "out",
  "just",
  "about",
  "into",
  "been",
]);
