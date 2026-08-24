import type { InboxItem } from "./types";

export function isSeedItem(item: InboxItem): boolean {
  return item.source === "seed" || item.id.startsWith("seed-");
}
