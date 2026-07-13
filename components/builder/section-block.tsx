"use client";

import { useEffect, useRef, useState } from "react";
import { formatBreathEstimate, type Section } from "@/lib/sequences";
import { getPoseMeta } from "@/lib/poses";
import { abbreviatePose } from "@/lib/pose-abbreviations";
import type { PeakReadiness } from "@/lib/peak-readiness";
import type { SectionsAction } from "@/lib/sections-reducer";
import { PoseCueField, PoseCueSuggestions } from "./pose-cue";
import { PeakReadinessNote } from "./peak-readiness-note";

function BreathsControl({
  breaths,
  holdMode,
  onChange,
}: {
  breaths: number;
  holdMode: boolean;
  onChange: (breaths: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, breaths - 1)); }}
        aria-label="Fewer breaths"
        className="flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-200/60 hover:text-stone-600"
      >
        <span className="text-sm leading-none select-none">−</span>
      </button>
      <span className="min-w-[1.75ch] text-center text-xs tabular-nums text-stone-700">{breaths}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(breaths + 1); }}
        aria-label="More breaths"
        className="flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-200/60 hover:text-stone-600"
      >
        <span className="text-sm leading-none select-none">+</span>
      </button>
      <span className="text-[10px] tabular-nums text-stone-400">
        {formatBreathEstimate(breaths, holdMode)}
      </span>
    </div>
  );
}

