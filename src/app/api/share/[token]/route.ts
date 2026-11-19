import { json } from "@/lib/auth";
import { sql } from "@/lib/db";
import { paceStatus } from "@/lib/findings";
import { projectLinear } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await sql<{ goal_id: string; user_id: string }>(
    `select goal_id, user_id from share_links where token = $1`,
    [token],
  );
  if (!link[0]) return json({ error: "not_found" }, 404);
  const goal = await sql<{ title: string; why: string; due_on: string }>(
    `select title, why, due_on::text as due_on from goals where id = $1`,
    [link[0].goal_id],
  );
  if (!goal[0]) return json({ error: "not_found" }, 404);
  const kr = await sql<{ metric_key: string; baseline: number; target: number; unit: string; due_on: string }>(
    `select metric_key, baseline, target, unit, due_on::text as due_on
     from key_results where goal_id = $1 limit 1`,
    [link[0].goal_id],
  );
  let status = "on_track";
  let current = kr[0]?.baseline ?? 0;
  if (kr[0]) {
    const pts = await sql<{ value: number }>(
      `select value from metric_points
       where user_id = $1 and metric_key = $2 and grain = 'week'
       order by period_start`,
      [link[0].user_id, kr[0].metric_key],
    );
    const values = pts.map((p) => Number(p.value));
    current = values.at(-1) ?? Number(kr[0].baseline);
    const weeks = Math.max(1, Math.round((new Date(kr[0].due_on).getTime() - Date.now()) / (7 * 86400000)));
    const projected = projectLinear(values, weeks);
    status = paceStatus(projected, Number(kr[0].target), Number(kr[0].baseline));
  }
  return json({
    title: goal[0].title,
    why: goal[0].why,
    dueOn: goal[0].due_on.slice(0, 10),
    current,
    target: kr[0]?.target ?? null,
    unit: kr[0]?.unit ?? "",
    status,
  });
}
