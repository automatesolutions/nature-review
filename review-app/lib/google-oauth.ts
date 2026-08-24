/** Server-only Google OAuth credentials. Auth.js does not invent a client id. */
export function getGoogleOAuthCredentials(): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  const clientId =
    process.env.AUTH_GOOGLE_ID ||
    process.env.AUTH_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.AUTH_GOOGLE_SECRET ||
    process.env.AUTH_GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
  return {
    clientId: clientId?.trim() || undefined,
    clientSecret: clientSecret?.trim() || undefined,
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleOAuthCredentials();
  return Boolean(clientId && clientSecret);
}
