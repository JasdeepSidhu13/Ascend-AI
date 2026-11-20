import { json, withProfile } from "@/lib/http";
import { implementationIntention, shrinkNow } from "@/lib/actions";
import { addDays, isoDate, startOfWeek } from "@/lib/dates";
import { nid, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const body = (await request.json().catch(() => ({}))) as { kind?: "take" | "shrink" };
    const owned = await sql<{ id: string; suggested_action: string }>(
      `select id, suggested_action from insights where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    if (body.kind === "shrink") {
      const result = await shrinkNow(profile.id);
      if (!result.ok) return json({ error: "no_action" }, 400);
      return json({ ok: true, text: result.text, kind: "shrink" });
    }
    const text = owned[0].suggested_action?.trim();
    if (!text) return json({ error: "no_step" }, 400);
    const active = await sql<{ c: number }>(
      `select count(*)::int as c from actions where user_id = $1 and status = 'active'`,
      [profile.id],
    );
    if ((active[0]?.c ?? 0) >= 3) return json({ error: "max_active" }, 400);
    const actionId = nid("a");
    const written = implementationIntention(text, "");
    await sql(
      `insert into actions (id, user_id, text, trigger, due_on, status, created_by, week_start)
       values ($1,$2,$3,$4,$5,'active','insight',$6)`,
      [
        actionId,
        profile.id,
        written,
        "",
        isoDate(addDays(new Date(), 7)),
        isoDate(startOfWeek(new Date())),
      ],
    );
    return json({ ok: true, id: actionId, text: written, kind: "take" });
  });
}
