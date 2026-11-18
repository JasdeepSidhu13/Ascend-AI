import { asJson, nid, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import { embedText } from "@/lib/embed";
import { rateLimited } from "@/lib/limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withProfile(request, async (profile) => {
    const rows = await sql<{ id: string; text: string; created_at: string }>(
      `select id, text, created_at::text as created_at
       from memories where user_id = $1 and layer = 'journal'
       order by created_at desc limit 30`,
      [profile.id],
    );
    return json({ entries: rows });
  });
}

export async function POST(request: Request) {
  return withProfile(request, async (profile) => {
    if (rateLimited(`journal:${profile.id}`, 20, 60 * 60 * 1000)) {
      return json({ error: "too_many" }, 429);
    }
    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? "").trim().slice(0, 4000);
    if (text.length < 8) return json({ error: "short" }, 400);
    const id = nid("m");
    await sql(
      `insert into memories (id, user_id, layer, text, confidence, confirmed, embedding)
       values ($1,$2,'journal',$3,0.7,true,$4::jsonb)`,
      [id, profile.id, text, asJson(embedText(text))],
    );
    return json({ id });
  });
}
