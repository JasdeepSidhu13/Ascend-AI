import { nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { implementationIntention } from "@/lib/actions";
import { addDays, isoDate, startOfWeek } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      text: string;
      trigger?: string;
      goalId?: string;
      expectedMetric?: string;
    };
    const active = await sql<{ c: number }>(
      `select count(*)::int as c from actions where user_id = $1 and status = 'active'`,
      [profile.id],
    );
    if ((active[0]?.c ?? 0) >= 3) return json({ error: "max_active" }, 400);
    const text = implementationIntention(body.text, body.trigger ?? "");
    const id = nid("a");
    await sql(
      `insert into actions (id, user_id, goal_id, text, trigger, due_on, status, expected_metric, created_by, week_start)
       values ($1,$2,$3,$4,$5,$6,'active',$7,'user',$8)`,
      [
        id,
        profile.id,
        body.goalId ?? null,
        text,
        body.trigger ?? "",
        isoDate(addDays(new Date(), 7)),
        body.expectedMetric ?? null,
        isoDate(startOfWeek(new Date())),
      ],
    );
    return json({ id, text });
  });
}
