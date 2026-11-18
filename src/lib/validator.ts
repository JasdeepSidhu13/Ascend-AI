import type { Finding, InsightDraft } from "./types";
import { medicalLanguage } from "./narrate";
import { similarity, embedText } from "./embed";

export type Validation = { ok: boolean; reason?: string };

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?<![A-Za-z])[-+]?\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[0]);
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

export function numbersInFindings(findings: Finding[]): number[] {
  const out: number[] = [];
  for (const f of findings) {
    for (const v of Object.values(f.stats)) {
      if (typeof v === "number") out.push(v);
    }
  }
  return out;
}

export function numberAllowed(n: number, allowed: number[]): boolean {
  return allowed.some((a) => Math.abs(a - n) < 0.05 || Math.abs(a - n) < 0.051 * Math.max(1, Math.abs(a)));
}

export function validateInsight(
  draft: InsightDraft,
  findings: Finding[],
  recentBodies: string[],
): Validation {
  const cited = findings.filter((f) => draft.findingIds.includes(f.id));
  if (cited.length === 0) return { ok: false, reason: "no_evidence" };
  const text = `${draft.title} ${draft.body} ${draft.suggestedAction}`;
  if (medicalLanguage(text)) return { ok: false, reason: "medical" };
  const allowed = numbersInFindings(cited);
  const used = extractNumbers(draft.body);
  for (const n of used) {
    if (!numberAllowed(n, allowed)) return { ok: false, reason: `number:${n}` };
  }
  const emb = embedText(draft.body);
  for (const prev of recentBodies) {
    if (similarity(emb, embedText(prev)) >= 0.9) return { ok: false, reason: "duplicate" };
  }
  return { ok: true };
}

export function fallbackDrafts(findings: Finding[], make: (f: Finding) => InsightDraft, recentBodies: string[]): InsightDraft[] {
  const out: InsightDraft[] = [];
  for (const f of findings) {
    const d = make(f);
    const v = validateInsight(d, [f], recentBodies);
    if (v.ok) out.push(d);
    if (out.length >= 5) break;
  }
  return out;
}
