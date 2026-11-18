import { nid, sql } from "./db";
import { addDays, isoDate } from "./dates";
import { implementationIntention } from "./actions";

export type Program = {
  id: string;
  title: string;
  weeks: number;
  areaKey: string;
  blurb: string;
  goalTitle: string;
  why: string;
  metricKey: string;
  baseline: number;
  target: number;
  unit: string;
  actions: { text: string; trigger: string }[];
};

export const PROGRAMS: Program[] = [
  {
    id: "sleep-reset",
    title: "Sleep reset",
    weeks: 8,
    areaKey: "health",
    blurb: "Protect a 7.5-hour night with a smaller wind-down, then measure sleep hours.",
    goalTitle: "Sleep 7.5 hours most nights",
    why: "Energy and mood need a floor under them.",
    metricKey: "health.sleep_hours",
    baseline: 6,
    target: 7.5,
    unit: "h",
    actions: [
      {
        text: "Lights out by 22:30 on 5 nights, in bed 15 min before",
        trigger: "I wash my face",
      },
    ],
  },
  {
    id: "career-sprint",
    title: "8-week career sprint",
    weeks: 8,
    areaKey: "career",
    blurb: "One deep-work block on named days, tied to a craft goal.",
    goalTitle: "Four deep-work blocks a week",
    why: "Craft compounds when it has a protected slot.",
    metricKey: "habits.deep_work",
    baseline: 2,
    target: 4,
    unit: "blocks",
    actions: [
      {
        text: "Do a 50 min deep-work block 3 times this week",
        trigger: "I sit at my desk after coffee",
      },
    ],
  },
  {
    id: "half-marathon",
    title: "Half-marathon prep",
    weeks: 12,
    areaKey: "health",
    blurb: "Build weekly distance toward 40 km, then shrink if a week is missed.",
    goalTitle: "Run a half marathon",
    why: "A calm, strong body that keeps up.",
    metricKey: "health.run_km",
    baseline: 15,
    target: 40,
    unit: "km",
    actions: [
      {
        text: "Run 3 times this week, Tue/Thu/Sat, 25 min each",
        trigger: "I close my laptop",
      },
    ],
  },
];

export async function applyProgram(userId: string, programId: string) {
  const program = PROGRAMS.find((p) => p.id === programId);
  if (!program) return { error: "not_found" as const };
  const area = await sql<{ id: string }>(`select id from areas where key = $1 limit 1`, [program.areaKey]);
  const areaId = area[0]?.id ?? "area_health";
  const due = isoDate(addDays(new Date(), program.weeks * 7));
  const goalId = nid("g");
  await sql(
    `insert into goals (id, user_id, area_id, title, why, starts_on, due_on, status, vision)
     values ($1,$2,$3,$4,$5,$6,$7,'active',$8)`,
    [goalId, userId, areaId, program.goalTitle, program.why, isoDate(new Date()), due, program.blurb],
  );
  await sql(
    `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [nid("kr"), goalId, userId, program.metricKey, program.baseline, program.target, program.unit, due],
  );
  const active = await sql<{ c: number }>(
    `select count(*)::int as c from actions where user_id = $1 and status = 'active'`,
    [userId],
  );
  const room = Math.max(0, 3 - (active[0]?.c ?? 0));
  for (const a of program.actions.slice(0, room)) {
    await sql(
      `insert into actions (id, user_id, goal_id, text, trigger, due_on, status, expected_metric, created_by, week_start)
       values ($1,$2,$3,$4,$5,$6,'active',$7,'program',$8)`,
      [
        nid("a"),
        userId,
        goalId,
        implementationIntention(a.text, a.trigger),
        a.trigger,
        isoDate(addDays(new Date(), 7)),
        program.metricKey,
        isoDate(new Date()),
      ],
    );
  }
  return { ok: true as const, goalId, program };
}
