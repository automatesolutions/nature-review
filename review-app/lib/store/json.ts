import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InboxItem } from "../types";
import type { InboxStore } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "inbox.json");

type FileShape = { items: InboxItem[] };

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readDb(): Promise<FileShape> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as FileShape;
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    const empty: FileShape = { items: [] };
    await persist(empty);
    return empty;
  }
}

async function persist(db: FileShape): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
}

export const jsonStore: InboxStore = {
  async list() {
    return withLock(async () => {
      const db = await readDb();
      return [...db.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },

  async get(id) {
    const items = await jsonStore.list();
    return items.find((item) => item.id === id) ?? null;
  },

  async create(item) {
    return withLock(async () => {
      const db = await readDb();
      db.items.unshift(item);
      await persist(db);
      return item;
    });
  },

  async update(item) {
    return withLock(async () => {
      const db = await readDb();
      const index = db.items.findIndex((row) => row.id === item.id);
      if (index === -1) throw new Error(`Item not found: ${item.id}`);
      db.items[index] = item;
      await persist(db);
      return item;
    });
  },

  async updateMany(items) {
    return withLock(async () => {
      const db = await readDb();
      const byId = new Map(items.map((item) => [item.id, item]));
      db.items = db.items.map((row) => byId.get(row.id) ?? row);
      await persist(db);
      return items;
    });
  },
};
