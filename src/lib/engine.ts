import { AREAS, METRIC_LABELS, questionById } from "./catalog";
import { asJson, nid, readJson, sql } from "./db";
import { detectCrisis } from "./crisis";
import { followThrough } from "./actions";
import { extractFacts, writeEpisode } from "./memory";
import { embedText } from "./embed";
import { ingestResponses, loadSeries, recordEvent } from "./metrics";
import {
  computeFindings,
  rankTop,
  type GoalPaceInput,
  type Series,
} from "./findings";
import { narrateFinding, narrateWithModel } from "./narrate";
import { fallbackDrafts, validateInsight } from "./validator";
import type { Finding, InsightDraft, Tone } from "./types";
import { isoDate, startOfWeek } from "./dates";

type ResponseRow = {
  id: string;
  question_id: string;
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  answered_at: string | Date;
  skipped: boolean;
};

export async function completeSession(userId: string, sessionId: string) {
  const responses = await sql<ResponseRow>(
    `select id, question_id, value_num, value_text, value_json, answered_at, skipped
     from responses where session_id = $1 and user_id = $2`,
    [sessionId, userId],
  );
  const texts = responses.map((r) => r.value_text ?? "").filter(Boolean);
  if (detectCrisis(texts)) {
    await sql(
      `update sessions set completed_at = now() where id = $1 and user_id = $2`,
      [sessionId, userId],
    );
    await recordEvent(userId, "crisis_route", { sessionId });
    return { crisis: true as const, insights: [] as string[] };
  }
  await ingestResponses(userId, responses);
  const follow = responses.find((r) => r.question_id === "q_action_followup");
  if (follow) {
    const done = (follow.value_text ?? "").toLowerCase() === "yes" || follow.value_num === 1;
    const barrier = responses.find((r) => r.question_id === "q_action_barrier");
    const tags = readJson<string[]>(barrier?.value_json, []);
    await followThrough(userId, done, tags);
  }
  await extractFacts({
    userId,
    texts: responses
      .filter((r) => (r.value_text ?? "").length > 20)
      .map((r) => ({
        responseId: r.id,
        text: r.value_text ?? "",
        areaId: questionById(r.question_id)?.areaId ?? "area_mind",
      })),
  });
  for (const r of responses) {
    if ((r.value_text ?? "").length > 12) {
      await sql(
        `insert into response_embeddings (response_id, user_id, embedding)
         values ($1,$2,$3::jsonb)
         on conflict (response_id) do update set embedding = excluded.embedding`,
        [r.id, userId, asJson(embedText(r.value_text ?? ""))],
      );
    }
  }
  await sql(
    `update sessions set completed_at = now() where id = $1 and user_id = $2`,
    [sessionId, userId],
  );
  const insights = await recomputeInsights(userId, sessionId);
  const session = await sql<{ kind: string }>(`select kind from sessions where id = $1`, [sessionId]);
  if (session[0]?.kind === "weekly" || session[0]?.kind === "monthly") {
    await writeEpisode(userId, episodeFrom(responses, insights.titles));
  }
  await recordEvent(userId, "session_completed", { sessionId, kind: session[0]?.kind });
  return { crisis: false as const, insights: insights.ids };
}

