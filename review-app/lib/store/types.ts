import type { InboxItem } from "../types";

export interface InboxStore {
  list(): Promise<InboxItem[]>;
  get(id: string): Promise<InboxItem | null>;
  create(item: InboxItem): Promise<InboxItem>;
  update(item: InboxItem): Promise<InboxItem>;
  updateMany(items: InboxItem[]): Promise<InboxItem[]>;
}
