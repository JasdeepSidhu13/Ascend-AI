import { loadUser, toProfile, upsertUser } from "./auth";
import { ensureCatalog, seedSample } from "./seed";
import type { Profile } from "./types";

type IdentityLike = {
  sub: string;
  email: string;
  name?: string;
  simulated?: boolean;
  kind?: string;
};

export async function bootstrapProfile(identity: IdentityLike): Promise<Profile> {
  await ensureCatalog();
  let row = await loadUser(identity.sub);
  if (!row && identity.simulated) {
    await seedSample(identity.sub, {
      email: identity.email,
      name: identity.name || "Alex",
    });
    row = await loadUser(identity.sub);
  }
  if (!row) {
    row = await upsertUser({
      id: identity.sub,
      email: identity.email,
      displayName: identity.name || "",
    });
  }
  return toProfile(row, Boolean(identity.simulated));
}
