import { sql } from "@/lib/db";
import { withProfile } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withProfile(request, async (profile) => {
    const [responses, insights, memories, goals, actions] = await Promise.all([
      sql(`select * from responses where user_id = $1 order by answered_at`, [profile.id]),
      sql(`select * from insights where user_id = $1 order by shown_at`, [profile.id]),
      sql(`select * from memories where user_id = $1`, [profile.id]),
      sql(`select * from goals where user_id = $1`, [profile.id]),
      sql(`select * from actions where user_id = $1`, [profile.id]),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
      },
      responses,
      insights,
      memories,
      goals,
      actions,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": "attachment; filename=ascend-export.json",
        "cache-control": "private, no-store",
      },
    });
  });
}
