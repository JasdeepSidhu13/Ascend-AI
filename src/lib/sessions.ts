import { CATALOG, SESSION_BUDGET, questionById, type CatalogQuestion } from "./catalog";
import { asJson, nid, readJson, sql } from "./db";
import { fromBank, loadBank } from "./bank";
import { followUpsFor, probingQuestion, selectQuestions, type SelectorInput } from "./selector";
import type { SelectionItem, SessionKind } from "./types";
import { std } from "./stats";
import { daysBetween } from "./dates";

export async function startSession(userId: string, kind: SessionKind) {
  const input = await selectorInput(userId, kind);
  const bank = await loadBank(userId);
  const selection = selectQuestions(input, bank);
  const id = nid("s");
  await sql(
    `insert into sessions (id, user_id, kind, selection) values ($1,$2,$3,$4::jsonb)`,
    [id, userId, kind, asJson(selection)],
  );
  return { id, kind, selection, questions: hydrate(selection, bank), budget: SESSION_BUDGET[kind] };
}

export function hydrate(selection: SelectionItem[], bank: CatalogQuestion[] = CATALOG) {
  return selection.map((s) => {
    const q = fromBank(bank, s.questionId) ?? questionById(s.questionId) ?? CATALOG[0];
    return { ...q, reason: s.reason, followUpOf: s.followUpOf ?? null };
  });
}

