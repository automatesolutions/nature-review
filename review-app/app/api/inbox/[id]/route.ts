import { notifyN8n, statusToAction } from "@/lib/n8n";
import { getReviewerEmail } from "@/lib/reviewer";
import { getStore } from "@/lib/store";
import type { InboxItem, PostStatus } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUSES: PostStatus[] = [
  "pending",
  "approved",
  "denied",
  "changes_requested",
];

type PatchBody = {
  caption?: string;
  comment?: string;
  status?: PostStatus;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const email = await getReviewerEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const store = await getStore();
  const existing = await store.get(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next: InboxItem = { ...existing };
  const now = new Date().toISOString();

  if (typeof body.caption === "string") {
    const captionChanged = body.caption !== existing.caption;
    next.caption = body.caption;
    if (
      captionChanged &&
      existing.status === "approved" &&
      body.status !== "approved"
    ) {
      next.status = "pending";
      next.reapprovalRequired = true;
    }
  }

  if (typeof body.comment === "string") {
    next.comment = body.comment;
  }

  if (body.status) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (body.status === "denied" && !next.comment.trim()) {
      return NextResponse.json(
        { error: "A comment is required to deny — explain why" },
        { status: 400 },
      );
    }
    if (body.status === "changes_requested" && !next.comment.trim()) {
      return NextResponse.json(
        { error: "A comment is required to request changes" },
        { status: 400 },
      );
    }
    if (body.status === "approved" && !next.caption.trim()) {
      return NextResponse.json(
        { error: "Caption cannot be empty when approving" },
        { status: 400 },
      );
    }
    next.status = body.status;
    if (body.status === "approved") {
      next.reapprovalRequired = false;
    }
    if (body.status !== "pending") {
      next.reviewedByEmail = email;
      next.reviewedAt = now;
    }
  }

  next.updatedAt = now;
  const saved = await store.update(next);

  const action = body.status ? statusToAction(body.status) : null;
  if (action) {
    const hook = await notifyN8n(saved, action);
    return NextResponse.json({ item: saved, webhook: hook });
  }

  return NextResponse.json({ item: saved });
}
