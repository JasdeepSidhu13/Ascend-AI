import { json, withProfile } from "@/lib/http";
import { completeSession } from "@/lib/engine";
import { maybeProbe } from "@/lib/sessions";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const owned = await sql<{ id: string }>(
      `select id from sessions where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    const probe = await maybeProbe(profile.id, id);
    const result = await completeSession(profile.id, id);
    return json({ ...result, probe });
  });
}
