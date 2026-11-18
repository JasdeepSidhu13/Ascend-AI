import { AREAS } from "@/lib/catalog";
import { nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { isoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      title: string;
      why?: string;
      areaKey?: string;
      dueOn: string;
      metricKey?: string;
      baseline?: number;
      target?: number;
      unit?: string;
    };
    if (!body.title?.trim()) return json({ error: "title_required" }, 400);
    const area = AREAS.find((a) => a.key === body.areaKey) ?? AREAS[2];
    const id = nid("g");
    await sql(
      `insert into goals (id, user_id, area_id, title, why, starts_on, due_on, status)
       values ($1,$2,$3,$4,$5,$6,$7,'active')`,
      [id, profile.id, area.id, body.title.trim(), body.why ?? "", isoDate(new Date()), body.dueOn],
    );
    if (body.metricKey && body.target != null) {
      await sql(
        `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [nid("kr"), id, profile.id, body.metricKey, body.baseline ?? 0, body.target, body.unit ?? "", body.dueOn],
      );
    }
    return json({ id });
  });
}
