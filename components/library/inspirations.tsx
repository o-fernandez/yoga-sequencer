"use client";

import { useEffect, useRef, useState } from "react";
import { localTodayISO } from "@/lib/sequences";
import {
  isExampleInspiration,
  saveInspiration,
  type InspirationEntry,
} from "@/lib/inspirations";
import { formatShortDate } from "@/lib/format";
import { Modal } from "@/components/modal";

export function InspirationCard({
  entry,
  onOpen,
  onStartClass,
}: {
  entry: InspirationEntry;
  onOpen: () => void;
  onStartClass: () => void;
}) {
  const excerpt = entry.note.trim().slice(0, 100) + (entry.note.trim().length > 100 ? "…" : "");

  return (
    <article
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      onClick={onOpen}
      className="cursor-pointer select-none touch-pan-y rounded-2xl border border-purple-200/60 bg-purple-50/70 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-sm transition [-webkit-touch-callout:none] hover:bg-purple-50/90 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-purple-700/70">
          {formatShortDate(entry.date)}
          {entry.source && (
            <>
              <span className="mx-1.5 text-purple-300">·</span>
              {entry.source}
            </>
          )}
        </p>
        {isExampleInspiration(entry.id) && (
          <span className="shrink-0 rounded-full border border-dashed border-purple-200 px-2 py-0.5 text-[10px] leading-none text-purple-400/80">
            Example
          </span>
        )}
      </div>
      <p className="mt-2 text-[14px] italic leading-relaxed text-stone-700">
        {excerpt}
      </p>
      <div className="mt-3 flex justify-end border-t border-purple-200/40 pt-2.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStartClass(); }}
          className="inline-flex items-center gap-1 text-[12px] text-purple-700/80 transition hover:text-purple-800"
        >
          Start a class from this
          <span aria-hidden>→</span>
        </button>
      </div>
    </article>
  );
}

export function InspirationSheet({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry?: InspirationEntry;
  onSave: (saved: InspirationEntry) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const today = localTodayISO();
  const [note, setNote] = useState(entry?.note ?? "");
  const [source, setSource] = useState(entry?.source ?? "");
  const [date, setDate] = useState(entry?.date ?? today);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = !!entry;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!note.trim()) return;
    const now = new Date().toISOString();
    const saved: InspirationEntry = {
      id: entry?.id ?? crypto.randomUUID(),
      note: note.trim(),
      source: source.trim() || undefined,
      date,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
    };
    saveInspiration(saved);
    onSave(saved);
  };

  return (
    <Modal sheet onDismiss={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <p className="font-display text-base font-medium text-stone-800">
          {isEdit ? "Edit inspiration" : "New inspiration"}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
          </svg>
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What caught your attention…"
        rows={6}
        className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[15px] leading-relaxed text-stone-800 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
      />

      <div className="mt-3 flex gap-3">
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (e.g. Sheri's class)"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-[14px] text-stone-800 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[14px] text-stone-700 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        {isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-[13px] text-rose-500 transition hover:text-rose-700"
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!note.trim()}
          className="rounded-full bg-stone-800 px-5 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

export function InspirationsEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/40 px-8 py-16 text-center">
      <p className="text-sm text-stone-500">No inspirations yet.</p>
      <button
        type="button"
        onClick={onNew}
        className="mt-4 inline-block rounded-full border border-purple-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-purple-50"
      >
        Capture your first
      </button>
    </div>
  );
}
