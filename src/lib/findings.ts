import { METRIC_LABELS } from "./catalog";
import { nid } from "./db";
import type { Finding, FindingType, MetricPoint, PaceStatus } from "./types";
import { mean, pearson, projectLinear, round, slope, std } from "./stats";
import { pausedStreak } from "./streak";

export type Series = {
  key: string;
  grain: "day" | "week";
  points: MetricPoint[];
};

export type GoalPaceInput = {
  krId: string;
  goalTitle: string;
  metricKey: string;
  baseline: number;
  target: number;
  unit: string;
  dueOn: string;
  values: number[];
  dates: string[];
};

export type ThemeMention = { tag: string; count: number; window: number };

export type WinInput = { kind: string; metricKey: string; value: number; label: string };

const TYPE_WEIGHT: Record<FindingType, number> = {
  trend: 1,
  driver: 1.15,
  adherence: 0.9,
  anomaly: 1.1,
  pace: 1.2,
  theme: 0.8,
  win: 0.7,
};

export function computeFindings(input: {
  series: Series[];
  paces: GoalPaceInput[];
  themes: ThemeMention[];
  wins: WinInput[];
  goalMetrics: string[];
  recentInsightKeys: string[];
  typeWeights?: Partial<Record<FindingType, number>>;
  now?: Date;
}): Finding[] {
  const findings: Finding[] = [];
  findings.push(...trendFindings(input.series, input.goalMetrics));
  findings.push(...driverFindings(input.series, input.goalMetrics));
  findings.push(...adherenceFindings(input.series, input.goalMetrics));
  findings.push(...anomalyFindings(input.series, input.goalMetrics));
  findings.push(...paceFindings(input.paces, input.goalMetrics));
  findings.push(...themeFindings(input.themes));
  findings.push(...winFindings(input.wins, input.goalMetrics));

  const learned = input.typeWeights ?? {};
  for (const f of findings) {
    const novelty = input.recentInsightKeys.includes(noveltyKey(f)) ? 0.2 : 1;
    const w = learned[f.type] ?? TYPE_WEIGHT[f.type];
    f.score = round(f.score * w * novelty, 3);
  }
  return findings.sort((a, b) => b.score - a.score);
}

function meta(key: string) {
  return METRIC_LABELS[key] ?? { label: key, unit: "", area: "mind" as const };
}