export function CompactSectionBlock({
  section,
  peakPoseId,
  peakReadiness,
  firstPoseId,
  lastPoseId,
  canMoveUp,
  canMoveDown,
  dispatch,
  onSetPeak,
  onOpenAddPose,
  onAddPrep,
}: {
  section: Section;
  peakPoseId: string | null;
  peakReadiness: PeakReadiness | null;
  firstPoseId: string | null;
  lastPoseId: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** All section/pose edits go through the sections reducer. */
  dispatch: (action: SectionsAction) => void;
  /** Peak lives on the record, not in the sections — separate state upstream. */
  onSetPeak: (poseName: string | undefined) => void;
  /** Opens the Add Pose modal (page-level UI state), optionally inserting after a pose. */
  onOpenAddPose: (sectionId: string, afterPoseId?: string) => void;
  onAddPrep: (poseName: string) => void;
}) {
  const [openPoseId, setOpenPoseId] = useState<string | null>(null);
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const detailMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!detailMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (detailMenuRef.current && !detailMenuRef.current.contains(e.target as Node))
        setDetailMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [detailMenuOpen]);

  const rounds = section.rounds ?? 1;

  const startEditingTitle = () => { setTitleDraft(section.title); setEditingTitle(true); };
  const saveTitle = () => {
    dispatch({ type: "update_title", sectionId: section.id, title: titleDraft.trim() || "Section" });
    setEditingTitle(false);
  };

  const toggleChip = (poseId: string) => {
    setOpenPoseId((prev) => (prev === poseId ? null : poseId));
    setDetailMenuOpen(false);
  };

  const openPose = section.poses.find((p) => p.id === openPoseId) ?? null;

  return (
    <article
      className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
    >
      {/* Row: title + badges + chips + add */}
      <div className="flex items-start gap-x-2 gap-y-1.5">
        {/* Title + badges — top-left anchored */}
        <div className="shrink-0 w-28 flex flex-col gap-0.5 pt-0.5">
          {editingTitle ? (
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              autoFocus
              className="w-full bg-transparent font-display text-sm text-stone-700 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingTitle}
              className="text-left font-display text-sm text-stone-600 hover:text-stone-800 truncate"
            >
              {section.title}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSectionSettingsOpen((v) => !v)}
            className="flex flex-wrap gap-1 rounded-md px-0.5 -mx-0.5 hover:bg-stone-100/80 transition-colors"
            aria-label="Section settings"
          >
            {section.poses.length > 0 ? (
              <>
                <span className={`rounded-full px-1.5 py-0 text-[10px] font-medium ${sectionSettingsOpen ? "bg-stone-200 text-stone-600" : "bg-stone-100 text-stone-500"}`}>
                  ×{rounds}
                </span>
                {section.secondSide && (
                  <span className={`rounded-full px-1.5 py-0 text-[10px] ${sectionSettingsOpen ? "bg-stone-200 text-stone-500" : "bg-stone-100 text-stone-400"}`}>
                    ⇄
                  </span>
                )}
              </>
            ) : (
              <span className={`rounded-full px-1.5 py-0 text-[10px] ${sectionSettingsOpen ? "bg-stone-200 text-stone-500" : "bg-stone-100 text-stone-400"}`}>
                ⋯
              </span>
            )}
          </button>
        </div>

        {/* Chips + add button */}
        <div className="flex flex-1 flex-wrap gap-1 items-center">
          {section.poses.map((pose) => {
            const isPeak = pose.id === peakPoseId;
            const isTheme = Boolean(pose.themePose) && !isPeak;
            const hasCue = Boolean(pose.cue);
            const isOpen = pose.id === openPoseId;
            return (
              <button
                key={pose.id}
                type="button"
                onClick={() => toggleChip(pose.id)}
                className={[
                  "rounded-full px-2.5 py-0.5 text-xs leading-5 transition-all",
                  isPeak
                    ? "bg-amber-50 text-amber-800"
                    : "bg-stone-100 text-stone-700",
                  hasCue
                    ? isPeak
                      ? "border-2 border-amber-300"
                      : isTheme
                        ? "border-2 border-amber-200/70"
                        : "border-2 border-stone-300"
                    : isPeak
                      ? "border border-amber-200"
                      : isTheme
                        ? "border border-amber-200/70"
                        : "border border-stone-200",
                  isOpen ? "ring-1 ring-stone-400 ring-offset-1" : "",
                ].join(" ")}
              >
                {isPeak && <span aria-hidden className="mr-0.5 text-amber-500">★</span>}
                {isTheme && <span aria-hidden className="mr-0.5 text-amber-400/70">★</span>}
                {abbreviatePose(pose.pose)}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onOpenAddPose(section.id)}
            className="rounded-full border border-dashed border-stone-200 px-2 py-0.5 text-xs text-stone-300 leading-5 transition hover:border-stone-300 hover:text-stone-500"
            aria-label="Add pose to section"
          >
            +
          </button>
        </div>
      </div>

      {/* Section settings panel */}
      {sectionSettingsOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatch({ type: "move_section", sectionId: section.id, dir: -1 })}
              disabled={!canMoveUp}
              aria-label="Move section up"
              className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M8 3.5a.75.75 0 0 1 .53.22l4 4a.75.75 0 0 1-1.06 1.06L8 5.31 4.53 8.78a.75.75 0 0 1-1.06-1.06l4-4A.75.75 0 0 1 8 3.5Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "move_section", sectionId: section.id, dir: 1 })}
              disabled={!canMoveDown}
              aria-label="Move section down"
              className="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M8 12.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 0 1 1.06-1.06L8 10.69l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {section.poses.length > 0 && (
            <>
              <div className="mx-1 h-4 w-px bg-stone-200" />
              <span className="text-xs text-stone-400">Rounds</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "set_rounds", sectionId: section.id, rounds: Math.max(1, rounds - 1) })}
                  disabled={rounds <= 1}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-200/60 disabled:pointer-events-none disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm tabular-nums font-medium text-stone-700">
                  ×{rounds}
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "set_rounds", sectionId: section.id, rounds: Math.min(6, rounds + 1) })}
                  disabled={rounds >= 6}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-200/60 disabled:pointer-events-none disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <div className="mx-1 h-4 w-px bg-stone-200" />
              <button
                type="button"
                onClick={() => dispatch({ type: "toggle_second_side", sectionId: section.id })}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  section.secondSide
                    ? "bg-stone-800 text-white"
                    : "border border-stone-200 bg-white text-stone-400 hover:border-stone-300 hover:text-stone-600"
                }`}
              >
                {section.secondSide && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                )}
                Both sides
              </button>
            </>
          )}
          <div className="mx-1 h-4 w-px bg-stone-200" />
          <button
            type="button"
            onClick={() => dispatch({ type: "delete_section", sectionId: section.id })}
            className="text-xs text-rose-400 transition hover:text-rose-600"
          >
            Remove section
          </button>
        </div>
      )}

      {/* Inline detail panel */}
      {openPose && (
        <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-800">{openPose.pose}</p>
              {(() => {
                const m = getPoseMeta(openPose.pose);
                return m?.sanskrit ? (
                  <p className="text-[11px] italic text-stone-400">{m.sanskrit}</p>
                ) : null;
              })()}
              {/* Theme & peak markers — quiet toggles that stay in sync with the header */}
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toggle_theme_pose", poseId: openPose.id })}
                  aria-pressed={Boolean(openPose.themePose)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    openPose.themePose
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-stone-200 bg-white text-stone-400 hover:border-stone-300 hover:text-stone-600"
                  }`}
                >
                  <span aria-hidden>★</span> Theme
                </button>
                <button
                  type="button"
                  onClick={() => onSetPeak(openPose.id === peakPoseId ? undefined : openPose.pose)}
                  aria-pressed={openPose.id === peakPoseId}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    openPose.id === peakPoseId
                      ? "border-amber-400 bg-amber-100 text-amber-800"
                      : "border-stone-200 bg-white text-stone-400 hover:border-stone-300 hover:text-stone-600"
                  }`}
                >
                  <span aria-hidden>★★</span> Peak
                </button>
              </div>
              <div className="mt-1.5">
                <PoseCueField
                  cue={openPose.cue}
                  compact
                  onSave={(cue) => dispatch({ type: "set_cue", poseId: openPose.id, cue })}
                />
                <PoseCueSuggestions
                  pose={openPose.pose}
                  currentCue={openPose.cue}
                  onApply={(text) => dispatch({ type: "set_cue", poseId: openPose.id, cue: text })}
                />
              </div>
              {openPose.id === peakPoseId && peakReadiness && (
                <PeakReadinessNote readiness={peakReadiness} onAddPrep={onAddPrep} />
              )}
            </div>

            {/* Right rail */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <BreathsControl
                breaths={openPose.breaths ?? 5}
                holdMode={openPose.holdMode ?? false}
                onChange={(b) => dispatch({ type: "set_breaths", poseId: openPose.id, breaths: b })}
              />
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "move_pose", sectionId: section.id, poseId: openPose.id, dir: -1 })}
                  disabled={openPose.id === firstPoseId}
                  aria-label={`Move ${openPose.pose} up`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-25"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M8 3.5a.75.75 0 0 1 .53.22l4 4a.75.75 0 0 1-1.06 1.06L8 5.31 4.53 8.78a.75.75 0 0 1-1.06-1.06l4-4A.75.75 0 0 1 8 3.5Z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "move_pose", sectionId: section.id, poseId: openPose.id, dir: 1 })}
                  disabled={openPose.id === lastPoseId}
                  aria-label={`Move ${openPose.pose} down`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-25"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M8 12.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 0 1 1.06-1.06L8 10.69l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z" clipRule="evenodd" />
                  </svg>
                </button>
                <div ref={detailMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDetailMenuOpen((v) => !v)}
                    aria-label={`More actions for ${openPose.pose}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                      <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                    </svg>
                  </button>
                  {detailMenuOpen && (
                    <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => { onOpenAddPose(section.id, openPose.id); setDetailMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0">
                          <circle cx="8" cy="8" r="6" />
                          <path strokeLinecap="round" d="M8 5.5v5M5.5 8h5" />
                        </svg>
                        Add pose below
                      </button>
                      <button
                        type="button"
                        onClick={() => { dispatch({ type: "remove_pose", sectionId: section.id, poseId: openPose.id }); setOpenPoseId(null); setDetailMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                          <path fillRule="evenodd" d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75ZM11 3V1.75A1.75 1.75 0 0 0 9.25 0h-2.5A1.75 1.75 0 0 0 5 1.75V3H2.5a.75.75 0 0 0 0 1.5h.75v8.75A1.75 1.75 0 0 0 5 15h6a1.75 1.75 0 0 0 1.75-1.75V4.5h.75a.75.75 0 0 0 0-1.5H11ZM6.75 6.5a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Zm4 0a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Z" clipRule="evenodd" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
