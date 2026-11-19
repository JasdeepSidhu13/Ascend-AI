import { sql } from "./db";

export async function recordEffectiveness(
  userId: string,
  actionType: string,
  expectedMetric: string | null,
  direction: string,
) {
  if (!expectedMetric) {
    await bump(userId, actionType, false);
    return;
  }
  const pts = await sql<{ period_start: string; value: number }>(
    `select period_start::text as period_start, value from metric_points
     where user_id = $1 and metric_key = $2 and grain = 'week'
     order by period_start desc limit 6`,
    [userId, expectedMetric],
  );
  const values = pts.map((p) => Number(p.value)).reverse();
  if (values.length < 3) {
    await bump(userId, actionType, false);
    return;
  }
  const prior = values.slice(0, Math.max(1, values.length - 2)).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 2);
  const recent = values.slice(-2).reduce((a, b) => a + b, 0) / 2;
  const movedUp = recent > prior + 0.05;
  const win = direction === "down" ? !movedUp && recent < prior - 0.05 : movedUp;
  await bump(userId, actionType, win);
}

async function bump(userId: string, actionType: string, win: boolean) {
  const row = await sql<{ tries: number; wins: number }>(
    `select tries, wins from action_effectiveness where user_id = $1 and action_type = $2`,
    [userId, actionType],
  );
  const tries = (row[0]?.tries ?? 0) + 1;
  const wins = (row[0]?.wins ?? 0) + (win ? 1 : 0);
  const score = wins / tries;
  if (row[0]) {
    await sql(
      `update action_effectiveness set tries = $3, wins = $4, score = $5 where user_id = $1 and action_type = $2`,
      [userId, actionType, tries, wins, score],
    );
  } else {
    await sql(
      `insert into action_effectiveness (user_id, action_type, tries, wins, score) values ($1,$2,$3,$4,$5)`,
      [userId, actionType, tries, wins, score],
    );
  }
}

export function actionTypeFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("run") || t.includes("km")) return "run";
  if (t.includes("sleep") || t.includes("lights out")) return "sleep";
  if (t.includes("deep-work") || t.includes("deep work")) return "deep_work";
  if (t.includes("read")) return "read";
  if (t.includes("meditat")) return "meditate";
  if (t.includes("walk")) return "walk";
  return "other";
}
