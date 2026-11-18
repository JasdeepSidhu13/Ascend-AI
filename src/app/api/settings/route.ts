import { asJson, sql } from "@/lib/db";
import { json, withProfile } from "@/lib/http";
import type { Tone } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      displayName?: string;
      tone?: Tone;
      pulseHour?: number;
      quietStart?: number;
      quietEnd?: number;
      values?: string[];
      constraints?: string;
    };
    await sql(
      `update users set
         display_name = coalesce($2, display_name),
         tone = coalesce($3, tone),
         pulse_hour = coalesce($4, pulse_hour),
         quiet_start = coalesce($5, quiet_start),
         quiet_end = coalesce($6, quiet_end),
         values_json = coalesce($7::jsonb, values_json),
         constraints_text = coalesce($8, constraints_text)
       where id = $1`,
      [
        profile.id,
        body.displayName ?? null,
        body.tone ?? null,
        body.pulseHour ?? null,
        body.quietStart ?? null,
        body.quietEnd ?? null,
        body.values ? asJson(body.values) : null,
        body.constraints ?? null,
      ],
    );
    return json({ ok: true });
  });
}
