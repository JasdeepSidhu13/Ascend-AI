import { json, withProfile } from "@/lib/http";
import { followThrough, shrinkText } from "@/lib/actions";
import { asJson, nid, sql } from "@/lib/db";
import { addDays, isoDate, startOfWeek } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      status?: "done" | "skipped" | "paused";
      barriers?: string[];
    };
    const owned = await sql<{ id: string; text: string; expected_metric: string | null }>(
      `select id, text, expected_metric from actions where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    if (body.status === "done") {
      await followThrough(profile.id, true, body.barriers ?? [], id);
    } else if (body.status === "skipped") {
      await sql(
        `insert into action_events (id, action_id, user_id, kind, barrier_tags) values ($1,$2,$3,'skipped',$4::jsonb)`,
        [nid("ae"), id, profile.id, asJson(body.barriers ?? [])],
      );
      const skips = await sql<{ c: number }>(
        `select count(*)::int as c from action_events where action_id = $1 and kind = 'skipped'`,
        [id],
      );
      if ((skips[0]?.c ?? 0) >= 2) {
        await sql(`update actions set status = 'shrunk' where id = $1 and user_id = $2`, [id, profile.id]);
        await sql(
          `insert into actions (id, user_id, text, status, expected_metric, created_by, shrinking_of, week_start, due_on)
           values ($1,$2,$3,'active',$4,'coach',$5,$6,$7)`,
          [
            nid("a"),
            profile.id,
            shrinkText(owned[0].text),
            owned[0].expected_metric,
            id,
            isoDate(startOfWeek(new Date())),
            isoDate(addDays(new Date(), 7)),
          ],
        );
      }
    } else if (body.status === "paused") {
      await sql(`update actions set status = 'paused' where id = $1 and user_id = $2`, [id, profile.id]);
    }
    return json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(_request, async (profile) => {
    const owned = await sql<{ id: string }>(
      `select id from actions where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    await sql(`delete from action_events where action_id = $1 and user_id = $2`, [id, profile.id]);
    await sql(`delete from actions where id = $1 and user_id = $2`, [id, profile.id]);
    return json({ ok: true });
  });
}
