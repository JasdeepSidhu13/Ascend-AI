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
      emailPulse?: boolean;
      tz?: string;
    };
    await sql(
      `update users set
         display_name = coalesce($2, display_name),
         tone = coalesce($3, tone),
         pulse_hour = coalesce($4, pulse_hour),
         quiet_start = coalesce($5, quiet_start),
         quiet_end = coalesce($6, quiet_end),
         values_json = coalesce($7::jsonb, values_json),
         constraints_text = coalesce($8, constraints_text),
         email_pulse = coalesce($9, email_pulse),
         tz = coalesce($10, tz)
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
        body.emailPulse == null ? null : body.emailPulse,
        body.tz ?? null,
      ],
    );
    return json({ ok: true });
  });
}
