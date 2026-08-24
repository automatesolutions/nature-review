import { auth } from "@/auth";
import { devReviewerEmail, isDevAuthBypass } from "@/lib/dev-auth";

export async function getReviewerEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (email) return email;
  if (isDevAuthBypass()) return devReviewerEmail();
  return null;
}
