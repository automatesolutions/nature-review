import type { InboxItem, N8nWebhookBody, ReviewAction } from "./types";

function webhookUrlFor(action: ReviewAction): string | undefined {
  if (action === "approve") {
    return process.env.N8N_APPROVE_WEBHOOK || undefined;
  }
  return process.env.N8N_DENY_WEBHOOK || process.env.N8N_APPROVE_WEBHOOK || undefined;
}

export function toWebhookBody(
  item: InboxItem,
  action: ReviewAction,
): N8nWebhookBody {
  return {
    action,
    persona: item.persona,
    personaKey: item.personaKey,
    caption: item.caption,
    imageUrl: item.imageUrl,
    mediaId: item.mediaId,
    comment: item.comment,
    reviewedAt: item.reviewedAt || new Date().toISOString(),
    reviewedByEmail: item.reviewedByEmail,
    postType: item.postType,
    runDate: item.runDate,
    brand: item.brand,
    id: item.id,
  };
}

export async function notifyN8n(
  item: InboxItem,
  action: ReviewAction,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const url = webhookUrlFor(action);
  if (!url) {
    console.warn(
      `[n8n] No webhook URL configured for action=${action}; status saved without outbound call.`,
    );
    return { ok: true, skipped: true };
  }

  const body = toWebhookBody(item, action);
  const payload = JSON.stringify(body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[n8n] webhook ${action} failed ${res.status}: ${text}`);
      return { ok: false, error: `n8n ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[n8n] webhook ${action} error: ${message}`);
    return { ok: false, error: message };
  }
}

export function statusToAction(
  status: InboxItem["status"],
): ReviewAction | null {
  if (status === "approved") return "approve";
  if (status === "denied") return "deny";
  if (status === "changes_requested") return "changes_requested";
  return null;
}
