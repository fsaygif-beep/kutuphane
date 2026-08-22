import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { appUsers } from "../db/schema";

export type AppIdentity = {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "staff" | "student";
  studentId: number | null;
  active: number;
};

export async function getAppIdentity(
  request: Request,
  bootstrap = false,
): Promise<AppIdentity | null> {
  const email = (request.headers.get("oai-authenticated-user-email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const db = getDb();
  let [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, email));
  if (!user && bootstrap) {
    const [total] = await db
      .select({ count: sql<number>`count(*)` })
      .from(appUsers);
    if (Number(total?.count ?? 0) === 0) {
      const nameHeader = request.headers.get(
        "oai-authenticated-user-full-name",
      );
      let displayName = email;
      try {
        if (nameHeader) displayName = decodeURIComponent(nameHeader);
      } catch {}
      await db
        .insert(appUsers)
        .values({
          email,
          displayName,
          role: "admin",
          active: 1,
          createdAt: new Date().toISOString(),
        });
      [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email));
    }
  }
  if (!user || !user.active) return null;
  return {
    ...user,
    role:
      user.role === "admin" || user.role === "staff" ? user.role : "student",
  };
}

export const canManage = (user: AppIdentity | null) =>
  user?.role === "admin" || user?.role === "staff";
