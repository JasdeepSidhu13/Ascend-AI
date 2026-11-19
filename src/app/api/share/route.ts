import { nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { newToken } from "@/lib/crypto-pass";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as { goalId?: string };
    const goal = await sql<{ id: string }>(
      `select id from goals where id = $1 and user_id = $2`,
      [body.goalId ?? "", profile.id],
    );
    if (!goal[0]) return json({ error: "not_found" }, 404);
    const existing = await sql<{ token: string }>(
      `select token from share_links where user_id = $1 and goal_id = $2`,
      [profile.id, goal[0].id],
    );
    if (existing[0]) return json({ token: existing[0].token });
    const token = newToken().slice(0, 24);
    await sql(`insert into share_links (id, user_id, goal_id, token) values ($1,$2,$3,$4)`, [
      nid("sh"),
      profile.id,
      goal[0].id,
      token,
    ]);
    return json({ token });
  });
}
