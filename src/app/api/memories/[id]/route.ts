import { sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      text?: string;
      paused?: boolean;
      confirmed?: boolean;
    };
    const owned = await sql<{ id: string }>(
      `select id from memories where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    if (body.text != null) {
      await sql(`update memories set text = $3 where id = $1 and user_id = $2`, [
        id,
        profile.id,
        body.text,
      ]);
    }
    if (body.paused != null) {
      await sql(`update memories set paused = $3 where id = $1 and user_id = $2`, [
        id,
        profile.id,
        body.paused,
      ]);
    }
    if (body.confirmed != null) {
      await sql(`update memories set confirmed = $3 where id = $1 and user_id = $2`, [
        id,
        profile.id,
        body.confirmed,
      ]);
    }
    return json({ ok: true });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    await sql(`delete from memories where id = $1 and user_id = $2`, [id, profile.id]);
    return json({ ok: true });
  });
}