export async function recomputeInsights(userId: string, sessionId?: string) {
  const user = await sql<{ tone: Tone }>(`select tone from users where id = $1`, [userId]);
  const tone = user[0]?.tone ?? "gentle";
  const series = mergeSeries(await loadSeries(userId));
  const paces = await loadPaces(userId);
  const themes = await loadThemes(userId);
  const wins = await loadWins(userId, series);
  const goalMetrics = paces.map((p) => p.metricKey);
  const recent = await sql<{ body: string; finding_ids: unknown }>(
    `select body, finding_ids from insights
     where user_id = $1 and shown_at > now() - interval '28 days'
     order by shown_at desc`,
    [userId],
  );
  const recentKeys = recent.flatMap((r) => {
    const ids = readJson<string[]>(r.finding_ids, []);
    return ids;
  });
  const typeWeights = await learnedWeights(userId);
  const findings = computeFindings({
    series,
    paces,
    themes,
    wins,
    goalMetrics,
    recentInsightKeys: recentKeys,
    typeWeights,
  });
  for (const f of findings.slice(0, 12)) {
    await sql(
      `insert into findings (id, user_id, type, metric_keys, stats, evidence_ids, score, session_id)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8)`,
      [
        f.id,
        userId,
        f.type,
        asJson(f.metricKeys),
        asJson(f.stats),
        asJson(f.evidenceIds),
        f.score,
        sessionId ?? null,
      ],
    );
  }
  const top = rankTop(findings, 5);
  const recentBodies = recent.map((r) => r.body);
  let drafts: InsightDraft[] = [];
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  if (apiKey && top.length) {
    const ctx = await assembleContext(userId, top);
    const fromModel = await narrateWithModel({
      findings: top,
      tone,
      goals: ctx.goals,
      memories: ctx.facts,
      apiKey,
    });
    if (fromModel) {
      drafts = fromModel.filter((d) => validateInsight(d, top, recentBodies).ok);
    }
  }
  if (drafts.length < 3) {
    drafts = fallbackDrafts(top, (f) => narrateFinding(f, tone), recentBodies);
  }
  const ids: string[] = [];
  const titles: string[] = [];
  for (const [rank, d] of drafts.slice(0, 5).entries()) {
    const id = nid("ins");
    await sql(
      `insert into insights (id, user_id, finding_ids, title, body, suggested_action, confidence, model, prompt_version, evidence, rank)
       values ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
      [
        id,
        userId,
        asJson(d.findingIds),
        d.title,
        d.body,
        d.suggestedAction,
        d.confidence,
        apiKey ? "claude" : "rules",
        apiKey ? "claude-v1" : "rules-v1",
        asJson(top.filter((f) => d.findingIds.includes(f.id))),
        rank,
      ],
    );
    ids.push(id);
    titles.push(d.title);
  }
  return { ids, titles, findings: top };
}

function mergeSeries(rows: Series[]): Series[] {
  const map = new Map<string, Series>();
  for (const s of rows) {
    const cur = map.get(s.key);
    if (!cur) map.set(s.key, { key: s.key, grain: s.grain, points: [...s.points] });
    else cur.points.push(...s.points);
  }
  return [...map.values()].map((s) => ({
    ...s,
    points: s.points.sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
  }));
}

async function loadPaces(userId: string): Promise<GoalPaceInput[]> {
  const krs = await sql<{
    id: string;
    title: string;
    metric_key: string;
    baseline: number;
    target: number;
    unit: string;
    due_on: string;
  }>(
    `select k.id, g.title, k.metric_key, k.baseline, k.target, k.unit, k.due_on::text as due_on
     from key_results k join goals g on g.id = k.goal_id
     where k.user_id = $1 and g.status = 'active'`,
    [userId],
  );
  const out: GoalPaceInput[] = [];
  for (const kr of krs) {
    const pts = await sql<{ period_start: string; value: number }>(
      `select period_start::text as period_start, value from metric_points
       where user_id = $1 and metric_key = $2 and grain = 'week'
       order by period_start`,
      [userId, kr.metric_key],
    );
    out.push({
      krId: kr.id,
      goalTitle: kr.title,
      metricKey: kr.metric_key,
      baseline: Number(kr.baseline),
      target: Number(kr.target),
      unit: kr.unit,
      dueOn: kr.due_on.slice(0, 10),
      values: pts.map((p) => Number(p.value)),
      dates: pts.map((p) => p.period_start.slice(0, 10)),
    });
  }
  return out;
}

async function loadThemes(userId: string) {
  const rows = await sql<{ value_text: string }>(
    `select value_text from responses
     where user_id = $1 and value_text is not null
     order by answered_at desc limit 40`,
    [userId],
  );
  const counts = new Map<string, number>();
  const tags = ["meetings", "sleep", "kids", "launch", "travel", "deadline", "energy"];
  for (const r of rows) {
    const t = (r.value_text ?? "").toLowerCase();
    for (const tag of tags) {
      if (t.includes(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([tag, count]) => ({
    tag,
    count,
    window: Math.min(40, rows.length),
  }));
}

async function loadWins(userId: string, series: Series[]) {
  const wins: { kind: string; metricKey: string; value: number; label: string }[] = [];
  const deep = series.find((s) => s.key === "habits.deep_work");
  if (deep) {
    const days = deep.points.filter((p) => p.grain === "day");
    let best = 0;
    let cur = 0;
    for (const p of days) {
      if (p.value >= 0.5) {
        cur += 1;
        best = Math.max(best, cur);
      } else cur = 0;
    }
    if (best >= 5) {
      wins.push({
        kind: "deep_work_streak",
        metricKey: "habits.deep_work",
        value: best,
        label: `Longest deep-work streak so far: ${best} days`,
      });
    }
  }
  void userId;
  return wins;
}

async function learnedWeights(userId: string): Promise<Partial<Record<Finding["type"], number>>> {
  const rows = await sql<{ useful: boolean; type: string }>(
    `select f.useful, n.type
     from insight_feedback f
     join insights i on i.id = f.insight_id
     join findings n on i.finding_ids::text like '%' || n.id || '%'
     where f.user_id = $1 and n.user_id = $1`,
    [userId],
  );
  const byType: Record<string, { n: number; up: number }> = {};
  for (const r of rows) {
    const cur = byType[r.type] ?? { n: 0, up: 0 };
    cur.n += 1;
    if (r.useful) cur.up += 1;
    byType[r.type] = cur;
  }
  const out: Partial<Record<Finding["type"], number>> = {};
  for (const [t, v] of Object.entries(byType)) {
    if (v.n >= 3) out[t as Finding["type"]] = 0.6 + (v.up / v.n) * 0.8;
  }
  return out;
}

export async function assembleContext(userId: string, findings: Finding[]) {
  const goals = await sql<{ title: string }>(
    `select title from goals where user_id = $1 and status = 'active'`,
    [userId],
  );
  const areas = new Set(
    findings.flatMap((f) => f.metricKeys.map((k) => METRIC_LABELS[k]?.area).filter(Boolean)),
  );
  const areaIds = AREAS.filter((a) => areas.has(a.key)).map((a) => a.id);
  const facts = await sql<{ text: string }>(
    `select text from memories
     where user_id = $1 and layer = 'fact' and confirmed = true and paused = false
       and superseded_by is null
       and (valid_until is null or valid_until >= current_date)
       ${areaIds.length ? "and (area_id = any($2::text[]) or area_id is null)" : ""}
     order by confidence desc limit 8`,
    areaIds.length ? [userId, areaIds] : [userId],
  );
  return {
    goals: goals.map((g) => g.title),
    facts: facts.map((f) => f.text),
  };
}

function episodeFrom(responses: ResponseRow[], titles: string[]): string {
  const notes = responses
    .map((r) => r.value_text)
    .filter((t): t is string => !!t && t.length > 8)
    .slice(0, 3);
  const week = isoDate(startOfWeek(new Date()));
  return `Week of ${week}. Insights: ${titles.slice(0, 3).join("; ") || "none yet"}. Notes: ${notes.join(" / ") || "quiet week"}.`;
}

export function emptyTeaching(checkIns: number) {
  return {
    wheel: "A life wheel appears after your first weekly reflection. Each spoke is one area scored 1–10.",
    trends: `Area trends need 4 weekly points. You have ${checkIns}. About ${Math.max(0, 4 - checkIns)} more weekly check-ins.`,
    insights: "Insights show once statistics have enough evidence — usually 6 data points for a trend.",
  };
}
