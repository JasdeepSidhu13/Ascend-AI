import { METRIC_LABELS } from "./catalog";
import type { Finding, InsightDraft, Tone } from "./types";
import { round } from "./stats";

function label(key: string) {
  return METRIC_LABELS[key]?.label ?? key;
}

function unit(key: string) {
  return METRIC_LABELS[key]?.unit ?? "";
}

function num(stats: Record<string, number | string>, key: string): number {
  const v = stats[key];
  return typeof v === "number" ? v : Number(v) || 0;
}

export function narrateFinding(f: Finding, tone: Tone): InsightDraft {
  const t = templates[f.type] ?? templates.trend;
  return t(f, tone);
}

const templates: Record<Finding["type"], (f: Finding, tone: Tone) => InsightDraft> = {
  trend: (f, tone) => {
    const key = f.metricKeys[0];
    const delta = num(f.stats, "delta");
    const recent = num(f.stats, "recent_mean");
    const prior = num(f.stats, "prior_mean");
    const dir = delta >= 0 ? "up" : "down";
    const abs = round(Math.abs(delta), 1);
    const u = unit(key);
    const title =
      dir === "up" ? `${label(key)} is lifting` : `${label(key)} has eased`;
    const weeks = num(f.stats, "recent_weeks") || 4;
    const body = `${label(key)} is ${dir} ${abs}${u ? " " + u : ""} versus the previous ${weeks} weeks (${round(recent, 1)} vs ${round(prior, 1)}).`;
    const suggestedAction =
      tone === "direct"
        ? dir === "up"
          ? `Keep the thing that moved ${label(key).toLowerCase()} — schedule it twice this week.`
          : `Name one friction around ${label(key).toLowerCase()} and shrink it by half this week.`
        : dir === "up"
          ? `You might protect whatever supported ${label(key).toLowerCase()} and repeat it twice this week.`
          : `If it feels right, pick one small friction around ${label(key).toLowerCase()} and make it easier.`;
    return draft(title, body, suggestedAction, f, conf(f));
  },
  driver: (f, tone) => {
    const a = f.metricKeys[0];
    const b = f.metricKeys[1];
    const lift = num(f.stats, "lift");
    const r = num(f.stats, "r");
    const threshold = num(f.stats, "threshold") || 3;
    const title = `${label(a)} tends to move with ${label(b).toLowerCase()}`;
    const body = `${label(a)} is ${round(Math.abs(lift), 1)} ${unit(a)} ${lift >= 0 ? "higher" : "lower"} in weeks when ${label(b).toLowerCase()} is ${threshold}+ (association r ${round(r, 2)}). This is a tendency, not a cause.`;
    const suggestedAction =
      tone === "direct"
        ? `Plan a week with ${threshold}+ on ${label(b).toLowerCase()} and watch ${label(a).toLowerCase()}.`
        : `You could try a week with ${threshold}+ on ${label(b).toLowerCase()} and notice ${label(a).toLowerCase()}.`;
    return draft(title, body, suggestedAction, f, Math.abs(r) >= 0.6 ? "high" : "medium");
  },
  adherence: (f, tone) => {
    const key = f.metricKeys[0];
    const done = num(f.stats, "done");
    const scheduled = num(f.stats, "scheduled");
    const streak = num(f.stats, "streak");
    const rate = num(f.stats, "rate");
    const strong = rate >= 0.7;
    const title = strong
      ? `${label(key)} is holding`
      : `${label(key)} needs a smaller shape`;
    const body = `${label(key)} held ${done} of ${scheduled} days${streak ? `; current streak ${streak}` : ""}.`;
    const suggestedAction = strong
      ? tone === "direct"
        ? `Keep the same slot this week. Do not add a second habit yet.`
        : `You might keep the same slot and let this stay easy.`
      : tone === "direct"
        ? `Shrink it: do ${label(key).toLowerCase()} on 3 named days, 10 minutes each.`
        : `If it helps, shrink ${label(key).toLowerCase()} to 3 named days this week.`;
    return draft(title, body, suggestedAction, f, scheduled >= 10 ? "high" : "medium");
  },
  anomaly: (f, tone) => {
    const key = f.metricKeys[0];
    const value = num(f.stats, "value");
    const baseline = num(f.stats, "baseline");
    const title =
      value < baseline ? `${label(key)} had a hard week` : `${label(key)} spiked`;
    const window = num(f.stats, "window") || 8;
    const article = window === 8 ? "an" : "a";
    const body = `${label(key)} hit ${round(value, 1)} this week against ${article} ${window}-week baseline of ${round(baseline, 1)}. One week is a weather report, not a verdict.`;
    const suggestedAction =
      tone === "direct"
        ? `Do the smallest version of your usual recovery: sleep window, a walk, one no-meeting block.`
        : `You might treat this as weather: protect sleep and one short walk, then look again next week.`;
    return draft(title, body, suggestedAction, f, "medium");
  },
  pace: (f, tone) => {
    const key = f.metricKeys[0];
    const projected = num(f.stats, "projected");
    const target = num(f.stats, "target");
    const delay = num(f.stats, "abs_delay_weeks") || Math.abs(num(f.stats, "delay_weeks"));
    const current = num(f.stats, "current");
    const atRisk = num(f.stats, "at_risk") === 1 || projected < 0.9 * target;
    const title = atRisk ? `${label(key)} is at risk` : `${label(key)} is on track`;
    const body = atRisk
      ? `At this pace you reach ${round(projected, 1)} ${unit(key)} versus a target of ${target} ${unit(key)}. That is about ${Math.abs(delay)} weeks ${delay > 0 ? "after" : "before"} the date. Current is ${round(current, 1)} ${unit(key)}.`
      : `At this pace you reach ${round(projected, 1)} ${unit(key)} versus a target of ${target} ${unit(key)}. Current is ${round(current, 1)} ${unit(key)}.`;
    const suggestedAction = atRisk
      ? tone === "direct"
        ? `Re-plan: add one extra session or move the date. Do not keep the same plan and hope.`
        : `This might be a moment to re-plan: one extra session, or a kinder date.`
      : tone === "direct"
        ? `Hold the current weekly volume. No hero week needed.`
        : `You can hold this weekly volume; it is doing the job.`;
    return draft(title, body, suggestedAction, f, "high");
  },
  theme: (f, tone) => {
    const count = num(f.stats, "count");
    const window = num(f.stats, "window");
    const tag = (f.summary.match(/“(.+?)”/)?.[1] ?? "this theme").toLowerCase();
    const title = `“${tag}” keeps showing up`;
    const body = `“${tag}” came up in ${count} of your last ${window} answers.`;
    const suggestedAction =
      tone === "direct"
        ? `Write one sentence on what ${tag} is costing, then one boundary for next week.`
        : `You might jot what ${tag} is costing you, and one gentle boundary for next week.`;
    return draft(title, body, suggestedAction, f, count >= 5 ? "high" : "medium");
  },
  win: (f, tone) => {
    const value = num(f.stats, "value");
    const title = f.summary.split(":")[0] || "A personal best";
    const body = f.summary;
    const suggestedAction =
      tone === "direct"
        ? `Name the cue that made ${round(value, 0)} possible and reuse it twice.`
        : `You might name the cue that made this possible and borrow it twice this week.`;
    return draft(title, body, suggestedAction, f, "high");
  },
};

