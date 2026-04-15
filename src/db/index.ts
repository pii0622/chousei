import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type DB = DrizzleD1Database<typeof schema>;

export async function getDb(): Promise<DB> {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as Record<string, unknown>).DB as D1Database;
  if (!d1) {
    throw new Error("D1 database binding 'DB' is not configured");
  }
  return drizzle(d1, { schema });
}
