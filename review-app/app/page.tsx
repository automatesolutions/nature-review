import { auth, signOut } from "@/auth";
import { InboxApp } from "@/components/InboxApp";
import { isDevAuthBypass } from "@/lib/dev-auth";
import { getReviewerEmail } from "@/lib/reviewer";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const email = (await getReviewerEmail()) ?? session?.user?.email ?? "";
  const store = await getStore();
  const items = await store.list();

  return (
    <InboxApp
      email={email}
      initialItems={items}
      signOutAction={async () => {
        "use server";
        if (isDevAuthBypass()) return;
        await signOut({ redirectTo: "/login" });
      }}
    />
  );
}
