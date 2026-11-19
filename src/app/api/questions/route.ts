import { AREAS, METRIC_LABELS } from "@/lib/catalog";
import { asJson, nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withProfile(request, async (profile) => {
    const rows = await sql(
      `select id, prompt, type, metric_key, source, area_id from questions where owner_id = $1 order by id`,
      [profile.id],
    );
    return json({ questions: rows, metrics: Object.keys(METRIC_LABELS) });
  });
}

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      prompt?: string;
      areaKey?: string;
      metricKey?: string;
      type?: string;
    };
    const prompt = (body.prompt ?? "").trim();
    if (prompt.length < 8) return json({ error: "short" }, 400);
    const area = AREAS.find((a) => a.key === body.areaKey) ?? AREAS[0];
    const metric = body.metricKey && METRIC_LABELS[body.metricKey] ? body.metricKey : null;
    const id = nid("qu");
    await sql(
      `insert into questions (id, area_id, dimension, prompt, type, cadence, metric_key, est_seconds, source, owner_id, kinds_json)
       values ($1,$2,$3,$4,$5,7,$6,14,'user',$7,$8::jsonb)`,
      [
        id,
        area.id,
        metric ?? `${area.key}.custom`,
        prompt,
        body.type ?? "scale",
        metric,
        profile.id,
        asJson(["pulse", "weekly"]),
      ],
    );
    return json({ id });
  });
}
