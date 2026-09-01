import { hasValidIngestSecret } from "@/lib/ingest-auth";
import { brandForPersona, displayNameForPersona, isPersonaKey } from "@/lib/personas";
import { getReviewerEmail } from "@/lib/reviewer";
import { getStore } from "@/lib/store";
import type { InboxItem, IngestPayload, PostType } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getReviewerEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getStore();
  try {
    const items = await store.list();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/inbox list failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Firestore list failed",
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  if (!hasValidIngestSecret(req.headers.get("x-ingest-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IngestPayload;
  try {
    body = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.personaKey || !isPersonaKey(body.personaKey)) {
    return NextResponse.json(
      {
        error:
          "personaKey must be linda_chambers | becca_rose | brooke_swift | abby | melissa_carter | claire_donovan | rebecca_lang | linda_ashford | eleanor_brody",
      },
      { status: 400 },
    );
  }
  if (!body.imageUrl || !body.mediaId) {
    return NextResponse.json(
      { error: "imageUrl and mediaId are required" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const runDate = body.runDate || now.slice(0, 10);
  const weekdayName =
    body.weekdayName ||
    new Date(`${runDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
    });
  const postType: PostType =
    body.postType === "product" ? "product" : "lifestyle";

  const item: InboxItem = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    persona: displayNameForPersona(body.personaKey, body.persona),
    personaKey: body.personaKey,
    caption: body.caption ?? "",
    comment: "",
    status: "pending",
    imageUrl: body.imageUrl,
    mediaId: body.mediaId,
    postType,
    weekdayName,
    runDate,
    brand: brandForPersona(body.personaKey),
    source: "n8n",
  };

  const store = await getStore();
  await store.create(item);
  return NextResponse.json({ item }, { status: 201 });
}
