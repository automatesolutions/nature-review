import { auth, signOut } from "@/auth";
import { InboxApp } from "@/components/InboxApp";
import { isDevAuthBypass } from "@/lib/dev-auth";
import { getReviewerEmail } from "@/lib/reviewer";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("auth() failed on home", err);
  }
  let email = session?.user?.email ?? "";
  try {
    email = (await getReviewerEmail()) ?? email;
  } catch (err) {
    console.error("getReviewerEmail failed", err);
  }
  const store = await getStore();
  let items: Awaited<ReturnType<typeof store.list>> = [];
  let storeError: string | undefined;
  try {
    items = await store.list();
  } catch (err) {
    console.error("inbox store.list failed", err);
    storeError =
      err instanceof Error
        ? err.message
        : "Could not load posts from Firestore.";
  }

  return (
    <InboxApp
      email={email}
      initialItems={items}
      storeError={storeError}
      signOutAction={async () => {
        "use server";
        if (isDevAuthBypass()) return;
        await signOut({ redirectTo: "/login" });
      }}
    />
  );
}
