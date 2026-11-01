import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { appSessions, appUsers } from "../db/schema";

export type AppIdentity = {
  id: number;
  email: string;
  displayName: string;
  role: "platform_admin" | "admin" | "staff" | "student";
  permissions: string[];
  schoolId: number | null;
  studentId: number | null;
  active: number;
};

export async function getAppIdentity(
  request: Request,
): Promise<AppIdentity | null> {
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)library_session=([^;]+)/)?.[1];
  if (!token) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(decodeURIComponent(token)));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const db = getDb();
  const [user] = await db.select({
    id: appUsers.id, email: appUsers.email, displayName: appUsers.displayName,
    role: appUsers.role, permissions: appUsers.permissions, schoolId: appUsers.schoolId, studentId: appUsers.studentId, active: appUsers.active,
  }).from(appSessions).innerJoin(appUsers, eq(appSessions.userId, appUsers.id))
    .where(and(eq(appSessions.tokenHash, tokenHash), gt(appSessions.expiresAt, new Date().toISOString())));
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    studentId: user.studentId,
    schoolId: user.schoolId,
    active: user.active,
    permissions: String(user.permissions ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    role:
      user.role === "platform_admin" || user.role === "admin" || user.role === "staff" ? user.role : "student",
  };
}

export const canManage = (user: AppIdentity | null) =>
  user?.role === "admin" || user?.role === "staff";
