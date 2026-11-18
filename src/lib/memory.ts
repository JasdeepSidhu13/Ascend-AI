import { AREAS } from "./catalog";
import { asJson, nid, readJson, sql } from "./db";
import { embedText, similarity } from "./embed";
import { isoDate, addDays } from "./dates";

const SENSITIVE_AREAS = new Set(["area_health", "area_finances", "area_relationships"]);

export async function extractFacts(input: {
  userId: string;
  texts: { responseId: string; text: string; areaId: string }[];
}): Promise<{ id: string; text: string; confirmed: boolean }[]> {
  const existing = await sql<{ id: string; text: string; embedding: unknown }>(
    `select id, text, embedding from memories where user_id = $1 and layer = 'fact' and superseded_by is null`,
    [input.userId],
  );
  const created: { id: string; text: string; confirmed: boolean }[] = [];
  const candidates = input.texts.flatMap((t) =>
    candidateFacts(t.text).slice(0, 2).map((text) => ({ ...t, text })),
  );
  for (const c of candidates.slice(0, 3)) {
    const emb = embedText(c.text);
    let merged = false;
    for (const e of existing) {
      const eemb = readJson<number[]>(e.embedding, []);
      if (eemb.length && similarity(emb, eemb) > 0.9) {
        merged = true;
        break;
      }
      if (contradicts(e.text, c.text)) {
        const id = nid("m");
        const confirmed = !SENSITIVE_AREAS.has(c.areaId);
        await insertFact({
          id,
          userId: input.userId,
          areaId: c.areaId,
          text: c.text,
          source: c.responseId,
          embedding: emb,
          confirmed,
        });
        await sql(`update memories set superseded_by = $2 where id = $1`, [e.id, id]);
        created.push({ id, text: c.text, confirmed });
        merged = true;
        break;
      }
    }
    if (merged) continue;
    const id = nid("m");
    const confirmed = !SENSITIVE_AREAS.has(c.areaId);
    const shortLived = /this week|launch|busy|deadline|trip/i.test(c.text);
    await insertFact({
      id,
      userId: input.userId,
      areaId: c.areaId,
      text: c.text,
      source: c.responseId,
      embedding: emb,
      confirmed,
      validUntil: shortLived ? isoDate(addDays(new Date(), 21)) : null,
    });
    created.push({ id, text: c.text, confirmed });
  }
  return created;
}

async function insertFact(row: {
  id: string;
  userId: string;
  areaId: string;
  text: string;
  source: string;
  embedding: number[];
  confirmed: boolean;
  validUntil?: string | null;
}) {
  await sql(
    `insert into memories (id, user_id, layer, area_id, text, confidence, source_response_id, valid_until, confirmed, embedding)
     values ($1,$2,'fact',$3,$4,0.7,$5,$6,$7,$8::jsonb)`,
    [
      row.id,
      row.userId,
      row.areaId,
      row.text,
      row.source,
      row.validUntil ?? null,
      row.confirmed,
      asJson(row.embedding),
    ],
  );
}

export function candidateFacts(text: string): string[] {
  const sentences = text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 180);
  return sentences.filter((s) =>
    /\b(i|i'm|i am|my|i've|cannot|can't|always|never|best before|injury)\b/i.test(s),
  );
}

function contradicts(a: string, b: string): boolean {
  const na = /not |n't |never /.test(a.toLowerCase());
  const nb = /not |n't |never /.test(b.toLowerCase());
  if (na === nb) return false;
  const shared = a
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4 && b.toLowerCase().includes(w));
  return shared.length >= 2;
}

export async function writeEpisode(
  userId: string,
  text: string,
  layer: "episode" = "episode",
): Promise<void> {
  await sql(
    `insert into memories (id, user_id, layer, text, confidence, confirmed, embedding)
     values ($1,$2,$3,$4,0.8,true,$5::jsonb)`,
    [nid("m"), userId, layer, text, asJson(embedText(text))],
  );
}

export function areaName(id: string | null): string {
  return AREAS.find((a) => a.id === id)?.name ?? "Life";
}
