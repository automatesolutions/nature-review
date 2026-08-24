import { notifyN8n } from "@/lib/n8n";
import { getReviewerEmail } from "@/lib/reviewer";
import { getStore } from "@/lib/store";
import type { InboxItem } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const email = await getReviewerEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ids: string[] | undefined;
  try {
    const body = (await req.json()) as { ids?: string[] };
    ids = body.ids;
  } catch {
    ids = undefined;
  }

  const store = await getStore();
  const items = await store.list();
  const selected = items.filter((item) => {
    if (ids && ids.length > 0 && !ids.includes(item.id)) return false;
    return item.status === "pending" && item.caption.trim().length > 0;
  });

  const skippedEmpty = items.filter((item) => {
    if (ids && ids.length > 0 && !ids.includes(item.id)) return false;
    return item.status === "pending" && !item.caption.trim();
  }).length;

  const now = new Date().toISOString();
  const updated: InboxItem[] = selected.map((item) => ({
    ...item,
    status: "approved" as const,
    reapprovalRequired: false,
    updatedAt: now,
    reviewedAt: now,
    reviewedByEmail: email,
  }));

  if (updated.length > 0) {
    await store.updateMany(updated);
  }

  const results = [];
  for (const item of updated) {
    results.push(await notifyN8n(item, "approve"));
  }

  return NextResponse.json({
    approved: updated.length,
    skippedEmpty,
    items: updated,
    webhooks: results,
  });
}
