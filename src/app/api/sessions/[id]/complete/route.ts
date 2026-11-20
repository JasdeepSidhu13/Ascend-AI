import { json, withProfile } from "@/lib/http";
import { completeSession } from "@/lib/engine";
import { sql } from "@/lib/db";
import { rateLimited } from "@/lib/limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const owned = await sql<{ id: string; completed_at: string | null }>(
      `select id, completed_at::text as completed_at from sessions where id = $1 and user_id = $2`,
      [id, profile.id],
    );
    if (!owned[0]) return json({ error: "not_found" }, 404);
    if (owned[0].completed_at) return json({ crisis: false, insights: [], already: true });
    if (
      rateLimited(`complete:${profile.id}:${id}`, 2, 10 * 60 * 1000) ||
      rateLimited(`complete-user:${profile.id}`, 12, 60 * 60 * 1000)
    ) {
      return json({ error: "too_many" }, 429);
    }
    const result = await completeSession(profile.id, id);
    return json(result);
  });
}
