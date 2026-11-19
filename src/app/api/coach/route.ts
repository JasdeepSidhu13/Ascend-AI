import { nid, readJson, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { groundedReply } from "@/lib/coach";
import { rateLimited } from "@/lib/limit";
import { narrateFinding } from "@/lib/narrate";
import type { Finding } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withProfile(request, async (profile) => {
    const rows = await sql<{ id: string; role: string; body: string; created_at: string }>(
      `select id, role, body, created_at::text as created_at
       from coach_messages where user_id = $1 order by created_at desc limit 40`,
      [profile.id],
    );
    return json({ messages: rows.reverse() });
  });
}

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    if (rateLimited(`coach:${profile.id}`, 20, 15 * 60 * 1000)) {
      return json({ error: "too_many" }, 429);
    }
    const body = (await request.json()) as { message?: string };
    const message = (body.message ?? "").trim().slice(0, 500);
    if (message.length < 3) return json({ error: "short" }, 400);
    await sql(`insert into coach_messages (id, user_id, role, body) values ($1,$2,'user',$3)`, [
      nid("cm"),
      profile.id,
      message,
    ]);
    const findings = await sql<{
      id: string;
      type: string;
      metric_keys: unknown;
      stats: unknown;
      evidence_ids: unknown;
      score: number;
    }>(
      `select id, type, metric_keys, stats, evidence_ids, score
       from findings where user_id = $1 order by computed_at desc limit 20`,
      [profile.id],
    );
    const mapped: Finding[] = findings.map((f) => {
      const row: Finding = {
        id: f.id,
        type: f.type as Finding["type"],
        metricKeys: readJson<string[]>(f.metric_keys, []),
        stats: readJson<Record<string, number | string>>(f.stats, {}),
        evidenceIds: readJson<string[]>(f.evidence_ids, []),
        score: Number(f.score),
        summary: "",
      };
      row.summary = narrateFinding(row, "gentle").body;
      return row;
    });
    const goals = await sql<{ title: string }>(
      `select title from goals where user_id = $1 and status = 'active'`,
      [profile.id],
    );
    const reply = groundedReply(message, mapped, goals.map((g) => g.title));
    await sql(
      `insert into coach_messages (id, user_id, role, body, finding_ids) values ($1,$2,'coach',$3,$4::jsonb)`,
      [nid("cm"), profile.id, reply.body, JSON.stringify(reply.findingIds)],
    );
    return json(reply);
  });
}
