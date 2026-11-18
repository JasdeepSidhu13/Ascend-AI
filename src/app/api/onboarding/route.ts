import { AREA_SCORE_METRICS, AREAS } from "@/lib/catalog";
import { asJson, nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { ingestResponses } from "@/lib/metrics";
import { isoDate } from "@/lib/dates";
import type { Tone } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      displayName?: string;
      values?: string[];
      constraints?: string;
      tone?: Tone;
      pulseHour?: number;
      wheel?: Record<string, number>;
      goals?: { title: string; areaKey: string; why: string; metricKey: string; baseline: number; target: number; unit: string; dueOn: string }[];
    };
    await sql(
      `update users set display_name = $2, values_json = $3::jsonb, constraints_text = $4, tone = $5, pulse_hour = $6, onboarding_completed_at = now(), sample_data = false
       where id = $1`,
      [
        profile.id,
        body.displayName ?? profile.displayName,
        asJson(body.values ?? []),
        body.constraints ?? "",
        body.tone === "direct" ? "direct" : "gentle",
        body.pulseHour ?? 8,
      ],
    );
    const sid = nid("s");
    await sql(
      `insert into sessions (id, user_id, kind, started_at, completed_at, selection)
       values ($1,$2,'weekly',now(),now(),'[]'::jsonb)`,
      [sid, profile.id],
    );
    const responses = [];
    for (const area of AREAS) {
      const score = body.wheel?.[area.key];
      if (score == null) continue;
      const metric = AREA_SCORE_METRICS[area.key];
      const qid =
        CATALOG_FOR[area.key] ??
        "q_health_energy";
      const rid = nid("r");
      await sql(
        `insert into responses (id, session_id, user_id, question_id, question_version, value_num, answered_at)
         values ($1,$2,$3,$4,1,$5,now())`,
        [rid, sid, profile.id, qid, score],
      );
      responses.push({
        id: rid,
        question_id: qid,
        value_num: score,
        value_text: null,
        value_json: null,
        answered_at: new Date(),
        skipped: false,
      });
      void metric;
    }
    await ingestResponses(profile.id, responses);
    for (const g of (body.goals ?? []).slice(0, 3)) {
      const area = AREAS.find((a) => a.key === g.areaKey) ?? AREAS[2];
      const gid = nid("g");
      await sql(
        `insert into goals (id, user_id, area_id, title, why, starts_on, due_on, status)
         values ($1,$2,$3,$4,$5,$6,$7,'active')`,
        [gid, profile.id, area.id, g.title, g.why ?? "", isoDate(new Date()), g.dueOn],
      );
      if (g.metricKey) {
        await sql(
          `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [nid("kr"), gid, profile.id, g.metricKey, g.baseline, g.target, g.unit, g.dueOn],
        );
      }
    }
    return json({ ok: true });
  });
}

const CATALOG_FOR: Record<string, string> = {
  career: "q_career_score",
  habits: "q_habits_score",
  health: "q_health_energy",
  mind: "q_mind_mood",
  relationships: "q_rel_score",
  finances: "q_fin_score",
  learning: "q_learn_score",
};
