import { AREAS, CATALOG, FOLLOW_UPS } from "./catalog";
import { asJson, nid, sql } from "./db";
import { addDays, isoDate, startOfWeek } from "./dates";
import { embedText } from "./embed";
import { recomputeInsights } from "./engine";
import { ingestResponses } from "./metrics";

export async function ensureCatalog() {
  const existing = await sql<{ c: number }>("select count(*)::int as c from areas");
  if ((existing[0]?.c ?? 0) > 0) return;
  for (const [i, a] of AREAS.entries()) {
    await sql(
      `insert into areas (id, key, name, user_id, sort_order) values ($1,$2,$3,null,$4)`,
      [a.id, a.key, a.name, i],
    );
  }
  for (const q of CATALOG) {
    await sql(
      `insert into questions (id, area_id, dimension, prompt, type, options, cadence, metric_key, est_seconds, version, source, unit, active)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,1,$10,$11,true)`,
      [
        q.id,
        q.areaId,
        q.dimension,
        q.prompt,
        q.type,
        asJson(q.options),
        q.cadence,
        q.metricKey,
        q.estSeconds,
        q.source,
        q.unit,
      ],
    );
  }
  for (const r of FOLLOW_UPS) {
    await sql(
      `insert into question_rules (id, question_id, condition, follow_up_id) values ($1,$2,$3::jsonb,$4)`,
      [r.id, r.questionId, asJson(r.condition), r.followUpId],
    );
  }
}

type NumMap = Record<string, number | string | string[]>;

