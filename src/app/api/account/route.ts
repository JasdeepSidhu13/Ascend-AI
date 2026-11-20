import { json, withProfile } from "@/lib/http";
import { deleteAccount } from "@/lib/seed";
import { recordEvent } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  return withProfile(request, async (profile) => {
    await recordEvent(profile.id, "account_deleted", {});
    await deleteAccount(profile.id);
    return json({ ok: true });
  });
}
