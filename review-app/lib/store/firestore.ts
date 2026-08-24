import { Firestore } from "@google-cloud/firestore";
import type { InboxItem } from "../types";
import type { InboxStore } from "./types";

const COLLECTION = "inbox_items";

let client: Firestore | null = null;

function db(): Firestore {
  if (!client) {
    client = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
      databaseId: process.env.FIRESTORE_DATABASE || "(default)",
    });
  }
  return client;
}

function col() {
  return db().collection(COLLECTION);
}

export const firestoreStore: InboxStore = {
  async list() {
    const snap = await col().orderBy("createdAt", "desc").get();
    return snap.docs.map((doc) => ({ ...(doc.data() as InboxItem), id: doc.id }));
  },

  async get(id) {
    const doc = await col().doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as InboxItem), id: doc.id };
  },

  async create(item) {
    const { id, ...rest } = item;
    await col().doc(id).set(rest);
    return item;
  },

  async update(item) {
    const { id, ...rest } = item;
    await col().doc(id).set(rest, { merge: true });
    return item;
  },

  async updateMany(items) {
    const batch = db().batch();
    for (const item of items) {
      const { id, ...rest } = item;
      batch.set(col().doc(id), rest, { merge: true });
    }
    await batch.commit();
    return items;
  },
};
