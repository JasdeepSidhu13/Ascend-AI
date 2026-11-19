import { sql } from "@/lib/db";
import { withProfile } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withProfile(request, async (profile) => {
    const csv = new URL(request.url).searchParams.get("format") === "csv";
    const [responses, insights, memories, goals, actions] = await Promise.all([
      sql<{ question_id: string; value_num: number | null; value_text: string | null; answered_at: string }>(
        `select question_id, value_num, value_text, answered_at::text as answered_at from responses where user_id = $1 order by answered_at`,
        [profile.id],
      ),
      sql(`select * from insights where user_id = $1 order by shown_at`, [profile.id]),
      sql(`select * from memories where user_id = $1`, [profile.id]),
      sql(`select * from goals where user_id = $1`, [profile.id]),
      sql(`select * from actions where user_id = $1`, [profile.id]),
    ]);
    if (csv) {
      const lines = ["question_id,answered_at,value_num,value_text"];
      for (const r of responses) {
        lines.push(
          [r.question_id, r.answered_at, r.value_num ?? "", JSON.stringify(r.value_text ?? "")].join(","),
        );
      }
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv",
          "content-disposition": "attachment; filename=ascend-export.csv",
          "cache-control": "private, no-store",
        },
      });
    }
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