function draft(
  title: string,
  body: string,
  suggestedAction: string,
  f: Finding,
  confidence: InsightDraft["confidence"],
): InsightDraft {
  return {
    title,
    body,
    suggestedAction,
    confidence,
    findingIds: [f.id],
  };
}

function conf(f: Finding): InsightDraft["confidence"] {
  const n = num(f.stats, "n");
  if (n >= 10) return "high";
  if (n >= 6) return "medium";
  return "low";
}

export function medicalLanguage(text: string): boolean {
  return /\b(diagnos(e|is|ed)|dosage|mg\b|prescrib|disorder|disease|medicat)/i.test(text);
}

export async function narrateWithModel(input: {
  findings: Finding[];
  tone: Tone;
  goals: string[];
  memories: string[];
  apiKey: string;
}): Promise<InsightDraft[] | null> {
  const prompt = `You are a coach. Insights are computed already. You only explain the findings you are given. Do not invent numbers. Associations are worded as tendencies, never causes. No medical diagnosis or dosing. Tone: ${input.tone}.
Goals:\n${input.goals.map((g) => "- " + g).join("\n") || "- none"}
Memories:\n${input.memories.map((m) => "- " + m).join("\n") || "- none"}
Findings JSON:\n${JSON.stringify(input.findings.map((f) => ({ id: f.id, type: f.type, stats: f.stats, summary: f.summary, metricKeys: f.metricKeys })))}
Return a JSON array of 3 to 5 objects: {title, body, suggestedAction, confidence, findingIds}. Each body must only use numbers present in the cited findings. One sentence explanation. One suggested action.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.map((c) => c.text ?? "").join("\n") ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as InsightDraft[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
