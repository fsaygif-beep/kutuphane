import { desc, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { settings } from "../../../db/schema";

export async function GET() {
  try {
    const [configured] = await getDb().select({ membershipFee: settings.membershipFee }).from(settings).where(gt(settings.membershipFee, 0)).orderBy(desc(settings.membershipFee)).limit(1);
    return Response.json({ membershipFee: Math.max(0, Number(configured?.membershipFee ?? 0)) });
  } catch (error) {
    console.error("pricing api error", error);
    return Response.json({ membershipFee: 0 });
  }
}
