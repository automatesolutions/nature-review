import { auth, getAllowedEmailDomain, signIn } from "@/auth";
import { isDevAuthBypass } from "@/lib/dev-auth";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isDevAuthBypass()) redirect("/");

  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;
  const oauthReady = isGoogleOAuthConfigured();
  const denied =
    error === "AccessDenied" || error === "Configuration" || Boolean(error);
  const allowedDomain = getAllowedEmailDomain();

  return (
    <main className="login">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="brand-logo brand-logo-lg"
          src="/Logo-1.png"
          alt="Natura Labs"
          style={{ margin: "0 auto" }}
        />
        <h1>Natura Review Inbox</h1>
        <p>
          Internal review for persona lifestyle posts. Sign in with your{" "}
          <strong>@{allowedDomain}</strong> Google account.
        </p>
        {!oauthReady ? (
          <div className="error" style={{ textAlign: "left" }}>
            Google OAuth is not configured. For a local UI test, set{" "}
            <code>AUTH_DEV_BYPASS=true</code> in <code>.env.local</code> and
            restart <code>npm run dev</code>. For real Google sign-in, add{" "}
            <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>.
          </div>
        ) : null}
        {denied && oauthReady ? (
          <div className="error">
            Access denied. Only verified @{allowedDomain} accounts can open this
            inbox.
          </div>
        ) : null}
        <form
          action={async () => {
            "use server";
            if (!isGoogleOAuthConfigured()) {
              return;
            }
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: "100%" }}
            disabled={!oauthReady}
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
