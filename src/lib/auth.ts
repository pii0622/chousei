import { SignJWT, jwtVerify } from "jose";
import { requestSenderVerification } from "@/lib/mail";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import type { AdminUser } from "@/db/schema";

const ITERATIONS = 100000;
const SALT_LENGTH = 16;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${toHex(salt)}:${toHex(new Uint8Array(hashBuffer))}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = fromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(hashBuffer)) === hashHex;
}

async function getJwtSecret(): Promise<Uint8Array> {
  const { env } = await getCloudflareContext({ async: true });
  const secret =
    (env as Record<string, string | undefined>).JWT_SECRET ||
    "fallback-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSession(user: AdminUser): Promise<string> {
  const secret = await getJwtSecret();
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
  return token;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const secret = await getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function ensureSuperAdmin(): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  const envMap = env as Record<string, string | undefined>;
  const email = envMap.SUPER_ADMIN_EMAIL;
  const password = envMap.SUPER_ADMIN_PASSWORD;

  if (!email || !password) return;

  const db = await getDb();
  const existing = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, email),
  });

  if (!existing) {
    const passwordHash = await hashPassword(password);
    await db.insert(adminUsers).values({
      id: crypto.randomUUID(),
      email,
      passwordHash,
      name: "管理者",
      role: "super_admin",
    });

    // Auto-trigger sender verification for super admin
    requestSenderVerification(email, "管理者").catch((err) =>
      console.error("[Mail] Failed to request super admin verification:", err)
    );
  }
}
