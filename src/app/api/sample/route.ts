import { json, withProfile } from "@/lib/http";
import { clearUserData, seedSample } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withProfile(request, async (profile, identity) => {
    const body = (await request.json()) as { action: "load" | "clear" };
    await clearUserData(profile.id);
    if (body.action === "load") {
      await seedSample(profile.id, {
        email: profile.email,
        name: profile.displayName || "Alex",
      });
    }
    void identity;
    return json({ ok: true });
  });
}
