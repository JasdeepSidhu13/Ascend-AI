import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

type GlobalDb = typeof globalThis & {
  __ascendPool?: pg.Pool;
  __ascendLocal?: Promise<PGlite>;
};

const g = globalThis as GlobalDb;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    g.__ascendPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await g.__ascendPool.query(text, params)).rows as T[];
  }
  g.__ascendLocal ??= startLocal().catch((error: unknown) => {
    g.__ascendLocal = undefined;
    throw error;
  });
  return (await (await g.__ascendLocal).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}

export function nid(prefix = ""): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function asJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function readJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}
