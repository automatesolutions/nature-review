import type { InboxStore } from "./types";
import { jsonStore } from "./json";

export type StoreKind = "json" | "firestore";

export function resolveStoreKind(): StoreKind {
  const explicit = process.env.STORE?.toLowerCase();
  if (explicit === "json" || explicit === "firestore") return explicit;
  if (process.env.K_SERVICE) return "firestore";
  return "json";
}

export async function getStore(): Promise<InboxStore> {
  if (resolveStoreKind() === "firestore") {
    const { firestoreStore } = await import("./firestore");
    return firestoreStore;
  }
  return jsonStore;
}
