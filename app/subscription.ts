import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { schools } from "../db/schema";

export const SUPER_ADMIN_EMAIL = "fsaygif@gmail.com";
const normalize = (value: string) => value.trim().toLocaleUpperCase("tr-TR");
export const isCankiriLisesi = (name: string) => normalize(name) === "ÇANKIRI LİSESİ";

export async function getSchoolAccess(schoolId: number) {
  const db = getDb();
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) return null;
  const now = new Date();
  const exempt = isCankiriLisesi(school.name);
  const trialEnd = school.trialEndsAt ? new Date(school.trialEndsAt) : null;
  const premiumEnd = school.premiumUntil ? new Date(school.premiumUntil) : null;
  const premium = exempt || Boolean(premiumEnd && premiumEnd >= now);
  const trial = Boolean(trialEnd && trialEnd >= now);
  const remainingDays = exempt ? null : Math.max(0, Math.ceil(((premium ? premiumEnd! : trialEnd ?? now).getTime() - now.getTime()) / 86400000));
  return { school, exempt, premium, trial, allowed: premium || trial, remainingDays };
}
