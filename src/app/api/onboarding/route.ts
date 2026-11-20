import { AREAS } from "@/lib/catalog";
import { asJson, nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { addDays, isoDate } from "@/lib/dates";
import { implementationIntention } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      displayName?: string;
      pulseHour?: number;
      sleepTarget?: number;
      emailPulse?: boolean;
      tz?: string;
    };
    const hour = Math.min(21, Math.max(5, Math.round(body.pulseHour ?? 7)));
    const target = Math.min(10, Math.max(5, Number(body.sleepTarget) || 7.5));
    const tz = (body.tz || "UTC").slice(0, 64);
    await sql(
      `update users set
         display_name = $2,
         pulse_hour = $3,
         email_pulse = $4,
         tz = $5,
         values_json = $6::jsonb,
         onboarding_completed_at = now(),
         sample_data = false
       where id = $1`,
      [
        profile.id,
        (body.displayName ?? profile.displayName ?? "Friend").trim() || "Friend",
        hour,
        body.emailPulse !== false,
        tz,
        asJson(["Health"]),
      ],
    );
    const existing = await sql<{ c: number }>(
      `select count(*)::int as c from goals where user_id = $1`,
      [profile.id],
    );
    if ((existing[0]?.c ?? 0) === 0) {
      const area = AREAS.find((a) => a.key === "health") ?? AREAS[2];
      const gid = nid("g");
      const due = isoDate(addDays(new Date(), 14));
      await sql(
        `insert into goals (id, user_id, area_id, title, why, starts_on, due_on, status)
         values ($1,$2,$3,$4,$5,$6,$7,'active')`,
        [
          gid,
          profile.id,
          area.id,
          `Sleep ${target} hours most nights`,
          "Energy needs a floor under it.",
          isoDate(new Date()),
          due,
        ],
      );
      await sql(
        `insert into key_results (id, goal_id, user_id, metric_key, baseline, target, unit, due_on)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [nid("kr"), gid, profile.id, "health.sleep_hours", 6, target, "h", due],
      );
      const active = await sql<{ c: number }>(
        `select count(*)::int as c from actions where user_id = $1 and status = 'active'`,
        [profile.id],
      );
      if ((active[0]?.c ?? 0) < 3) {
        const text = implementationIntention(
          "turn the lights out 15 minutes earlier",
          "I wash my face",
        );
        await sql(
          `insert into actions (id, user_id, goal_id, text, trigger, due_on, status, expected_metric, created_by, week_start)
           values ($1,$2,$3,$4,$5,$6,'active',$7,'program',$8)`,
          [
            nid("a"),
            profile.id,
            gid,
            text,
            "I wash my face",
            isoDate(addDays(new Date(), 7)),
            "health.sleep_hours",
            isoDate(new Date()),
          ],
        );
      }
    }
    return json({ ok: true });
  });
}
