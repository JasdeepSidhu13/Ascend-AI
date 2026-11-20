import { AREA_SCORE_METRICS, AREAS, METRIC_LABELS } from "./catalog";
import { readJson, sql } from "./db";
import { emptyTeaching } from "./engine";
import { paceStatus } from "./findings";
import { projectLinear, round, slope } from "./stats";
import { dueSession } from "./sessions";
import { dueNudges } from "./nudges";
import type { Finding, Profile } from "./types";
import { addDays, isoDate, startOfWeek } from "./dates";
import { areaName } from "./memory";

export async function dashboardState(profile: Profile) {
  const userId = profile.id;
  const weeklyCount = await sql<{ c: number }>(
    `select count(*)::int as c from sessions
     where user_id = $1 and kind = 'weekly' and completed_at is not null`,
    [userId],
  );
  const checkIns = weeklyCount[0]?.c ?? 0;
  const pulseDays = await sql<{ c: number }>(
    `select count(*)::int as c from sessions
     where user_id = $1 and kind = 'pulse' and completed_at is not null`,
    [userId],
  );
  const mornings = pulseDays[0]?.c ?? 0;
  const insights = await sql<{
    id: string;
    title: string;
    body: string;
    suggested_action: string;
    confidence: string;
    evidence: unknown;
    shown_at: string;
    finding_ids: unknown;
  }>(
    `select id, title, body, suggested_action, confidence, evidence, shown_at::text as shown_at, finding_ids
     from insights where user_id = $1 order by rank asc, shown_at desc limit 8`,
    [userId],
  );
  const feedback = await sql<{ insight_id: string; useful: boolean }>(
    `select insight_id, useful from insight_feedback where user_id = $1`,
    [userId],
  );
  const rated = new Map(feedback.map((f) => [f.insight_id, f.useful]));
  const leading = insights[0]
    ? {
        ...mapInsight(insights[0], rated.get(insights[0].id) ?? null),
      }
    : null;

  const wheel = await lifeWheel(userId);
  const trends = await areaTrends(userId);
  const goals = await goalPaces(userId);
  const actions = await sql<{
    id: string;
    text: string;
    trigger: string;
    status: string;
    due_on: string | null;
    expected_metric: string | null;
  }>(
    `select id, text, trigger, status, due_on::text as due_on, expected_metric
     from actions where user_id = $1 and status in ('active','done','skipped','shrunk')
     order by created_at desc limit 12`,
    [userId],
  );
  const heatmap = await habitHeatmap(userId);
  const memories = await sql<{
    id: string;
    layer: string;
    area_id: string | null;
    text: string;
    confidence: number;
    confirmed: boolean;
    paused: boolean;
    valid_until: string | null;
    source_response_id: string | null;
    created_at: string;
  }>(
    `select id, layer, area_id, text, confidence, confirmed, paused,
            valid_until::text as valid_until, source_response_id, created_at::text as created_at
     from memories
     where user_id = $1 and superseded_by is null
     order by created_at desc`,
    [userId],
  );
  const pendingRemember = memories.filter((m) => m.layer === "fact" && !m.confirmed && !m.paused);
  const due = await dueSession(userId);
  const completion = actionCompletion(actions.map((a) => a.status));
  const monthly = await monthlyReport(userId, wheel, goals, insights.map((i) => i.title));
  const nudges = await dueNudges(profile, due);
  const helpful = feedback.filter((f) => f.useful).length;
  const ratedN = feedback.length;
  const offTrack = goals.filter((g) => g.keyResults.some((kr) => kr.status === "off_track"));

  return {
    profile,
    leading,
    insights: insights.map((i) => mapInsight(i, rated.get(i.id) ?? null)),
    wheel,
    trends,
    goals,
    actions: actions.map((a) => ({
      ...a,
      dueOn: a.due_on?.slice(0, 10) ?? null,
      metricLabel: a.expected_metric ? METRIC_LABELS[a.expected_metric]?.label ?? a.expected_metric : null,
    })),
    heatmap,
    memories: memories.map((m) => ({
      ...m,
      area: areaName(m.area_id),
      validUntil: m.valid_until?.slice(0, 10) ?? null,
    })),
    pendingRemember: pendingRemember.map((m) => ({ id: m.id, text: m.text, area: areaName(m.area_id) })),
    due,
    completion,
    teaching: emptyTeaching(mornings || checkIns),
    checkIns,
    progress: {
      mornings,
      earlyAt: 3,
      firmAt: 6,
    },
    monthly,
    sample: profile.sampleData,
    nudges,
    quality: {
      helpfulRate: ratedN ? Math.round((helpful / ratedN) * 100) : null,
      actionRate: Math.round(completion.rate * 100),
      checkIns,
    },
    offTrack: offTrack.map((g) => ({ id: g.id, title: g.title })),
  };
}

function mapInsight(
  i: {
    id: string;
    title: string;
    body: string;
    suggested_action: string;
    confidence: string;
    evidence: unknown;
    shown_at: string;
  },
  useful: boolean | null,
) {
  const evidence = readJson<Finding[]>(i.evidence, []);
  return {
    id: i.id,
    title: i.title,
    body: i.body,
    suggestedAction: i.suggested_action,
    confidence: i.confidence,
    evidence,
    shownAt: i.shown_at,
    useful,
  };
}

