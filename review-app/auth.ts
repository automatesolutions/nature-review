import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getGoogleOAuthCredentials } from "@/lib/google-oauth";

export function getAllowedEmailDomain(): string {
  const raw = process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.trim() || "naturalabs.io";
  return raw.replace(/^@/, "").toLowerCase();
}

export function isAllowedReviewerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${getAllowedEmailDomain()}`);
}

export const { handlers, signIn, signOut, auth } = NextAuth(() => {
  const google = getGoogleOAuthCredentials();
  const allowedDomain = getAllowedEmailDomain();
  return {
    trustHost: true,
    providers: [
      Google({
        ...(google.clientId ? { clientId: google.clientId } : {}),
        ...(google.clientSecret ? { clientSecret: google.clientSecret } : {}),
        authorization: {
          params: {
            hd: allowedDomain,
            prompt: "select_account",
          },
        },
      }),
    ],
    pages: {
      signIn: "/login",
      error: "/login",
    },
    callbacks: {
      async signIn({ profile }) {
        const email = profile?.email?.toLowerCase() ?? "";
        const verified = (profile as { email_verified?: boolean } | undefined)
          ?.email_verified;
        if (verified === false) return false;
        return isAllowedReviewerEmail(email);
      },
    },
  };
});