function weekly(s: Series): MetricPoint[] {
  return s.points.filter((p) => p.grain === "week").sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

function daily(s: Series): MetricPoint[] {
  return s.points.filter((p) => p.grain === "day").sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

function trendFindings(series: Series[], goalMetrics: string[]): Finding[] {
  const out: Finding[] = [];
  for (const s of series) {
    const pts = weekly(s);
    if (pts.length < 6) continue;
    const recent = pts.slice(-4).map((p) => p.value);
    const prior = pts.slice(-8, -4).map((p) => p.value);
    if (prior.length < 2) continue;
    const rMean = mean(recent);
    const pMean = mean(prior);
    const delta = rMean - pMean;
    const sl = slope(pts.slice(-8).map((p) => p.value));
    const effect = Math.abs(delta) / Math.max(0.4, std(pts.map((p) => p.value)) || 0.4);
    if (Math.abs(delta) < 0.25 && Math.abs(sl) < 0.05) continue;
    const m = meta(s.key);
    const dir = delta >= 0 ? "up" : "down";
    out.push(
      make({
        type: "trend",
        metricKeys: [s.key],
        stats: {
          recent_mean: round(rMean, 2),
          prior_mean: round(pMean, 2),
          delta: round(delta, 2),
          slope: round(sl, 3),
          n: pts.length,
          recent_weeks: 4,
          prior_weeks: 4,
        },
        evidenceIds: pts.slice(-8).map((p) => `mp:${s.key}:${p.periodStart}`),
        score:
          effect *
          (goalMetrics.includes(s.key) ? 1.3 : 1) *
          (s.key.endsWith(".score") ? 0.55 : 0.9),
        summary: `${m.label} ${dir} ${round(Math.abs(delta), 1)} ${m.unit} vs prior 4 weeks`.trim(),
      }),
    );
  }
  return out;
}

const COUNT_METRICS = new Set([
  "health.workouts",
  "health.run_km",
  "learning.minutes",
]);

function driverFindings(series: Series[], goalMetrics: string[]): Finding[] {
  const out: Finding[] = [];
  const weeklies = series
    .map((s) => ({ key: s.key, pts: weekly(s) }))
    .filter((s) => s.pts.length >= 8);
  for (let i = 0; i < weeklies.length; i++) {
    for (let j = i + 1; j < weeklies.length; j++) {
      const pair = bestDriverPair(weeklies[i], weeklies[j]);
      if (!pair) continue;
      const { outcome, driver, aligned, threshold, lift, r } = pair;
      if (Math.abs(r) < 0.4 || Math.abs(lift) < 0.4) continue;
      if (Number(Math.abs(r).toFixed(2)) >= 1) continue;
      const mo = meta(outcome);
      const md = meta(driver);
      const goalRel = goalMetrics.includes(outcome) || goalMetrics.includes(driver) ? 1.2 : 1;
      const human = outcome === "mind.mood" || outcome === "health.energy" ? 1.35 : 1;
      out.push(
        make({
          type: "driver",
          metricKeys: [outcome, driver],
          stats: {
            r: round(r, 2),
            lift: round(lift, 2),
            n: aligned.x.length,
            threshold,
          },
          evidenceIds: aligned.pairs.slice(-8).map((p) => `pair:${outcome}:${driver}:${p.date}`),
          score: Math.abs(r) * Math.min(1.8, Math.abs(lift)) * goalRel * human,
          summary: `${mo.label} tends to move with ${md.label} (r ${round(r, 2)})`,
        }),
      );
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
}

function bestDriverPair(
  a: { key: string; pts: MetricPoint[] },
  b: { key: string; pts: MetricPoint[] },
) {
  const alignedAB = align(a.pts, b.pts);
  if (alignedAB.x.length < 8) return null;
  const r = pearson(alignedAB.x, alignedAB.y);
  const preferB = COUNT_METRICS.has(b.key) || b.key.startsWith("habits.");
  const preferA = COUNT_METRICS.has(a.key) || a.key.startsWith("habits.");
  const driver = preferB && !preferA ? b : preferA && !preferB ? a : b;
  const outcome = driver.key === b.key ? a : b;
  const aligned = driver.key === b.key ? alignedAB : { x: alignedAB.y, y: alignedAB.x, pairs: alignedAB.pairs.map((p) => ({ ...p, x: p.y, y: p.x })) };
  const threshold = COUNT_METRICS.has(driver.key) ? 3 : round(median(aligned.y), 1);
  const high = aligned.pairs.filter((p) => p.y >= threshold);
  const low = aligned.pairs.filter((p) => p.y < threshold);
  if (high.length < 3 || low.length < 3) return null;
  const lift = mean(high.map((p) => p.x)) - mean(low.map((p) => p.x));
  return { outcome: outcome.key, driver: driver.key, aligned, threshold, lift, r };
}

function adherenceFindings(series: Series[], goalMetrics: string[]): Finding[] {
  const out: Finding[] = [];
  const habitKeys = ["habits.reading", "habits.meditation", "habits.mobility", "habits.deep_work"];
  for (const key of habitKeys) {
    const s = series.find((x) => x.key === key);
    if (!s) continue;
    const pts = daily(s).slice(-14);
    if (pts.length < 7) continue;
    const done = pts.filter((p) => p.value >= 0.5).length;
    const streak = pausedStreak(pts.map((p) => p.value));
    const m = meta(key);
    const rate = done / pts.length;
    out.push(
      make({
        type: "adherence",
        metricKeys: [key],
        stats: {
          done,
          scheduled: pts.length,
          rate: round(rate, 2),
          streak,
        },
        evidenceIds: pts.map((p) => `mp:${key}:${p.periodStart}`),
        score: (rate < 0.5 || rate > 0.8 ? 1.1 : 0.6) * (goalMetrics.includes(key) ? 1.2 : 1) * (1 - Math.abs(0.65 - rate)),
        summary: `${m.label} held ${done} of ${pts.length} days`,
      }),
    );
  }
  return out;
}

function anomalyFindings(series: Series[], goalMetrics: string[]): Finding[] {
  const out: Finding[] = [];
  for (const s of series) {
    const pts = weekly(s);
    if (pts.length < 8) continue;
    const baseline = pts.slice(-9, -1).map((p) => p.value);
    const last = pts[pts.length - 1];
    const m = mean(baseline);
    const sd = std(baseline);
    if (sd < 0.15) continue;
    const z = (last.value - m) / sd;
    if (Math.abs(z) < 2) continue;
    const recentMean = mean(pts.slice(-4).map((p) => p.value));
    if (Math.abs(last.value - recentMean) < sd) continue;
    const label = meta(s.key);
    out.push(
      make({
        type: "anomaly",
        metricKeys: [s.key],
        stats: {
          value: round(last.value, 2),
          baseline: round(m, 2),
          sd: round(sd, 2),
          z: round(z, 2),
          window: 8,
        },
        evidenceIds: [`mp:${s.key}:${last.periodStart}`],
        score: Math.min(3, Math.abs(z)) * (goalMetrics.includes(s.key) ? 1.2 : 1),
        summary: `${label.label} hit ${round(last.value, 1)} vs a baseline of ${round(m, 1)}`,
      }),
    );
  }
  return out;
}

export function paceStatus(projected: number, target: number, baseline: number): PaceStatus {
  const span = target - baseline;
  if (span === 0) return projected >= target ? "on_track" : "off_track";
  const pct = (projected - baseline) / span;
  if (pct >= 0.9) return "on_track";
  if (pct >= 0.6) return "at_risk";
  return "off_track";
}

function paceFindings(paces: GoalPaceInput[], goalMetrics: string[]): Finding[] {
  const out: Finding[] = [];
  for (const kr of paces) {
    if (kr.values.length < 3) continue;
    const remainingWeeks = Math.max(1, weeksUntil(kr.dueOn));
    const projected = projectLinear(kr.values, remainingWeeks);
    const status = paceStatus(projected, kr.target, kr.baseline);
    const current = kr.values[kr.values.length - 1];
    const delayWeeks =
      slope(kr.values) === 0
        ? remainingWeeks
        : Math.round((kr.target - current) / slope(kr.values) - remainingWeeks);
    out.push(
      make({
        type: "pace",
        metricKeys: [kr.metricKey],
        stats: {
          current: round(current, 1),
          target: kr.target,
          baseline: kr.baseline,
          projected: round(projected, 1),
          remaining_weeks: remainingWeeks,
          delay_weeks: delayWeeks,
          abs_delay_weeks: Math.abs(delayWeeks),
          on_track: status === "on_track" ? 1 : 0,
          at_risk: status === "at_risk" ? 1 : 0,
        },
        evidenceIds: kr.dates.slice(-6).map((d) => `mp:${kr.metricKey}:${d}`),
        score:
          (status === "on_track" ? 0.55 : 1.8) *
          (goalMetrics.includes(kr.metricKey) ? 1.3 : 1.1),
        summary: `${kr.goalTitle}: projected ${round(projected, 1)} ${kr.unit} vs ${kr.target} ${kr.unit}`,
      }),
    );
  }
  return out;
}

function themeFindings(themes: ThemeMention[]): Finding[] {
  return themes
    .filter((t) => t.count >= 3)
    .map((t) =>
      make({
        type: "theme",
        metricKeys: [],
        stats: { count: t.count, window: t.window },
        evidenceIds: [`theme:${t.tag}`],
        score: Math.min(2, t.count / 3),
        summary: `“${t.tag}” came up in ${t.count} of your last ${t.window} answers`,
      }),
    );
}

function winFindings(wins: WinInput[], goalMetrics: string[]): Finding[] {
  return wins.map((w) =>
    make({
      type: "win",
      metricKeys: [w.metricKey],
      stats: { value: w.value },
      evidenceIds: [`win:${w.kind}`],
      score: 0.85 * (goalMetrics.includes(w.metricKey) ? 1.2 : 1),
      summary: w.label,
    }),
  );
}

function make(
  f: Omit<Finding, "id"> & { summary: string },
): Finding {
  return { id: nid("f"), ...f };
}

function align(a: MetricPoint[], b: MetricPoint[]) {
  const map = new Map(b.map((p) => [p.periodStart, p.value]));
  const pairs = a
    .filter((p) => map.has(p.periodStart))
    .map((p) => ({ date: p.periodStart, x: p.value, y: map.get(p.periodStart)! }));
  return { x: pairs.map((p) => p.x), y: pairs.map((p) => p.y), pairs };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function weeksUntil(dueOn: string): number {
  const due = new Date(dueOn + "T00:00:00Z");
  const now = new Date();
  return Math.max(1, Math.round((due.getTime() - now.getTime()) / (7 * 86400000)));
}

export function noveltyKey(f: Finding): string {
  return `${f.type}:${f.metricKeys.join(",")}`;
}

export function rankTop(findings: Finding[], n = 5): Finding[] {
  const viable = findings.filter((f) => f.score > 0.15);
  const caps: Partial<Record<FindingType, number>> = {
    driver: 1,
    trend: 1,
    adherence: 2,
    anomaly: 1,
    pace: 1,
    win: 1,
    theme: 1,
  };
  const order: FindingType[] = ["pace", "adherence", "trend", "driver", "anomaly", "win", "theme"];
  const picked: Finding[] = [];
  for (const type of order) {
    const cap = caps[type] ?? 1;
    const chunk = viable.filter((f) => f.type === type).slice(0, cap);
    for (const f of chunk) {
      picked.push(f);
      if (picked.length >= n) return picked;
    }
  }
  return picked;
}
