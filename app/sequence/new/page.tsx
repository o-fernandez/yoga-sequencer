"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  generateId,
  saveSequence,
  normalizePoseItem,
  type Section,
} from "@/lib/sequences";
import { SECTION_TEMPLATES, sectionFromTemplate } from "@/lib/section-templates";
import { BulkPoseEntry } from "@/components/bulk-pose-entry";
import { allPoses } from "@/lib/poses";
import { searchPoses } from "@/lib/pose-matcher";
import type { PoseMeta } from "@/lib/poses";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatDateFull(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function autoNameFromTheme(theme: string, dateIso: string): string {
  const stop = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "by","is","are","was","were","your","my","our","their",
  ]);
  const words = theme
    .trim()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stop.has(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const dateStr = formatDate(dateIso);
  return words.length === 0 ? `Class — ${dateStr}` : `${words.join(" ")} — ${dateStr}`;
}

// ─── Peak pose picker ─────────────────────────────────────────────────────────

function PeakPosePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (pose: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visiblePoses = search.trim() ? searchPoses(search.trim()) : allPoses;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
          value
            ? "border-stone-300 bg-white text-stone-800"
            : "border-stone-200 bg-white/60 text-stone-400 hover:border-stone-300"
        }`}
      >
        <span>{value ?? "Select peak pose…"}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3.5 w-3.5 shrink-0 text-stone-400"
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex max-h-72 w-72 flex-col rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search poses…"
              autoFocus
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto p-2 pt-0">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-50"
              >
                <span className="text-stone-400">✕</span> Clear selection
              </button>
            )}
            {visiblePoses.length === 0 ? (
              <p className="px-3 py-3 text-center text-sm text-stone-400">No poses found</p>
            ) : (
              visiblePoses.map((p) => (
                <button
                  key={p.pose}
                  type="button"
                  onClick={() => { onChange(p.pose); setOpen(false); setSearch(""); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    p.pose === value
                      ? "bg-[#e8e3da] font-medium text-stone-900"
                      : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <span>{p.pose}</span>
                  {p.sanskrit && (
                    <span className="truncate text-[11px] italic text-stone-400">{p.sanskrit}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewEntryPage() {
  const router = useRouter();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingDate, setEditingDate] = useState(false);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [peakPose, setPeakPose] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [showStructure, setShowStructure] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleThemeBlur = () => {
    if (!name.trim() && theme.trim()) {
      setName(autoNameFromTheme(theme, date));
    }
  };

  const addFromTemplate = (templateId: string) => {
    const template = SECTION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSections((prev) => [...prev, sectionFromTemplate(template)]);
  };

  const addNamedSection = () => {
    const title = newSectionName.trim();
    if (!title) return;
    setSections((prev) => [
      ...prev,
      { id: generateId(), title, secondSide: false, poses: [] },
    ]);
    setNewSectionName("");
  };

  const addBulkSection = (poses: PoseMeta[]) => {
    if (poses.length === 0) return;
    setSections((prev) => [
      ...prev,
      {
        id: generateId(),
        title: "Poses",
        secondSide: false,
        poses: poses.map((p) =>
          normalizePoseItem({ id: generateId(), pose: p.pose, duration: "", minutes: 0 })
        ),
      },
    ]);
    setShowBulkEntry(false);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const handleSave = () => {
    if (saving) return;
    setSaving(true);

    const newId = generateId();
    const effectiveName =
      name.trim() ||
      (theme.trim() ? autoNameFromTheme(theme, date) : `Class — ${formatDate(date)}`);

    // Always include a trailing empty section so the builder has a place to start
    const trailingEmpty: Section = {
      id: generateId(),
      title: "New section",
      secondSide: false,
      poses: [],
    };

    saveSequence({
      id: newId,
      name: effectiveName,
      theme: theme.trim() || undefined,
      peakPose: peakPose || undefined,
      dates: [{ date, notes: notes.trim() || undefined }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [...sections, trailingEmpty],
      showAnalysis: false,
    });

    router.push(`/sequence/${newId}`);
  };

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl">

        {/* Back nav */}
        <div className="mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Library
          </Link>
        </div>

        <div className="rounded-3xl bg-white/70 p-8 shadow-sm backdrop-blur-sm ring-1 ring-stone-300/30 sm:p-10">

          {/* Date — prominent anchor at the top */}
          <div className="mb-8">
            {editingDate ? (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => setEditingDate(false)}
                autoFocus
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-stone-400 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                className="text-lg font-light text-stone-500 transition hover:text-stone-700"
                title="Tap to change date"
              >
                {formatDateFull(date)}
              </button>
            )}
          </div>

          {/* Name */}
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
              What did you teach?
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Class name (auto-fills from theme)"
              className="w-full bg-transparent font-display text-3xl font-light tracking-tight text-stone-900 placeholder:text-stone-300 focus:outline-none"
            />
          </div>

          {/* Theme */}
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
              Theme or intention
            </p>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              onBlur={handleThemeBlur}
              placeholder="What were you exploring?"
              className="w-full bg-transparent font-display text-base font-light italic text-stone-600 placeholder:text-stone-300 focus:outline-none"
            />
          </div>

          {/* Peak pose */}
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
              Peak pose
            </p>
            <PeakPosePicker value={peakPose} onChange={setPeakPose} />
          </div>

          {/* Notes */}
          <div className="mb-8">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
              Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go? What was new? What do you want to remember?"
              rows={4}
              className="w-full resize-none rounded-xl border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
            />
          </div>

          {/* Save — always visible, always works */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-stone-800 px-6 py-3 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>

          {/* ── Add structure (optional) ─────────────────────────────────── */}
          <div className="mt-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200/70" />
              <button
                type="button"
                onClick={() => setShowStructure((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-stone-400 transition hover:text-stone-600"
              >
                <span aria-hidden>{showStructure ? "▾" : "▸"}</span>
                Add structure
                <span className="text-stone-300">(optional)</span>
              </button>
              <div className="h-px flex-1 bg-stone-200/70" />
            </div>

            {showStructure && (
              <div className="space-y-7">

                {/* 1. From template */}
                <div>
                  <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
                    From template
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SECTION_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => addFromTemplate(template.id)}
                        className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Name a section */}
                <div>
                  <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
                    Name a section
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addNamedSection(); }
                      }}
                      placeholder="Neutral hips round, Floor backbend series…"
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addNamedSection}
                      disabled={!newSectionName.trim()}
                      className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* 3. Add poses */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowBulkEntry((v) => !v)}
                    className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 transition hover:text-stone-600"
                  >
                    <span aria-hidden>{showBulkEntry ? "▾" : "▸"}</span>
                    Add poses
                  </button>
                  {showBulkEntry && (
                    <div className="mt-3">
                      <BulkPoseEntry
                        renderFooter={(resolved) => (
                          <button
                            type="button"
                            disabled={resolved.length === 0}
                            onClick={() => addBulkSection(resolved)}
                            className="rounded-full bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Add {resolved.length} pose{resolved.length === 1 ? "" : "s"} as section
                          </button>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Sections already added */}
                {sections.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">
                      Added ({sections.length} section{sections.length === 1 ? "" : "s"})
                    </p>
                    <div className="space-y-2">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between rounded-xl border border-stone-200 bg-white/60 px-4 py-2.5"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-stone-700">
                            <span>{section.title}</span>
                            {(section.rounds ?? 1) > 1 && (
                              <span className="text-xs text-stone-400">× {section.rounds}</span>
                            )}
                            {section.poses.length > 0 && (
                              <span className="text-xs text-stone-400">
                                · {section.poses.length} pose{section.poses.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSection(section.id)}
                            className="ml-4 shrink-0 text-xs text-stone-400 transition hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
