import { asJson, nid, sql } from "./db";
import { addDays, isoDate, startOfWeek } from "./dates";
import { actionTypeFromText, recordEffectiveness } from "./effectiveness";

export function shrinkText(text: string): string {
  return text
    .replace(/(\d+)\s*times/i, (_, n) => `${Math.max(1, Number(n) - 1)} times`)
    .replace(/(\d+)\s*min/i, (_, n) => `${Math.max(5, Math.round(Number(n) * 0.6))} min`)
    .replace(/(\d+)\s*minutes/i, (_, n) => `${Math.max(5, Math.round(Number(n) * 0.6))} minutes`)
    .replace(/(\d+)\s*km/i, (_, n) => `${Math.max(1, Number(n) - 1)} km`);
}

export async function followThrough(
  userId: string,
  done: boolean,
  barriers: string[] = [],
  actionId?: string,
) {
  const week = isoDate(startOfWeek(new Date()));
  const actions = await sql<{
    id: string;
    text: string;
    expected_metric: string | null;
    week_start: string | null;
  }>(
    actionId
      ? `select id, text, expected_metric, week_start::text as week_start
         from actions where user_id = $1 and id = $2`
      : `select id, text, expected_metric, week_start::text as week_start
         from actions where user_id = $1 and status = 'active' order by created_at asc limit 1`,
    actionId ? [userId, actionId] : [userId],
  );
  for (const a of actions) {
    await sql(
      `insert into action_events (id, action_id, user_id, kind, barrier_tags) values ($1,$2,$3,$4,$5::jsonb)`,
      [nid("ae"), a.id, userId, done ? "done" : "skipped", asJson(barriers)],
    );
    if (done) {
      await sql(`update actions set status = 'done' where id = $1 and user_id = $2`, [a.id, userId]);
      await recordEffectiveness(
        userId,
        actionTypeFromText(a.text),
        a.expected_metric,
        "up",
      );
      continue;
    }
    const skips = await sql<{ c: number }>(
      `select count(*)::int as c from action_events
       where action_id = $1 and kind = 'skipped'`,
      [a.id],
    );
    if ((skips[0]?.c ?? 0) >= 2) {
      const shrunk = shrinkText(a.text);
      await sql(`update actions set status = 'shrunk' where id = $1 and user_id = $2`, [a.id, userId]);
      await sql(
        `insert into actions (id, user_id, text, status, expected_metric, created_by, shrinking_of, week_start, due_on)
         values ($1,$2,$3,'active',$4,'coach',$5,$6,$7)`,
        [
          nid("a"),
          userId,
          shrunk,
          a.expected_metric,
          a.id,
          week,
          isoDate(addDays(new Date(), 7)),
        ],
      );
    }
  }
}

export function implementationIntention(verbQty: string, trigger: string): string {
  if (!trigger) return verbQty;
  return `When ${trigger.replace(/^when\s+/i, "")}, I will ${verbQty.replace(/^i will\s+/i, "")}`;
}
