"use client";

import { useMemo, useState } from "react";
import {
  poseLibrary,
  allPoses,
  getBodyRegionClasses,
  getBodyTargetLabel,
  type PoseMeta,
} from "@/lib/poses";
import { searchPoses } from "@/lib/pose-matcher";
import { buildPoseMemory, poseMemoryNote, type PoseMemoryNote } from "@/lib/pose-memory";
import { loadSequences, type Section } from "@/lib/sequences";
import { SECTION_TEMPLATES } from "@/lib/section-templates";
import { BulkPoseEntry } from "@/components/bulk-pose-entry";

function PoseRow({ meta, note, onAdd }: { meta: PoseMeta; note?: PoseMemoryNote | null; onAdd: () => void }) {
  const regionClasses = getBodyRegionClasses(meta.bodyRegion);
  const chips = meta.bodyTargets.slice(0, 2);
  return (
    <button
      type="button"
      onClick={onAdd}
      className={`w-full rounded-xl border border-stone-200 px-4 py-3 text-left transition hover:brightness-95 ${
        regionClasses ? regionClasses.gradient : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm text-stone-800">{meta.pose}</span>
          {meta.sanskrit && (
            <span className="truncate text-[11px] italic text-stone-400">{meta.sanskrit}</span>
          )}
        </div>
        <span className="shrink-0 text-xs text-stone-500">{meta.duration}</span>
      </div>
      {note && (
        <p className={`mt-1 text-[11px] italic ${note.tone === "cold" ? "text-amber-700/70" : "text-stone-400"}`}>
          {note.text}
        </p>
      )}
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((t) => (
            <span key={t} className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-stone-500">
              {getBodyTargetLabel(t)}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

export function AddPoseModal({
  targetSection,
  onAdd,
  onAddMany,
  onClose,
  onApplyTemplate,
}: {
  targetSection: Section;
  onAdd: (sectionId: string, poseName: string) => void;
  onAddMany: (sectionId: string, poses: PoseMeta[]) => void;
  onClose: () => void;
  onApplyTemplate: (sectionId: string, templateId: string) => void;
}) {
  const [mode, setMode] = useState<"search" | "paste">("search");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();

  // Teaching memory across the whole library — quiet "cold" / "new" nudges.
  const memory = useMemo(() => buildPoseMemory(loadSequences()), []);

  const rankedPoses: PoseMeta[] = (() => {
    if (!query) return [];
    const ranked = searchPoses(search.trim());
    const inRanked = new Set(ranked.map((p) => p.pose));
    const byBodyPart = allPoses.filter(
      (p) =>
        !inRanked.has(p.pose) &&
        p.bodyTargets.some((t) => getBodyTargetLabel(t).toLowerCase().includes(query))
    );
    return [...ranked, ...byBodyPart];
  })();

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-stone-900/20 p-6">
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-stone-50 shadow-lg ring-1 ring-stone-200/60">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-base font-medium text-stone-800">Add pose</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm text-stone-500 transition hover:bg-[#e8e3da] hover:text-stone-700" aria-label="Close">
            Close
          </button>
        </div>
        <p className="px-5 pb-3 text-xs text-stone-500">
          Adding to <span className="font-medium text-stone-700">{targetSection.title}</span>
        </p>

        {/* Mode tabs */}
        <div className="mx-5 mb-3 flex gap-1 rounded-lg bg-stone-100 p-1">
          {(["search", "paste"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                mode === m ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {m === "search" ? "Search" : "Quick entry"}
            </button>
          ))}
        </div>

        {mode === "paste" ? (
          <div className="overflow-y-auto px-5 pb-5">
            <BulkPoseEntry
              autoFocus
              renderFooter={(resolved) => (
                <button
                  type="button"
                  disabled={resolved.length === 0}
                  onClick={() => { onAddMany(targetSection.id, resolved); onClose(); }}
                  className="rounded-full bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add {resolved.length} pose{resolved.length === 1 ? "" : "s"}
                </button>
              )}
            />
          </div>
        ) : (
        <>
        {/* Search */}
        <div className="px-5 pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search poses…"
            autoFocus
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
          />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 pb-5">
          {/* Templates */}
          <div className="mb-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">
              Fill section with
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => { onApplyTemplate(targetSection.id, template.id); onClose(); }}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 border-t border-stone-200" />

          {/* Poses: flat ranked when searching, grouped by category otherwise */}
          {query ? (
            rankedPoses.length === 0 ? (
              <p className="py-4 text-center text-sm text-stone-400">No poses found</p>
            ) : (
              <div className="space-y-1.5">
                {rankedPoses.map((meta) => (
                  <PoseRow
                    key={meta.pose}
                    meta={meta}
                    note={poseMemoryNote(meta.pose, memory, true)}
                    onAdd={() => onAdd(targetSection.id, meta.pose)}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {poseLibrary.map((cat) => (
                <div key={cat.category}>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">
                    {cat.category}
                  </p>
                  <div className="space-y-1.5">
                    {cat.poses.map((meta) => (
                      <PoseRow
                        key={meta.pose}
                        meta={meta}
                        note={poseMemoryNote(meta.pose, memory, false)}
                        onAdd={() => onAdd(targetSection.id, meta.pose)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
