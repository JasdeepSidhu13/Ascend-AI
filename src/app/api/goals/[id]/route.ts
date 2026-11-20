import { AREAS } from "@/lib/catalog";
import { nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import type { GoalStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES = new Set<GoalStatus>(["active", "paused", "completed", "dropped"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const owned = await sql<{ id: string }>(
      `select id from goals where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    const body = (await request.json()) as {
      title?: string;
      why?: string;
      dueOn?: string;
      status?: GoalStatus;
      areaKey?: string;
      vision?: string;
      metricKey?: string;
      baseline?: number;
      target?: number;
      unit?: string;
    };
    if (body.status != null && !STATUSES.has(body.status)) {
      return json({ error: "bad_status" }, 400);
    }
    const title = body.title?.trim();
    if (body.title != null && !title) return json({ error: "title_required" }, 400);
    const area = body.areaKey ? AREAS.find((a) => a.key === body.areaKey) : null;
    await sql(
      `update goals set
         title = coalesce($3, title),
         why = coalesce($4, why),
         due_on = coalesce($5::date, due_on),
         status = coalesce($6, status),
         area_id = coalesce($7, area_id),
         vision = coalesce($8, vision)
       where id = $1 and user_id = $2`,
      [
        id,
        profile.id,
        title ?? null,
        body.why ?? null,
        body.dueOn ?? null,
        body.status ?? null,
        area?.id ?? null,
        body.vision ?? null,
      ],
    );
    if (body.metricKey || body.target != null || body.baseline != null || body.dueOn) {
      const existing = await sql<{ id: string }>(
        `select id from key_results where goal_id = $1 and user_id = $2 order by id limit 1`,
        [id, profile.id],
      );
      if (existing[0]) {
        await sql(
          `update key_results set
             metric_key = coalesce($3, metric_key),
             baseline = coalesce($4, baseline),
             target = coalesce($5, target),
             unit = coalesce($6, unit),
             due_on = coalesce($7::date, due_on)
           where id = $1 and user_id = $2`,
          [
            existing[0].id,
            profile.id,
            body.metricKey ?? null,
            body.baseline ?? null,
            body.target ?? null,
            body.unit ?? null,
            body.dueOn ?? null,
          ],
        );
      } else if (body.metricKey && body.target != null) {
        await sql(
          `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            nid("kr"),
            id,
            profile.id,
            body.metricKey,
            body.baseline ?? 0,
            body.target,
            body.unit ?? "",
            body.dueOn ?? new Date().toISOString().slice(0, 10),
          ],
        );
      }
    }
    return json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(_request, async (profile) => {
    const owned = await sql<{ id: string }>(
      `select id from goals where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    await sql(`delete from share_links where goal_id = $1 and user_id = $2`, [id, profile.id]);
    await sql(`delete from key_results where goal_id = $1 and user_id = $2`, [id, profile.id]);
    await sql(`update actions set goal_id = null where goal_id = $1 and user_id = $2`, [id, profile.id]);
    await sql(`delete from goals where id = $1 and user_id = $2`, [id, profile.id]);
    return json({ ok: true });
  });
}
