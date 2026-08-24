/** Local UI testing only. Ignored when NODE_ENV=production (Cloud Run / next start). */
export function isDevAuthBypass(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_DEV_BYPASS === "true"
  );
}

export function devReviewerEmail(): string {
  return process.env.AUTH_DEV_EMAIL?.trim() || "dev@naturalabs.io";
}
