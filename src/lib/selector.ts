import { CATALOG, FOLLOW_UPS, SESSION_BUDGET, questionById } from "./catalog";
import type { SelectionItem, SessionKind } from "./types";
import { daysBetween, parseDate } from "./dates";

export type SelectorInput = {
  kind: SessionKind;
  now: Date;
  lastAsked: Record<string, string>;
  identicalStreak: Record<string, number>;
  skipCount: Record<string, number>;
  seriesCounts: Record<string, number>;
  fallingMetrics: string[];
  volatileMetrics: string[];
  goalMetrics: string[];
  activeAction: boolean;
};

const W = { s: 1, g: 1.2, d: 1, u: 0.8, f: 0.7 };

export function priority(qId: string, input: SelectorInput): { score: number; reason: string } {
  const q = questionById(qId);
  if (!q) return { score: -999, reason: "" };
  const last = input.lastAsked[q.id];
  const days = last ? Math.max(0, daysBetween(parseDate(last), input.now)) : q.cadence * 3;
  const staleness = days / q.cadence;
  const goalRel = q.metricKey && input.goalMetrics.includes(q.metricKey) ? 1 : 0;
  const signal =
    q.metricKey && (input.fallingMetrics.includes(q.metricKey) || input.volatileMetrics.includes(q.metricKey))
      ? 1
      : 0;
  const n = q.metricKey ? (input.seriesCounts[q.metricKey] ?? 0) : 8;
  const uncertainty = n < 6 ? 1 : 0;
  const fatigue = Math.min(2, (input.identicalStreak[q.id] ?? 0) / 3 + (input.skipCount[q.id] ?? 0) / 2);
  const score = W.s * staleness + W.g * goalRel + W.d * signal + W.u * uncertainty - W.f * fatigue;
  const reason = reasonFor({ staleness, goalRel, signal, uncertainty, days, cadence: q.cadence, qPrompt: q.prompt });
  return { score, reason };
}

function reasonFor(p: {
  staleness: number;
  goalRel: number;
  signal: number;
  uncertainty: number;
  days: number;
  cadence: number;
  qPrompt: string;
}): string {
  if (p.goalRel) return "Feeds an active key result";
  if (p.signal) return "This area is falling or jumpy";
  if (p.uncertainty) return "Not enough data yet for a trend";
  if (p.staleness >= 2) return `Unasked for ${Math.round(p.days)} days`;
  if (p.staleness >= 1) return "Due on its usual cadence";
  return "Keeps this week's picture complete";
}

const FOLLOW_UP_ONLY = new Set([
  "q_action_barrier",
  "q_health_sleep_barrier",
  "q_health_workout_barrier",
  "q_career_barrier",
  "q_action_followup",
]);

export function selectQuestions(input: SelectorInput): SelectionItem[] {
  const budget = SESSION_BUDGET[input.kind];
  const eligible = CATALOG.filter(
    (q) => q.kinds.includes(input.kind) && !FOLLOW_UP_ONLY.has(q.id),
  );
  const ranked = eligible
    .map((q) => {
      const p = priority(q.id, input);
      return { q, ...p };
    })
    .sort((a, b) => b.score - a.score);

  const picked: SelectionItem[] = [];
  const areas = new Map<string, number>();
  const metrics = new Set<string>();
  let seconds = 0;

  if (input.activeAction && input.kind !== "audit") {
    const follow = CATALOG.find((q) => q.id === "q_action_followup");
    if (follow) {
      picked.push({
        questionId: follow.id,
        reason: "Follow-up on this week's action",
        priority: 99,
      });
      seconds += follow.estSeconds;
      areas.set(follow.areaId, 1);
    }
  }

  for (const row of ranked) {
    if (picked.length >= budget.max) break;
    if (seconds + row.q.estSeconds > budget.seconds && picked.length >= budget.min) break;
    if (picked.some((p) => p.questionId === row.q.id)) continue;
    if (row.q.metricKey && metrics.has(row.q.metricKey)) continue;
    const areaCount = areas.get(row.q.areaId) ?? 0;
    if (areaCount >= 2 && picked.length < budget.max - 1 && input.kind !== "audit") continue;
    picked.push({
      questionId: row.q.id,
      reason: row.reason,
      priority: row.score,
    });
    seconds += row.q.estSeconds;
    areas.set(row.q.areaId, areaCount + 1);
    if (row.q.metricKey) metrics.add(row.q.metricKey);
  }

  while (picked.length < budget.min) {
    const extra = ranked.find((r) => !picked.some((p) => p.questionId === r.q.id));
    if (!extra) break;
    picked.push({ questionId: extra.q.id, reason: extra.reason, priority: extra.score });
  }

  return picked;
}

export function followUpsFor(
  questionId: string,
  answer: { num?: number | null; text?: string | null; json?: unknown },
): string[] {
  return FOLLOW_UPS.filter((r) => r.questionId === questionId)
    .filter((r) => matches(r.condition, answer))
    .map((r) => r.followUpId);
}

function matches(
  condition: { op: "lt" | "eq" | "no"; value?: number },
  answer: { num?: number | null; text?: string | null },
): boolean {
  if (condition.op === "no") {
    const t = (answer.text ?? "").toLowerCase();
    if (t === "no" || t === "false") return true;
    return answer.num === 0;
  }
  if (answer.num == null) return false;
  if (condition.op === "lt") return answer.num < (condition.value ?? 0);
  return answer.num === condition.value;
}

export function probingQuestion(texts: string[]): { prompt: string; reason: string } | null {
  const blob = texts.join(" ").toLowerCase();
  if (!blob.trim()) return null;
  if (blob.includes("meeting")) {
    return {
      prompt: "You mentioned meetings. What would a lighter meeting load actually free up?",
      reason: "Probing a word you used this week",
    };
  }
  if (blob.includes("sleep") || blob.includes("tired")) {
    return {
      prompt: "When sleep slips, what is the first thing you usually drop the next day?",
      reason: "Probing a word you used this week",
    };
  }
  if (blob.includes("kids") || blob.includes("family")) {
    return {
      prompt: "What would make family time feel less squeezed next week?",
      reason: "Probing a word you used this week",
    };
  }
  const first = texts.find((t) => t.trim().length > 20);
  if (!first) return null;
  const snippet = first.trim().split(/\s+/).slice(0, 6).join(" ");
  return {
    prompt: `You wrote “${snippet}…”. What would you protect about that next week?`,
    reason: "Probing a word you used this week",
  };
}
