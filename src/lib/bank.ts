import { CATALOG, type CatalogQuestion } from "./catalog";
import { readJson, sql } from "./db";
import type { QuestionType, SessionKind } from "./types";

export async function loadBank(userId: string): Promise<CatalogQuestion[]> {
  const extra = await sql<{
    id: string;
    area_id: string;
    dimension: string;
    prompt: string;
    type: string;
    options: unknown;
    cadence: number;
    metric_key: string | null;
    est_seconds: number;
    source: string;
    unit: string;
    kinds_json: unknown;
  }>(
    `select id, area_id, dimension, prompt, type, options, cadence, metric_key, est_seconds, source, unit, kinds_json
     from questions
     where active = true and owner_id = $1`,
    [userId],
  );
  const mapped: CatalogQuestion[] = extra.map((q) => ({
    id: q.id,
    areaId: q.area_id,
    dimension: q.dimension,
    prompt: q.prompt,
    type: q.type as QuestionType,
    options: readJson<string[]>(q.options, []),
    cadence: q.cadence,
    metricKey: q.metric_key,
    estSeconds: q.est_seconds,
    source: q.source === "user" || q.source === "generated" || q.source === "program" ? "curated" : "curated",
    unit: q.unit,
    kinds: readJson<SessionKind[]>(q.kinds_json, ["weekly"]),
  }));
  const ids = new Set(mapped.map((q) => q.id));
  return [...CATALOG.filter((q) => !ids.has(q.id)), ...mapped];
}

export function fromBank(bank: CatalogQuestion[], id: string) {
  return bank.find((q) => q.id === id) ?? CATALOG.find((q) => q.id === id);
}
