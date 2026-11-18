import { questionById } from "./catalog";
import { asJson, nid, sql } from "./db";
import { isoDate, parseDate, startOfWeek } from "./dates";
import type { MetricPoint } from "./types";

type ResponseRow = {
  id: string;
  question_id: string;
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  answered_at: string | Date;
  skipped: boolean;
};

export function valueFromResponse(row: ResponseRow): number | null {
  if (row.skipped) return null;
  const q = questionById(row.question_id);
  if (!q) return row.value_num;
  if (q.type === "yes_no") {
    if (row.value_num != null) return row.value_num >= 0.5 ? 1 : 0;
    const t = (row.value_text ?? "").toLowerCase();
    if (t === "yes") return 1;
    if (t === "no") return 0;
    return null;
  }
  if (q.type === "time") {
    if (row.value_num != null) return row.value_num;
    const t = row.value_text ?? "";
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return Number(m[1]) + Number(m[2]) / 60;
    return null;
  }
  return row.value_num;
}

export async function ingestResponses(userId: string, rows: ResponseRow[]): Promise<void> {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const q = questionById(row.question_id);
    if (!q?.metricKey) continue;
    const v = valueFromResponse(row);
    if (v == null) continue;
    const at = parseDate(row.answered_at);
    const day = isoDate(at);
    const week = isoDate(startOfWeek(at));
    const grain = q.cadence <= 1 ? "day" : "week";
    const period = grain === "day" ? day : week;
    const key = `${q.metricKey}|${period}|${grain}`;
    const arr = buckets.get(key) ?? [];
    arr.push(v);
    buckets.set(key, arr);
    if (grain === "day") {
      const wkey = `${q.metricKey}|${week}|week`;
      const warr = buckets.get(wkey) ?? [];
      warr.push(v);
      buckets.set(wkey, warr);
    }
  }
  for (const [key, vals] of buckets) {
    const [metricKey, periodStart, grain] = key.split("|");
    const value = vals.reduce((a, b) => a + b, 0) / vals.length;
    await sql(
      `insert into metric_points (user_id, metric_key, period_start, grain, value, n)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, metric_key, period_start, grain)
       do update set
         value = (metric_points.value * metric_points.n + excluded.value * excluded.n)
                 / (metric_points.n + excluded.n),
         n = metric_points.n + excluded.n`,
      [userId, metricKey, periodStart, grain, value, vals.length],
    );
  }
}

export async function loadSeries(userId: string): Promise<
  { key: string; grain: "day" | "week"; points: MetricPoint[] }[]
> {
  const rows = await sql<{
    metric_key: string;
    period_start: string;
    grain: "day" | "week";
    value: number;
    n: number;
  }>(
    `select metric_key, period_start::text as period_start, grain, value, n
     from metric_points where user_id = $1 order by period_start`,
    [userId],
  );
  const map = new Map<string, MetricPoint[]>();
  for (const r of rows) {
    const k = `${r.metric_key}|${r.grain}`;
    const arr = map.get(k) ?? [];
    arr.push({
      metricKey: r.metric_key,
      periodStart: r.period_start.slice(0, 10),
      grain: r.grain,
      value: Number(r.value),
      n: Number(r.n),
    });
    map.set(k, arr);
  }
  return [...map.entries()].map(([k, points]) => {
    const [key, grain] = k.split("|") as [string, "day" | "week"];
    return { key, grain, points };
  });
}

export async function recordEvent(
  userId: string,
  name: string,
  props: Record<string, unknown> = {},
): Promise<void> {
  await sql(
    `insert into events (id, user_id, name, props) values ($1, $2, $3, $4::jsonb)`,
    [nid("e"), userId, name, asJson(props)],
  );
}