async function lifeWheel(userId: string) {
  const out: { key: string; name: string; score: number | null; n: number }[] = [];
  for (const area of AREAS) {
    const metric = AREA_SCORE_METRICS[area.key];
    const rows = await sql<{ value: number; n: number }>(
      `select value, n from metric_points
       where user_id = $1 and metric_key = $2 and grain = 'week'
       order by period_start desc limit 1`,
      [userId, metric],
    );
    const count = await sql<{ c: number }>(
      `select count(*)::int as c from metric_points
       where user_id = $1 and metric_key = $2 and grain = 'week'`,
      [userId, metric],
    );
    out.push({
      key: area.key,
      name: area.name,
      score: rows[0] ? round(Number(rows[0].value), 1) : null,
      n: count[0]?.c ?? 0,
    });
  }
  return out;
}

async function areaTrends(userId: string) {
  const out: {
    key: string;
    name: string;
    unit: string;
    points: { date: string; value: number }[];
  }[] = [];
  for (const area of AREAS) {
    const metric = AREA_SCORE_METRICS[area.key];
    const rows = await sql<{ period_start: string; value: number }>(
      `select period_start::text as period_start, value from metric_points
       where user_id = $1 and metric_key = $2 and grain = 'week'
       order by period_start`,
      [userId, metric],
    );
    out.push({
      key: area.key,
      name: area.name,
      unit: METRIC_LABELS[metric]?.unit ?? "",
      points: rows.map((r) => ({
        date: r.period_start.slice(0, 10),
        value: round(Number(r.value), 2),
      })),
    });
  }
  return out;
}

async function goalPaces(userId: string) {
  const goals = await sql<{
    id: string;
    title: string;
    why: string;
    area_id: string;
    due_on: string;
    status: string;
    vision: string;
  }>(
    `select id, title, why, area_id, due_on::text as due_on, status, vision
     from goals where user_id = $1 order by due_on`,
    [userId],
  );
  const out = [];
  for (const g of goals) {
    const krs = await sql<{
      id: string;
      metric_key: string;
      baseline: number;
      target: number;
      unit: string;
      due_on: string;
    }>(
      `select id, metric_key, baseline, target, unit, due_on::text as due_on
       from key_results where goal_id = $1 and user_id = $2`,
      [g.id, userId],
    );
    const mapped = [];
    for (const kr of krs) {
      const pts = await sql<{ period_start: string; value: number }>(
        `select period_start::text as period_start, value from metric_points
         where user_id = $1 and metric_key = $2 and grain = 'week'
         order by period_start`,
        [userId, kr.metric_key],
      );
      const values = pts.map((p) => Number(p.value));
      const remaining = Math.max(
        1,
        Math.round(
          (new Date(kr.due_on).getTime() - Date.now()) / (7 * 86400000),
        ),
      );
      const projected = values.length
        ? Math.max(0, projectLinear(values, remaining))
        : Number(kr.baseline);
      const status = values.length >= 3
        ? paceStatus(projected, Number(kr.target), Number(kr.baseline))
        : "on_track";
      mapped.push({
        id: kr.id,
        metricKey: kr.metric_key,
        label: METRIC_LABELS[kr.metric_key]?.label ?? kr.metric_key,
        baseline: Number(kr.baseline),
        target: Number(kr.target),
        unit: kr.unit,
        dueOn: kr.due_on.slice(0, 10),
        current: values.length ? round(values[values.length - 1], 1) : Number(kr.baseline),
        projected: round(projected, 1),
        slope: round(slope(values), 3),
        status,
        points: pts.map((p) => ({
          date: p.period_start.slice(0, 10),
          value: round(Number(p.value), 2),
        })),
      });
    }
    out.push({
      id: g.id,
      title: g.title,
      why: g.why,
      vision: g.vision,
      area: areaName(g.area_id),
      dueOn: g.due_on.slice(0, 10),
      status: g.status,
      keyResults: mapped,
    });
  }
  return out;
}

async function habitHeatmap(userId: string) {
  const keys = ["habits.reading", "habits.meditation", "habits.deep_work", "habits.mobility"];
  const start = isoDate(addDays(startOfWeek(new Date()), -7 * 3));
  const out = [];
  for (const key of keys) {
    const rows = await sql<{ period_start: string; value: number }>(
      `select period_start::text as period_start, value from metric_points
       where user_id = $1 and metric_key = $2 and grain = 'day' and period_start >= $3
       order by period_start`,
      [userId, key, start],
    );
    out.push({
      key,
      label: METRIC_LABELS[key]?.label ?? key,
      days: rows.map((r) => ({
        date: r.period_start.slice(0, 10),
        value: Number(r.value) >= 0.5 ? 1 : 0,
      })),
    });
  }
  return out;
}

function actionCompletion(statuses: string[]) {
  const week = statuses.filter((s) => s === "active" || s === "done" || s === "skipped" || s === "shrunk");
  const done = statuses.filter((s) => s === "done").length;
  const active = statuses.filter((s) => s === "active").length;
  return {
    done,
    active,
    total: week.length,
    rate: week.length ? round(done / week.length, 2) : 0,
  };
}

async function monthlyReport(
  userId: string,
  wheel: { name: string; score: number | null }[],
  goals: { title: string; keyResults: { status: string; label: string; current: number; target: number; unit: string }[] }[],
  insightTitles: string[],
) {
  const wins = insightTitles.filter((t) => /holding|lifting|on track|personal best|streak/i.test(t));
  const drifts = wheel
    .filter((w) => w.score != null && w.score < 6)
    .map((w) => w.name);
  void userId;
  return {
    wins: wins.slice(0, 4),
    drifts,
    plan: goals
      .filter((g) => g.keyResults.some((k) => k.status !== "on_track"))
      .map((g) => g.title),
  };
}