export async function answerQuestion(input: {
  userId: string;
  sessionId: string;
  questionId: string;
  valueNum?: number | null;
  valueText?: string | null;
  valueJson?: unknown;
  skipped?: boolean;
}) {
  const session = await sql<{ id: string; selection: unknown; kind: SessionKind }>(
    `select id, selection, kind from sessions where id = $1 and user_id = $2`,
    [input.sessionId, input.userId],
  );
  if (!session[0]) return { error: "not_found" as const };
  const id = nid("r");
  await sql(
    `insert into responses (id, session_id, user_id, question_id, question_version, value_num, value_text, value_json, skipped)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      id,
      input.sessionId,
      input.userId,
      input.questionId,
      1,
      input.valueNum ?? null,
      input.valueText ?? null,
      input.valueJson != null ? asJson(input.valueJson) : null,
      input.skipped ?? false,
    ],
  );
  const extra: SelectionItem[] = [];
  if (!input.skipped) {
    for (const fid of followUpsFor(input.questionId, {
      num: input.valueNum,
      text: input.valueText,
      json: input.valueJson,
    })) {
      extra.push({
        questionId: fid,
        reason: "Follow-up from your last answer",
        priority: 50,
        followUpOf: input.questionId,
      });
    }
    const selectionNow = readJson<SelectionItem[]>(session[0].selection, []);
    if ((input.valueText ?? "").length > 24 && !selectionNow.some((s) => s.reason.startsWith("Probing"))) {
      const probe = await persistProbe(input.userId, session[0].kind, [input.valueText ?? ""]);
      if (probe) {
        extra.push({
          questionId: probe.id,
          reason: probe.reason,
          priority: 40,
          followUpOf: input.questionId,
        });
      }
    }
  }
  const selection = readJson<SelectionItem[]>(session[0].selection, []);
  const existing = new Set(selection.map((s) => s.questionId));
  const added = extra.filter((e) => !existing.has(e.questionId));
  const bank = await loadBank(input.userId);
  if (added.length) {
    const next = [...selection, ...added];
    await sql(`update sessions set selection = $3::jsonb where id = $1 and user_id = $2`, [
      input.sessionId,
      input.userId,
      asJson(next),
    ]);
    return { responseId: id, added: hydrate(added, bank), selection: hydrate(next, bank) };
  }
  return { responseId: id, added: [], selection: hydrate(selection, bank) };
}

async function persistProbe(userId: string, kind: SessionKind, texts: string[]) {
  const probe = probingQuestion(texts);
  if (!probe) return null;
  const id = nid("qg");
  await sql(
    `insert into questions (id, area_id, dimension, prompt, type, cadence, est_seconds, source, owner_id, kinds_json)
     values ($1,'area_mind','mind.probe',$2,'text',7,18,'generated',$3,$4::jsonb)`,
    [id, probe.prompt, userId, JSON.stringify([kind, "weekly"])],
  );
  return { id, reason: probe.reason };
}

export async function selectorInput(userId: string, kind: SessionKind): Promise<SelectorInput> {
  const last = await sql<{ question_id: string; answered_at: string }>(
    `select distinct on (question_id) question_id, answered_at::text as answered_at
     from responses where user_id = $1 order by question_id, answered_at desc`,
    [userId],
  );
  const lastAsked: Record<string, string> = {};
  for (const r of last) lastAsked[r.question_id] = r.answered_at;
  const series = await sql<{ metric_key: string; c: number; vals: string }>(
    `select metric_key, count(*)::int as c,
            string_agg(value::text, ',' order by period_start) as vals
     from metric_points where user_id = $1 and grain = 'week'
     group by metric_key`,
    [userId],
  );
  const seriesCounts: Record<string, number> = {};
  const fallingMetrics: string[] = [];
  const volatileMetrics: string[] = [];
  for (const s of series) {
    seriesCounts[s.metric_key] = s.c;
    const vals = (s.vals ?? "").split(",").map(Number).filter((n) => !Number.isNaN(n));
    if (vals.length >= 4) {
      const recent = vals.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const prior = vals.slice(-4, -2).reduce((a, b) => a + b, 0) / 2;
      if (recent < prior - 0.4) fallingMetrics.push(s.metric_key);
      if (std(vals.slice(-8)) > 1.2) volatileMetrics.push(s.metric_key);
    }
  }
  const goals = await sql<{ metric_key: string }>(
    `select k.metric_key from key_results k
     join goals g on g.id = k.goal_id
     where k.user_id = $1 and g.status = 'active'`,
    [userId],
  );
  const active = await sql<{ c: number }>(
    `select count(*)::int as c from actions where user_id = $1 and status = 'active'`,
    [userId],
  );
  void kind;
  void daysBetween;
  return {
    kind,
    now: new Date(),
    lastAsked,
    identicalStreak: {},
    skipCount: {},
    seriesCounts,
    fallingMetrics,
    volatileMetrics,
    goalMetrics: goals.map((g) => g.metric_key),
    activeAction: (active[0]?.c ?? 0) > 0,
  };
}

export async function dueSession(userId: string): Promise<{
  kind: SessionKind;
  label: string;
  detail: string;
} | null> {
  const lastPulse = await sql<{ started_at: string }>(
    `select started_at::text as started_at from sessions
     where user_id = $1 and kind = 'pulse' and completed_at is not null
     order by started_at desc limit 1`,
    [userId],
  );
  const lastWeekly = await sql<{ started_at: string }>(
    `select started_at::text as started_at from sessions
     where user_id = $1 and kind = 'weekly' and completed_at is not null
     order by started_at desc limit 1`,
    [userId],
  );
  const lastMonthly = await sql<{ started_at: string }>(
    `select started_at::text as started_at from sessions
     where user_id = $1 and kind in ('monthly','audit') and completed_at is not null
     order by started_at desc limit 1`,
    [userId],
  );
  const now = new Date();
  const pulseAge = lastPulse[0]
    ? (now.getTime() - new Date(lastPulse[0].started_at).getTime()) / 86400000
    : 99;
  if (pulseAge >= 0.7) {
    return {
      kind: "pulse",
      label: "Daily pulse",
      detail: "Sixty seconds. Energy, mood, the habits that feed your trends.",
    };
  }
  const weeklyAge = lastWeekly[0]
    ? (now.getTime() - new Date(lastWeekly[0].started_at).getTime()) / 86400000
    : 99;
  if (weeklyAge > 6) {
    return {
      kind: "weekly",
      label: "Weekly reflection",
      detail: "About 3 minutes. Five to eight questions, chosen for this week.",
    };
  }
  const monthlyAge = lastMonthly[0]
    ? (now.getTime() - new Date(lastMonthly[0].started_at).getTime()) / 86400000
    : 99;
  if (monthlyAge > 28) {
    return {
      kind: "monthly",
      label: "Monthly review",
      detail: "Ten minutes to re-plan the month from the numbers.",
    };
  }
  const lastAudit = await sql<{ started_at: string }>(
    `select started_at::text as started_at from sessions
     where user_id = $1 and kind = 'audit' and completed_at is not null
     order by started_at desc limit 1`,
    [userId],
  );
  const auditAge = lastAudit[0]
    ? (now.getTime() - new Date(lastAudit[0].started_at).getTime()) / 86400000
    : 99;
  if (auditAge > 85) {
    return {
      kind: "audit",
      label: "Quarterly life audit",
      detail: "Twenty minutes. Every area, then reset what you are aiming at.",
    };
  }
  return {
    kind: "pulse",
    label: "Another pulse",
    detail: "You already checked in. You can still log a short pulse.",
  };
}
