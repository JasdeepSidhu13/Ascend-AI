import { sql } from "./db";

export function normalizeGoalTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type GoalIdentity = {
  id: string;
  title: string;
  metricKey: string | null;
  points: number;
  createdAt: string;
};

/** Keep one active goal per metric and per title; later clones are duplicates. */
export function pickCanonicalGoals(rows: GoalIdentity[], preferId?: string): string[] {
  const sorted = [...rows].sort((a, b) => {
    if (preferId && a.id === preferId) return -1;
    if (preferId && b.id === preferId) return 1;
    return b.points - a.points || a.createdAt.localeCompare(b.createdAt);
  });
  const keep: string[] = [];
  const seenMetric = new Set<string>();
  const seenTitle = new Set<string>();
  for (const row of sorted) {
    const title = normalizeGoalTitle(row.title);
    if (!title) continue;
    if (row.metricKey && seenMetric.has(row.metricKey)) continue;
    if (seenTitle.has(title)) continue;
    keep.push(row.id);
    if (row.metricKey) seenMetric.add(row.metricKey);
    seenTitle.add(title);
  }
  return keep;
}

export async function pauseDuplicateGoals(userId: string, preferId?: string): Promise<number> {
  const rows = await sql<{
    id: string;
    title: string;
    created_at: string;
    metric_key: string | null;
    points: number;
  }>(
    `select g.id, g.title, g.created_at::text as created_at,
            k.metric_key,
            coalesce((
              select count(*)::int from metric_points m
              where m.user_id = g.user_id and m.metric_key = k.metric_key
            ), 0) as points
     from goals g
     left join key_results k on k.goal_id = g.id
     where g.user_id = $1 and g.status = 'active'`,
    [userId],
  );
  const keep = new Set(
    pickCanonicalGoals(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        metricKey: r.metric_key,
        points: Number(r.points) || 0,
        createdAt: r.created_at,
      })),
      preferId,
    ),
  );
  const extras = [...new Set(rows.map((r) => r.id).filter((id) => !keep.has(id)))];
  for (const id of extras) {
    await sql(
      `update goals set status = 'paused' where id = $1 and user_id = $2 and status = 'active'`,
      [id, userId],
    );
  }
  return extras.length;
}

export async function activeGoalForMetric(userId: string, metricKey: string) {
  const rows = await sql<{ id: string }>(
    `select g.id from goals g
     join key_results k on k.goal_id = g.id
     where g.user_id = $1 and g.status = 'active' and k.metric_key = $2
     order by g.created_at asc
     limit 1`,
    [userId, metricKey],
  );
  return rows[0]?.id ?? null;
}