export async function seedSample(userId: string, profile: { email: string; name: string }) {
  await ensureCatalog();
  const existing = await sql<{ id: string }>("select id from users where id = $1", [userId]);
  if (!existing[0]) {
    await sql(
      `insert into users (id, email, display_name, tz, tone, values_json, constraints_text, pulse_hour, onboarding_completed_at, sample_data)
       values ($1,$2,$3,'Europe/London','gentle',$4::jsonb,$5,7,now(),true)`,
      [
        userId,
        profile.email,
        profile.name.split(" ")[0] || "Alex",
        asJson(["Health", "Family", "Craft", "Calm"]),
        "Trains best before 7am. Kids in the evening.",
      ],
    );
  } else {
    await sql(
      `update users set sample_data = true, onboarding_completed_at = now(), display_name = $2, values_json = $3::jsonb
       where id = $1`,
      [userId, profile.name.split(" ")[0] || "Alex", asJson(["Health", "Family", "Craft", "Calm"])],
    );
  }

  const today = startOfWeek(new Date());
  const weeks = 12;
  const responses: {
    id: string;
    session_id: string;
    question_id: string;
    value_num: number | null;
    value_text: string | null;
    value_json: unknown;
    answered_at: Date;
    skipped: boolean;
  }[] = [];

  for (let w = weeks; w >= 1; w--) {
    const weekStart = addDays(today, -7 * w);
    const phase = w >= 9 ? 1 : w >= 5 ? 2 : 3;
    const sleep = (w >= 5 ? 6.15 : 7.25) + jitter(0.15, w);
    const workouts = phase === 1 ? 1 : 3;
    const mood = 4.2 + (sleep - 5) * 0.7 + (workouts >= 3 ? 1.15 : 0) + jitter(0.15, w + 3);
    const energy =
      w === 1 ? 3.2 : (phase === 1 ? 5.6 : phase === 2 ? 6.6 : 7.1) + jitter(0.2, w + 5);
    const run = 15 + (12 - w) * 0.75 + jitter(0.3, w);
    const career = (phase === 1 ? 5.4 : 6.8) + (w % 5 === 0 ? -1.2 : 0) + jitter(0.2, w);
    const stress = 8 - mood * 0.6 + (w % 5 === 0 ? 1.4 : 0);
    const rel = 6.2 + (w % 4 === 0 ? -0.8 : 0.3);
    const learn = 5.5 + (phase === 3 ? 0.8 : 0);
    const fin = 6.0;
    const habits = phase === 1 ? 5.2 : 6.7;
    const sid = nid("s");
    await sql(
      `insert into sessions (id, user_id, kind, started_at, completed_at, selection)
       values ($1,$2,'weekly',$3,$3,'[]'::jsonb)`,
      [sid, userId, weekStart.toISOString()],
    );
    const answers: NumMap = {
      q_health_energy: energy,
      q_health_sleep_hours: sleep,
      q_health_sleep_quality: Math.min(10, sleep + 1.2),
      q_health_workouts: workouts,
      q_health_run_km: Math.max(12, run),
      q_mind_mood: clamp(mood),
      q_mind_stress: clamp(stress),
      q_career_score: clamp(career),
      q_career_start_time: phase === 1 ? "09:00" : "07:30",
      q_rel_score: clamp(rel),
      q_fin_score: fin,
      q_learn_score: clamp(learn),
      q_learn_minutes: 40 + phase * 15,
      q_habits_score: habits,
      q_focus_area: phase === 1 ? "Health" : "Career",
      q_mind_win:
        phase === 1
          ? "Got through a heavy meetings week."
          : phase === 2
            ? "Moved workouts to mornings. Sleep felt easier."
            : "Held the morning run streak.",
      q_career_note:
        w % 5 === 0
          ? "Meetings stacked every afternoon. Launch week pressure."
          : "Deep work in the morning before meetings.",
    };
    for (const [qid, val] of Object.entries(answers)) {
      const r = pushResponse(sid, userId, qid, val, weekStart);
      responses.push(r);
      await insertResponse(r);
    }
  }

  for (let d = 14; d >= 1; d--) {
    const day = addDays(new Date(), -d);
    const sid = nid("s");
    await sql(
      `insert into sessions (id, user_id, kind, started_at, completed_at, selection)
       values ($1,$2,'pulse',$3,$3,'[]'::jsonb)`,
      [sid, userId, day.toISOString()],
    );
    const reading = [3, 10].includes(d) ? 0 : 1;
    const meditation = [3, 6, 9].includes(d) ? 1 : 0;
    const deep = d >= 6 && d <= 14 ? 1 : d % 3 === 0 ? 1 : 0;
    const map: NumMap = {
      q_health_energy_pulse: d === 1 ? 3.4 : 6.8 + jitter(0.3, d),
      q_mind_mood_pulse: 6.5 + jitter(0.4, d + 1),
      q_health_sleep_hours: d <= 2 ? 5.5 : 7.2,
      q_career_deep_work: deep,
      q_habits_reading: reading,
      q_habits_meditation: meditation,
      q_habits_mobility: d % 2 === 0 ? 1 : 0,
    };
    for (const [qid, val] of Object.entries(map)) {
      const r = pushResponse(sid, userId, qid, val, day);
      responses.push(r);
      await insertResponse(r);
    }
  }

  await ingestResponses(userId, responses);

  const starts = isoDate(addDays(today, -7 * 12));
  const due = "2027-03-01";
  const goalId = nid("g");
  await sql(
    `insert into goals (id, user_id, area_id, title, why, starts_on, due_on, status, vision)
     values ($1,$2,'area_health',$3,$4,$5,$6,'active',$7)`,
    [
      goalId,
      userId,
      "Run a half marathon by April",
      "A calm, strong body that keeps up with my kids",
      starts,
      due,
      "A calm, strong body that keeps up with my kids",
    ],
  );
  await sql(
    `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
     values ($1,$2,$3,'health.run_km',15,40,'km',$4)`,
    [nid("kr"), goalId, userId, due],
  );
  const careerGoal = nid("g");
  await sql(
    `insert into goals (id, user_id, area_id, title, why, starts_on, due_on, status, vision)
     values ($1,$2,'area_career',$3,$4,$5,$6,'active',$7)`,
    [
      careerGoal,
      userId,
      "Protect two deep-work mornings",
      "Craft over reactive meetings",
      starts,
      "2027-02-01",
      "",
    ],
  );
  await sql(
    `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
     values ($1,$2,$3,'career.score',5.4,8,'points',$4)`,
    [nid("kr"), careerGoal, userId, "2027-02-01"],
  );

  const week = isoDate(startOfWeek(new Date()));
  const actionId = nid("a");
  await sql(
    `insert into actions (id, user_id, goal_id, text, trigger, due_on, status, expected_metric, expected_direction, created_by, week_start)
     values ($1,$2,$3,$4,$5,$6,'active','health.run_km','up','coach',$7)`,
    [
      actionId,
      userId,
      goalId,
      "When I close my laptop, I will walk for 20 minutes",
      "I close my laptop",
      isoDate(addDays(new Date(), 3)),
      week,
    ],
  );
  await sql(
    `insert into actions (id, user_id, goal_id, text, trigger, due_on, status, expected_metric, created_by, week_start)
     values ($1,$2,$3,$4,$5,$6,'active','habits.reading','coach',$7)`,
    [
      nid("a"),
      userId,
      careerGoal,
      "Read 20 minutes after the kids are in bed, three nights",
      "kids are in bed",
      isoDate(addDays(new Date(), 4)),
      week,
    ],
  );
  await sql(
    `insert into actions (id, user_id, text, status, expected_metric, created_by, week_start)
     values ($1,$2,$3,'active','habits.meditation','user',$4)`,
    [nid("a"), userId, "Meditate 10 minutes before coffee on Mon/Wed/Fri", week],
  );

  const facts = [
    {
      text: "Trains best before 7 am",
      area: "area_health",
      confirmed: true,
    },
    {
      text: "Knee injury in 2025 — keep volume gradual",
      area: "area_health",
      confirmed: true,
    },
    {
      text: "Kids in bed by 20:00 most weeknights",
      area: "area_relationships",
      confirmed: true,
    },
    {
      text: "Busy launch week at work",
      area: "area_career",
      confirmed: true,
      until: isoDate(addDays(new Date(), 10)),
    },
    {
      text: "Prefers a direct coaching tone when energy is high, gentle when sleep is short",
      area: "area_mind",
      confirmed: true,
    },
  ];
  for (const f of facts) {
    await sql(
      `insert into memories (id, user_id, layer, area_id, text, confidence, confirmed, valid_until, embedding)
       values ($1,$2,'fact',$3,$4,0.85,true,$5,$6::jsonb)`,
      [nid("m"), userId, f.area, f.text, f.until ?? null, asJson(embedText(f.text))],
    );
  }
  await sql(
    `insert into memories (id, user_id, layer, text, confidence, confirmed, embedding)
     values ($1,$2,'episode',$3,0.8,true,$4::jsonb)`,
    [
      nid("m"),
      userId,
      "Last week: morning runs held, meetings still crowding afternoons, reading streak strong, meditation slipping.",
      asJson(embedText("morning runs meetings reading meditation")),
    ],
  );
  await sql(
    `insert into memories (id, user_id, layer, area_id, text, confidence, confirmed)
     values ($1,$2,'fact','area_finances',$3,0.6,false)`,
    [nid("m"), userId, "Saving for a spring race entry and physio buffer"],
  );

  await recomputeInsights(userId);
}

