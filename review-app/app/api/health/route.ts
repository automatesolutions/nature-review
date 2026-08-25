import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Unauthenticated. Used to tell a real Next.js revision from Cloud Run's placeholder image. */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: process.env.K_SERVICE ?? null,
    store: process.env.STORE ?? null,
  });
}
