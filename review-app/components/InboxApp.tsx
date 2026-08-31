"use client";

import { PERSONAS, genderForPersona, type Gender } from "@/lib/personas";
import { isSeedItem } from "@/lib/seed-flag";
import type { Brand, InboxItem, PersonaKey, PostStatus } from "@/lib/types";
import { isThisWeek, weekLabel } from "@/lib/week";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StatusFilter = PostStatus | "all";
type ViewMode = "grid" | "list";

const STATUS_LABEL: Record<PostStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  changes_requested: "Changes requested",
};

function reviewerLine(item: InboxItem): string | null {
  if (!item.reviewedByEmail) return null;
  if (item.status === "approved") return `Approved by ${item.reviewedByEmail}`;
  if (item.status === "denied") return `Denied by ${item.reviewedByEmail}`;
  return `Reviewed by ${item.reviewedByEmail}`;
}

function statusChip(item: InboxItem): string {
  if (item.status === "pending" && item.reapprovalRequired) {
    return "Pending — re-approve after caption edit";
  }
  return STATUS_LABEL[item.status];
}

export function InboxApp({
  email,
  initialItems,
  signOutAction,
  storeError,
}: {
  email: string;
  initialItems: InboxItem[];
  signOutAction: () => Promise<void>;
  storeError?: string;
}) {
  const [items, setItems] = useState<InboxItem[]>(initialItems);
  const [error, setError] = useState<string | null>(storeError ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [persona, setPersona] = useState<PersonaKey | "all">("all");
  const [brand, setBrand] = useState<Brand | "all">("all");
  const [gender, setGender] = useState<Gender | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { caption: string; comment: string }>
  >(() =>
    Object.fromEntries(
      initialItems.map((item) => [
        item.id,
        { caption: item.caption, comment: item.comment },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(busy);
  const itemsRef = useRef(items);
  const draftsRef = useRef(drafts);
  busyRef.current = busy;
  itemsRef.current = items;
  draftsRef.current = drafts;

  const applyItems = useCallback((nextItems: InboxItem[]) => {
    setItems(nextItems);
    setDrafts(
      Object.fromEntries(
        nextItems.map((item) => [
          item.id,
          { caption: item.caption, comment: item.comment },
        ]),
      ),
    );
  }, []);

  const mergeFromServer = useCallback((nextItems: InboxItem[]) => {
    const prevItems = itemsRef.current;
    const prevIds = new Set(prevItems.map((item) => item.id));
    const arrived = nextItems.filter((item) => !prevIds.has(item.id)).length;
    const prevById = new Map(prevItems.map((item) => [item.id, item]));
    const prevDrafts = draftsRef.current;

    setItems(nextItems);
    setDrafts(() => {
      const next: Record<string, { caption: string; comment: string }> = {};
      for (const item of nextItems) {
        const draft = prevDrafts[item.id];
        const old = prevById.get(item.id);
        const editing =
          draft &&
          old &&
          (draft.caption !== old.caption || draft.comment !== old.comment);
        next[item.id] = editing
          ? draft
          : { caption: item.caption, comment: item.comment };
      }
      return next;
    });

    if (arrived > 0) {
      setToast(
        `${arrived} new post${arrived === 1 ? "" : "s"} arrived from n8n.`,
      );
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      if (!res.ok) {
        setError("Could not load inbox.");
        return;
      }
      const data = (await res.json()) as { items: InboxItem[] };
      applyItems(data.items);
    } catch {
      setError("Could not load inbox.");
    }
  }, [applyItems]);

  const poll = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: InboxItem[] };
      mergeFromServer(data.items);
    } catch {
      // Ignore transient failures (HMR, tab sleep, brief offline).
    }
  }, [mergeFromServer]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void poll();
    }, 8000);
    function onVisible() {
      if (document.visibilityState === "visible") void poll();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const thisWeekCount = items.filter((item) => isThisWeek(item.runDate)).length;

  const scopedItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return (
        item.persona.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.personaKey.toLowerCase().includes(q) ||
        item.mediaId.toLowerCase().includes(q) ||
        item.caption.toLowerCase().includes(q)
      );
    });
  }, [items, query, status]);

  function countBrand(value: Brand | "all") {
    if (value === "all") return scopedItems.length;
    return scopedItems.filter((item) => item.brand === value).length;
  }

  function countGender(value: Gender | "all") {
    if (value === "all") return scopedItems.length;
    return scopedItems.filter(
      (item) => genderForPersona(item.personaKey) === value,
    ).length;
  }

  function countName(value: PersonaKey | "all") {
    if (value === "all") return scopedItems.length;
    return scopedItems.filter((item) => item.personaKey === value).length;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (persona !== "all" && item.personaKey !== persona) return false;
      if (brand !== "all" && item.brand !== brand) return false;
      if (gender !== "all" && genderForPersona(item.personaKey) !== gender) {
        return false;
      }
      if (!q) return true;
      return (
        item.persona.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.personaKey.toLowerCase().includes(q) ||
        item.mediaId.toLowerCase().includes(q) ||
        item.caption.toLowerCase().includes(q)
      );
    });
  }, [items, query, status, persona, brand, gender]);

  const groups = useMemo(() => {
    const map = new Map<string, InboxItem[]>();
    for (const item of filtered) {
      const key = weekLabel(item.runDate);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const visibleIds = filtered.map((item) => item.id);
  const lightboxIndex = lightboxId
    ? visibleIds.indexOf(lightboxId)
    : -1;
  const lightboxItem =
    lightboxIndex >= 0 ? filtered[lightboxIndex] : null;

  function draftFor(item: InboxItem) {
    return drafts[item.id] ?? { caption: item.caption, comment: item.comment };
  }

  function setDraft(
    id: string,
    patch: Partial<{ caption: string; comment: string }>,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        caption: prev[id]?.caption ?? "",
        comment: prev[id]?.comment ?? "",
        ...patch,
      },
    }));
  }

  async function patchItem(
    id: string,
    body: { caption?: string; comment?: string; status?: PostStatus },
  ) {
    setBusy(id);
    setToast(null);
    const res = await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setToast(data.error || "Update failed");
      return;
    }
    const item = data.item as InboxItem;
    setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)));
    setDrafts((prev) => ({
      ...prev,
      [item.id]: { caption: item.caption, comment: item.comment },
    }));
  }

  async function setStatusFor(item: InboxItem, next: PostStatus) {
    const draft = draftFor(item);
    if (next === "denied" && !draft.comment.trim()) {
      setToast("Internal comment is required to Deny — explain why.");
      return;
    }
    if (next === "approved" && !draft.caption.trim()) {
      setToast("Caption cannot be empty when approving.");
      return;
    }
    await patchItem(item.id, {
      caption: draft.caption,
      comment: draft.comment,
      status: next,
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPending() {
    const ids = filtered
      .filter((item) => item.status === "pending")
      .map((item) => item.id);
    setSelected(new Set(ids));
  }

  async function bulkApprove() {
    setBusy("bulk");
    const res = await fetch("/api/inbox/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    const data = await res.json();
    setBusy(null);
    setToast(
      `Approved ${data.approved ?? 0}. Skipped empty captions: ${data.skippedEmpty ?? 0}.`,
    );
    setSelected(new Set());
    await load();
  }

  function toggleWeek(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function goLightbox(delta: number) {
    if (lightboxIndex < 0) return;
    const next = lightboxIndex + delta;
    if (next < 0 || next >= visibleIds.length) return;
    setLightboxId(visibleIds[next]);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightboxId) return;
      if (e.key === "Escape") setLightboxId(null);
      if (e.key === "ArrowLeft" && lightboxIndex > 0) {
        setLightboxId(visibleIds[lightboxIndex - 1]);
      }
      if (e.key === "ArrowRight" && lightboxIndex < visibleIds.length - 1) {
        setLightboxId(visibleIds[lightboxIndex + 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxId, lightboxIndex, visibleIds]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-logo"
            src="/Logo-1.png"
            alt="Natura Labs"
          />
          <div>
            <div className="title">
              This week ({thisWeekCount} post{thisWeekCount === 1 ? "" : "s"})
            </div>
            <div className="count">
              {items.length} in inbox · live
            </div>
          </div>
          <input
            className="search"
            placeholder="Search by persona or id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="spacer" />
          <span className="user-email">{email}</span>
          <form action={signOutAction}>
            <button className="btn btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <div className="topbar-row">
          <div className="filter-dropdowns">
            <label className="filter-field">
              <span>Brand</span>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as Brand | "all")}
              >
                <option value="all">All ({countBrand("all")})</option>
                <option value="Montana Tallow">
                  Montana Tallow ({countBrand("Montana Tallow")})
                </option>
                <option value="Lumerval">
                  Lumerval ({countBrand("Lumerval")})
                </option>
              </select>
            </label>
            <label className="filter-field">
              <span>Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | "all")}
              >
                <option value="all">All ({countGender("all")})</option>
                <option value="female">Female ({countGender("female")})</option>
                <option value="male">Male ({countGender("male")})</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Name</span>
              <select
                value={persona}
                onChange={(e) =>
                  setPersona(e.target.value as PersonaKey | "all")
                }
              >
                <option value="all">All ({countName("all")})</option>
                {PERSONAS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} ({countName(p.key)})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="segment">
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
              type="button"
            >
              Grid
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              type="button"
            >
              List
            </button>
          </div>
          <div className="filters">
            {(
              ["all", "pending", "approved", "denied"] as StatusFilter[]
            ).map((value) => (
              <button
                key={value}
                className={`chip ${status === value ? "active" : ""}`}
                type="button"
                onClick={() => setStatus(value)}
              >
                {value === "all" ? "All" : STATUS_LABEL[value]}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="btn" type="button" onClick={selectAllPending}>
            Select all pending
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={selected.size === 0 || busy === "bulk"}
            onClick={() => void bulkApprove()}
          >
            Approve selected
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setSelected(new Set())}
          >
            Deselect all
          </button>
        </div>
        {toast ? <div className="hint">{toast}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {items.some(isSeedItem) ? (
          <p className="hint">
            Placeholder photos (picsum) are demo seed data so the UI can be
            tested. They are not Higgsfield images. Real n8n posts appear after
            POST /api/inbox and will not have a Demo badge.
          </p>
        ) : null}
      </header>

      <main className="main">
        {items.length === 0 ? (
          <p className="empty">
            Inbox is empty. Point n8n persona HTTP Request at{" "}
            <code>
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/inbox`
                : "/api/inbox"}
            </code>
            {" "}
            with header <code>x-ingest-secret</code> and JSON{" "}
            <code>personaKey</code>. Do not POST ingest to webhook/approval-router
            (that URL is only for Approve).
          </p>
        ) : groups.length === 0 ? (
          <p className="empty">No posts match these filters.</p>
        ) : null}
        {groups.map(([label, groupItems]) => {
          const open = !collapsed.has(label);
          return (
            <section className="week-block" key={label}>
              <button
                className="week-head"
                type="button"
                onClick={() => toggleWeek(label)}
              >
                <span>{open ? "▾" : "▸"}</span>
                <h2>
                  {label} ({groupItems.length}{" "}
                  {groupItems.length === 1 ? "post" : "posts"})
                </h2>
              </button>
              {open ? (
                <div className={`week-body ${view === "grid" ? "grid" : "list"}`}>
                  {groupItems.map((item) => (
                    <PostCard
                      key={item.id}
                      item={item}
                      view={view}
                      selected={selected.has(item.id)}
                      draft={draftFor(item)}
                      busy={busy === item.id}
                      onSelect={() => toggleSelect(item.id)}
                      onCaption={(caption) => setDraft(item.id, { caption })}
                      onComment={(comment) => setDraft(item.id, { comment })}
                      onStatus={(s) => void setStatusFor(item, s)}
                      onOpen={() => setLightboxId(item.id)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </main>

      {lightboxItem ? (
        <Lightbox
          item={lightboxItem}
          index={lightboxIndex}
          total={visibleIds.length}
          draft={draftFor(lightboxItem)}
          busy={busy === lightboxItem.id}
          onClose={() => setLightboxId(null)}
          onPrev={() => goLightbox(-1)}
          onNext={() => goLightbox(1)}
          onCaption={(caption) => setDraft(lightboxItem.id, { caption })}
          onComment={(comment) => setDraft(lightboxItem.id, { comment })}
          onStatus={(s) => void setStatusFor(lightboxItem, s)}
        />
      ) : null}
    </div>
  );
}

function PostCard({
  item,
  view,
  selected,
  draft,
  busy,
  onSelect,
  onCaption,
  onComment,
  onStatus,
  onOpen,
}: {
  item: InboxItem;
  view: ViewMode;
  selected: boolean;
  draft: { caption: string; comment: string };
  busy: boolean;
  onSelect: () => void;
  onCaption: (v: string) => void;
  onComment: (v: string) => void;
  onStatus: (s: PostStatus) => void;
  onOpen: () => void;
}) {
  const locked = item.status === "approved" || item.status === "denied";
  const fieldsDisabled = busy || locked;
  const captionDirty = draft.caption !== item.caption;
  const showReapproveHint =
    item.status === "approved" && captionDirty && !locked;

  return (
    <article className="card">
      <div className="thumb" onClick={onOpen} role="button" tabIndex={0}>
        <input
          className="select-box"
          type="checkbox"
          checked={selected}
          disabled={locked}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={`${item.persona} post`} />
        {isSeedItem(item) ? <span className="demo-badge">Demo · not from n8n</span> : null}
      </div>
      <div className="card-body">
        <div className="persona">{item.persona}</div>
        <div className="meta-row">
          <span className="tag">{item.brand}</span>
          <span className={`status ${item.status}`}>{statusChip(item)}</span>
          {reviewerLine(item) ? (
            <span className="reviewer">{reviewerLine(item)}</span>
          ) : null}
          <span>
            {item.weekdayName} · {item.runDate}
          </span>
          <span>{item.postType}</span>
        </div>
        <div className="ids">
          {item.personaKey} · {item.mediaId}
        </div>
        <label className="field-label">Caption (posts to Facebook)</label>
        <textarea
          value={draft.caption}
          onChange={(e) => onCaption(e.target.value)}
          disabled={fieldsDisabled}
        />
        {locked ? (
          <p className="hint">
            {item.status === "approved"
              ? "Approved — sent to Postbridge. Actions are locked."
              : "Denied — will not post. Actions are locked."}
          </p>
        ) : null}
        {showReapproveHint ? (
          <p className="hint">
            Saving this caption returns the post to Pending until you re-Approve.
          </p>
        ) : null}
        {item.reapprovalRequired && item.status === "pending" ? (
          <p className="hint">Caption changed after Approve — re-approve to send to n8n.</p>
        ) : null}
        <label className="field-label">Internal comment (required to Deny)</label>
        <textarea
          className="comment"
          value={draft.comment}
          onChange={(e) => onComment(e.target.value)}
          disabled={fieldsDisabled}
          placeholder="If you Deny, explain why (never posted)…"
        />
        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={fieldsDisabled}
            onClick={() => onStatus("approved")}
          >
            Approve
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={fieldsDisabled}
            onClick={() => onStatus("denied")}
          >
            Deny
          </button>
        </div>
        {view === "list" && item.reviewedAt ? (
          <div className="ids">
            {item.status} {item.reviewedAt.slice(0, 10)}
            {item.reviewedByEmail ? ` · ${item.reviewedByEmail}` : ""}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Lightbox({
  item,
  index,
  total,
  draft,
  busy,
  onClose,
  onPrev,
  onNext,
  onCaption,
  onComment,
  onStatus,
}: {
  item: InboxItem;
  index: number;
  total: number;
  draft: { caption: string; comment: string };
  busy: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCaption: (v: string) => void;
  onComment: (v: string) => void;
  onStatus: (s: PostStatus) => void;
}) {
  const locked = item.status === "approved" || item.status === "denied";
  const fieldsDisabled = busy || locked;

  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <div className="lightbox-stage">
        <button className="nav-arrow left" type="button" onClick={onPrev} disabled={index <= 0}>
          ‹
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={`${item.persona} enlarged`} />
        <button
          className="nav-arrow right"
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
        >
          ›
        </button>
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
          }}
        >
          {index + 1} / {total} · {item.postType}
        </div>
      </div>
      <aside className="drawer">
        <div className="topbar-row">
          <strong>{item.persona}</strong>
          <div className="spacer" />
          <button className="btn close-x" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={`status ${item.status}`}>{statusChip(item)}</div>
        {reviewerLine(item) ? (
          <p className="reviewer">{reviewerLine(item)}</p>
        ) : null}
        {locked ? (
          <p className="hint">
            {item.status === "approved"
              ? "Approved — sent to Postbridge. Actions are locked."
              : "Denied — will not post. Actions are locked."}
          </p>
        ) : null}
        <div className="ids">
          {item.personaKey} · {item.mediaId}
        </div>
        <label className="field-label">Caption</label>
        <textarea
          value={draft.caption}
          onChange={(e) => onCaption(e.target.value)}
          disabled={fieldsDisabled}
        />
        <label className="field-label">Internal comment (required to Deny)</label>
        <textarea
          className="comment"
          value={draft.comment}
          onChange={(e) => onComment(e.target.value)}
          disabled={fieldsDisabled}
          placeholder="If you Deny, explain why (never posted)…"
        />
        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={fieldsDisabled}
            onClick={() => onStatus("approved")}
          >
            Approve
          </button>
          <button
            className="btn btn-danger"
            type="button"
            disabled={fieldsDisabled}
            onClick={() => onStatus("denied")}
          >
            Deny
          </button>
        </div>
      </aside>
    </div>
  );
}
