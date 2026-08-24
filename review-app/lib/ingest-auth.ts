export function hasValidIngestSecret(headerValue: string | null): boolean {
  const expected = process.env.INGEST_SECRET;
  if (!expected) return false;
  return headerValue === expected;
}