export async function clearUserData(userId: string) {
  const tables = [
    "insight_feedback",
    "insights",
    "findings",
    "action_events",
    "actions",
    "key_results",
    "goals",
    "response_embeddings",
    "responses",
    "sessions",
    "metric_points",
    "memories",
    "notifications",
    "events",
    "action_effectiveness",
    "coach_messages",
    "share_links",
    "login_tokens",
  ];
  for (const t of tables) {
    await sql(`delete from ${t} where user_id = $1`, [userId]);
  }
  await sql(
    `delete from question_rules where question_id in (select id from questions where owner_id = $1)`,
    [userId],
  );
  await sql(`delete from questions where owner_id = $1`, [userId]);
}

export async function deleteAccount(userId: string) {
  await clearUserData(userId);
  await sql(`delete from auth_sessions where user_id = $1`, [userId]);
  await sql(`delete from users where id = $1`, [userId]);
}

function pushResponse(
  sessionId: string,
  userId: string,
  questionId: string,
  val: number | string | string[],
  at: Date,
) {
  let value_num: number | null = null;
  let value_text: string | null = null;
  let value_json: unknown = null;
  if (typeof val === "number") {
    value_num = val;
    if (questionId.includes("deep_work") || questionId.includes("reading") || questionId.includes("meditation") || questionId.includes("mobility")) {
      value_text = val >= 0.5 ? "Yes" : "No";
    }
  } else if (typeof val === "string") {
    value_text = val;
    if (/^\d{1,2}:\d{2}$/.test(val)) {
      const [h, m] = val.split(":").map(Number);
      value_num = h + m / 60;
    }
  } else {
    value_json = val;
    value_text = val.join(", ");
  }
  return {
    id: nid("r"),
    session_id: sessionId,
    userId,
    question_id: questionId,
    value_num,
    value_text,
    value_json,
    answered_at: at,
    skipped: false,
  };
}

async function insertResponse(r: {
  id: string;
  session_id: string;
  userId?: string;
  question_id: string;
  value_num: number | null;
  value_text: string | null;
  value_json: unknown;
  answered_at: Date;
  skipped: boolean;
}) {
  const userId = (r as { userId: string }).userId;
  await sql(
    `insert into responses (id, session_id, user_id, question_id, question_version, value_num, value_text, value_json, skipped, answered_at)
     values ($1,$2,$3,$4,1,$5,$6,$7::jsonb,$8,$9)`,
    [
      r.id,
      r.session_id,
      userId,
      r.question_id,
      r.value_num,
      r.value_text,
      r.value_json ? asJson(r.value_json) : null,
      r.skipped,
      r.answered_at.toISOString(),
    ],
  );
}

function jitter(amp: number, seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amp;
}

function clamp(n: number) {
  return Math.max(1, Math.min(10, n));
}
