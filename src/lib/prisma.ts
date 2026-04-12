import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let localPrisma: PrismaClient | undefined;

export async function getPrisma(): Promise<PrismaClient> {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as Record<string, unknown>).DB as D1Database;
    if (db) {
      const adapter = new PrismaD1(db);
      return new PrismaClient({ adapter }) as PrismaClient;
    }
  } catch {
    // Not running on Cloudflare — use local SQLite
  }

  if (!localPrisma) {
    localPrisma = new PrismaClient();
  }
  return localPrisma;
}
