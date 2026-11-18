import { sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { recordEvent } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as { useful: boolean; note?: string };
    const owned = await sql<{ id: string }>(
      `select id from insights where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    await sql(
      `insert into insight_feedback (insight_id, user_id, useful, note)
       values ($1,$2,$3,$4)
       on conflict (insight_id, user_id) do update set useful = excluded.useful, note = excluded.note, at = now()`,
      [id, profile.id, body.useful, body.note ?? ""],
    );
    await recordEvent(profile.id, "insight_rated", { id, useful: body.useful });
    return json({ ok: true });
  });
}
