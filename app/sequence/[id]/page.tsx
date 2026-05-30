"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  generateId,
  loadSequence,
  saveSequence,
  normalizePoseItem,
  formatBreathEstimate,
  roundsMultiplier,
  sortedTaughtEntries,
  sortedUpcomingEntries,
  type PoseItem,
  type Section,
  type TeachEntry,
} from "@/lib/sequences";
import { SECTION_TEMPLATES, sectionFromTemplate } from "@/lib/section-templates";
import {
  poseLibrary,
  allPoses,
  ALL_GROUPS,
  getPoseMeta,
  getBodyRegionClasses,
  getBodyTargetLabel,
  type PoseMeta,
} from "@/lib/poses";
import { searchPoses } from "@/lib/pose-matcher";
import { BulkPoseEntry } from "@/components/bulk-pose-entry";
import {
  computePeakReadiness,
  insertPoseBeforePeak,
  type PeakReadiness,
} from "@/lib/peak-readiness";
import {
  auditSequence,
  findLastPoseIndex,
  hasPose,
  posesAfter,
  type AuditAction,
  type AuditSeverity,
  type SequenceAuditReport,
} from "@/lib/sequence-audit";

// ─── Pose library ───────────────────────────────────────────────────────────

type PoseOption = { pose: string; duration: string; minutes: number };

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number) {
  const whole = Math.floor(minutes);
  const secs = Math.round((minutes - whole) * 60);
  if (secs === 0) return `${whole} min`;
  return `${whole} min ${secs} sec`;
}

/** Format YYYY-MM-DD as "May 28" or "May 28, 2027" (includes year only if not current). */
function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

function isSectionSortableId(id: string | number, sections: Section[]) {
  return sections.some((s) => s.id === id);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PoseCueField({
  cue,
  onSave,
  compact = false,
}: {
  cue?: string;
  onSave: (cue: string) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(cue ?? "");
    setEditing(true);
  };
  const save = () => {
    onSave(draft.trim());
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        placeholder="Teaching cue…"
        autoFocus
        className={`mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none ${
          compact ? "text-xs" : "text-sm"
        }`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (cue) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); startEditing(); }}
        className={`mt-1.5 block text-left italic text-stone-500 hover:text-stone-600 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {cue}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); startEditing(); }}
      className="mt-1.5 text-xs text-stone-400 hover:text-stone-600"
    >
      Add cue
    </button>
  );
}

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

// ─── Energy arc helpers ──────────────────────────────────────────────────────

type EnergyQuality = "heating" | "warming" | "cooling" | "grounding" | "neutral";

function getDominantEnergy(section: Section): EnergyQuality | null {
  const counts: Partial<Record<EnergyQuality, number>> = {};
  for (const pose of section.poses) {
    const meta = getPoseMeta(pose.pose);
    if (meta) counts[meta.energy] = (counts[meta.energy] ?? 0) + 1;
  }
  const entries = Object.entries(counts) as [EnergyQuality, number][];
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

const ENERGY_ARC_CLASSES: Record<EnergyQuality, string> = {
  heating:  "bg-orange-300",
  warming:  "bg-amber-300",
  cooling:  "bg-sky-300",
  grounding:"bg-stone-400",
  neutral:  "bg-stone-300",
};

const ENERGY_ARC_LABELS: Record<EnergyQuality, string> = {
  heating:  "Heating",
  warming:  "Warming",
  cooling:  "Cooling",
  grounding:"Grounding",
  neutral:  "Neutral",
};

function EnergyArc({ sections }: { sections: Section[] }) {
  const blocks = sections
    .map((s) => {
      const minutes = s.poses.reduce((sum, p) => sum + p.minutes, 0) * roundsMultiplier(s);
      const energy = getDominantEnergy(s);
      return { id: s.id, title: s.title, minutes, energy };
    })
    .filter((b) => b.minutes > 0 && b.energy);

  const total = blocks.reduce((sum, b) => sum + b.minutes, 0);
  if (!total || blocks.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 font-display text-sm italic text-stone-400">
        The arc of the class
      </p>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {blocks.map((block) => (
          <div
            key={block.id}
            title={`${block.title} — ${ENERGY_ARC_LABELS[block.energy!]} (${block.minutes} min)`}
            className={`h-full rounded-full transition-all ${ENERGY_ARC_CLASSES[block.energy!]}`}
            style={{ flexGrow: block.minutes / total }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-0.5 overflow-hidden rounded-full">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="overflow-hidden"
            style={{ flexGrow: block.minutes / total }}
          >
            <p className="truncate text-[9px] text-stone-400">{block.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Peak readiness (shown on the peak pose card) ─────────────────────────────

/**
 * Calm, in-context readiness shown on the peak pose's own card: an affirmation
 * when the body is warmed, or a gentle note of what's still waking up with prep
 * ideas tucked behind a tap. Replaces the old standalone top panel.
 */
function PeakReadinessNote({
  readiness,
  onAddPrep,
}: {
  readiness: PeakReadiness;
  onAddPrep: (poseName: string) => void;
}) {
  const { unwarmed, suggestionsByArea } = readiness;
  const [showPrep, setShowPrep] = useState(false);

  if (unwarmed.length === 0) {
    return (
      <p className="mt-2.5 font-display text-sm italic text-stone-500">
        The body is ready for this.
      </p>
    );
  }

  return (
    <div className="mt-2.5">
      <p className="text-xs text-stone-500">
        Still waking up:{" "}
        <span className="text-stone-700">
          {unwarmed.map((a) => getBodyTargetLabel(a)).join(", ")}
        </span>
      </p>
      <button
        type="button"
        onClick={() => setShowPrep((v) => !v)}
        className="mt-1 text-[11px] text-stone-400 transition hover:text-stone-600"
      >
        {showPrep ? "Hide prep ideas" : "Prep ideas →"}
      </button>

      {showPrep && (
        <div className="mt-2 space-y-2.5 border-t border-amber-200/40 pt-2.5">
          {suggestionsByArea.map(({ area, poses }) => (
            <div key={area}>
              <p className="mb-1 text-[11px] text-stone-400">
                Warm {getBodyTargetLabel(area)}
              </p>
              {poses.length === 0 ? (
                <p className="text-xs italic text-stone-400">No prep pose in the library</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {poses.map((pose) => (
                    <button
                      key={pose}
                      type="button"
                      onClick={() => onAddPrep(pose)}
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/70 px-2.5 py-1 text-[11px] text-stone-600 transition hover:border-stone-300 hover:bg-white hover:text-stone-800"
                    >
                      <span aria-hidden className="text-stone-400">+</span>
                      {pose}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sequence audit panel ────────────────────────────────────────────────────

const AUDIT_SEVERITY_STYLES: Record<AuditSeverity, {
  dot: string;
  label: string;
  panel: string;
  text: string;
}> = {
  critical: {
    dot: "bg-rose-400/70",
    label: "worth a look",
    panel: "border-rose-200/50 bg-rose-50/40",
    text: "text-rose-700/80",
  },
  warning: {
    dot: "bg-amber-400/70",
    label: "consider",
    panel: "border-amber-200/50 bg-amber-50/40",
    text: "text-amber-700/80",
  },
  note: {
    dot: "bg-stone-400/70",
    label: "note",
    panel: "border-stone-200/70 bg-stone-50/60",
    text: "text-stone-500",
  },
  good: {
    dot: "bg-emerald-400/60",
    label: "nice",
    panel: "border-emerald-200/50 bg-emerald-50/40",
    text: "text-emerald-700/80",
  },
};

function SequenceAuditPanel({
  report,
  onAction,
}: {
  report: SequenceAuditReport;
  onAction: (action: AuditAction) => void;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-stone-200 bg-white/80 p-4 ring-1 ring-stone-200/60">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="font-display text-lg text-stone-700">Reading the flow</p>
        <p className="text-xs text-stone-400">
          {report.summary}
          <span className="ml-2 tabular-nums text-stone-300">{report.score}/100</span>
        </p>
      </div>

      <p className="mb-3 text-xs text-stone-400">
        {formatMinutes(report.totalMinutes)} total
        <span className="text-stone-300"> · </span>
        {formatMinutes(report.standingMinutes)} standing
        <span className="text-stone-300"> · </span>
        {formatMinutes(report.windDownMinutes)} wind-down
      </p>

      <div className="space-y-2">
        {report.issues.map((issue) => {
          const styles = AUDIT_SEVERITY_STYLES[issue.severity];
          return (
            <article
              key={issue.id}
              className={`rounded-xl border px-3.5 py-3 ${styles.panel}`}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-stone-800">{issue.title}</p>
                    <span className={`text-[11px] italic ${styles.text}`}>
                      {styles.label} · {issue.category.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">{issue.detail}</p>
                </div>
                {issue.action && (
                  <button
                    type="button"
                    onClick={() => onAction(issue.action!)}
                    className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
                  >
                    {issue.action.label}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SectionPoseRow({
  pose,
  missingPrereqs,
  isPeak,
  peakReadiness,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  onAddPoseBelow,
  onUpdateCue,
  onUpdateBreaths,
  onAddPrep,
}: {
  pose: PoseItem;
  missingPrereqs: string[];
  isPeak: boolean;
  peakReadiness: PeakReadiness | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddPoseBelow: () => void;
  onUpdateCue: (poseId: string, cue: string) => void;
  onUpdateBreaths: (poseId: string, breaths: number) => void;
  onAddPrep: (poseName: string) => void;
}) {
  const [showWarning, setShowWarning] = useState(false);
  const [showMods, setShowMods] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const meta = getPoseMeta(pose.pose);
  const regionClasses = meta?.bodyRegion ? getBodyRegionClasses(meta.bodyRegion) : null;
  const bodyChips = meta?.bodyTargets.slice(0, 3) ?? [];
  const hasMods = (meta?.modifications?.length ?? 0) > 0;

  return (
    <div
      className={
        isPeak
          ? "rounded-xl border border-amber-300/60 bg-amber-50/50 px-4 py-3 shadow-[0_1px_4px_rgba(180,140,80,0.12)] ring-1 ring-amber-200/60"
          : `rounded-xl border border-stone-200 px-4 py-3 ${
              regionClasses ? regionClasses.gradient : "bg-white"
            }`
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              {isPeak && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <span aria-hidden>△</span> Peak
                </span>
              )}
              <p className="text-sm text-stone-800">{pose.pose}</p>
              {meta?.sanskrit && (
                <span className="truncate text-[11px] italic text-stone-400">{meta.sanskrit}</span>
              )}
            </div>
            {missingPrereqs.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowWarning((v) => !v); }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100/70 text-amber-500 transition hover:bg-amber-100"
                  aria-label="Prerequisite warning"
                >
                  <span className="text-[11px] font-bold leading-none">!</span>
                </button>
                {showWarning && (
                  <div className="absolute left-0 top-7 z-10 w-52 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-md">
                    <p className="mb-1 text-[11px] font-medium text-amber-700">
                      Not yet warmed up
                    </p>
                    <p className="text-xs text-amber-800">
                      {missingPrereqs.map((t) => getBodyTargetLabel(t as Parameters<typeof getBodyTargetLabel>[0])).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          {bodyChips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {bodyChips.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-stone-200/70 px-2 py-0.5 text-[10px] text-stone-500"
                >
                  {getBodyTargetLabel(t)}
                </span>
              ))}
            </div>
          )}
          <div>
            <PoseCueField cue={pose.cue} compact onSave={(cue) => onUpdateCue(pose.id, cue)} />
            {hasMods && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowMods((v) => !v); }}
                  className="text-[10px] text-stone-400 hover:text-stone-600"
                >
                  {showMods ? "▾ modifications" : "▸ modifications"}
                </button>
                {showMods && (
                  <ul className="mt-1 space-y-0.5">
                    {meta!.modifications!.map((mod) => (
                      <li key={mod} className="text-[11px] italic text-stone-500">· {mod}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {isPeak && peakReadiness && (
              <PeakReadinessNote readiness={peakReadiness} onAddPrep={onAddPrep} />
            )}
          </div>
        </div>

        {/* Right rail: breaths control + move/remove controls */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <BreathsControl
            breaths={pose.breaths ?? 5}
            holdMode={pose.holdMode ?? false}
            onChange={(b) => onUpdateBreaths(pose.id, b)}
          />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={!canMoveUp}
              aria-label={`Move ${pose.pose} up`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M8 3.5a.75.75 0 0 1 .53.22l4 4a.75.75 0 0 1-1.06 1.06L8 5.31 4.53 8.78a.75.75 0 0 1-1.06-1.06l4-4A.75.75 0 0 1 8 3.5Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={!canMoveDown}
              aria-label={`Move ${pose.pose} down`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M8 12.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 0 1 1.06-1.06L8 10.69l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z" clipRule="evenodd" />
              </svg>
            </button>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={`More actions for ${pose.pose}`}
                aria-expanded={menuOpen}
                className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => { onAddPoseBelow(); setMenuOpen(false); }}
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
                    onClick={() => { onRemove(); setMenuOpen(false); }}
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
  );
}

function SortableSectionBlock({
  section,
  isCollapsed,
  missingPrereqsMap,
  peakPoseId,
  peakReadiness,
  firstPoseId,
  lastPoseId,
  onToggleCollapse,
  onUpdateTitle,
  onToggleSecondSide,
  onUpdateRounds,
  onUpdateCue,
  onUpdateBreaths,
  onAddPose,
  onAddPoseBelow,
  onApplyTemplate,
  onAddPrep,
  onMovePose,
  onRemovePose,
}: {
  section: Section;
  isCollapsed: boolean;
  missingPrereqsMap: Map<string, string[]>;
  peakPoseId: string | null;
  peakReadiness: PeakReadiness | null;
  firstPoseId: string | null;
  lastPoseId: string | null;
  onToggleCollapse: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onToggleSecondSide: (id: string) => void;
  onUpdateRounds: (id: string, rounds: number) => void;
  onUpdateCue: (poseId: string, cue: string) => void;
  onUpdateBreaths: (poseId: string, breaths: number) => void;
  onAddPose: (id: string) => void;
  onAddPoseBelow: (sectionId: string, afterPoseId: string) => void;
  onApplyTemplate: (sectionId: string, templateId: string) => void;
  onAddPrep: (poseName: string) => void;
  onMovePose: (sectionId: string, poseId: string, dir: -1 | 1) => void;
  onRemovePose: (sectionId: string, poseId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const startEditingTitle = () => { setTitleDraft(section.title); setEditingTitle(true); };
  const saveTitle = () => { onUpdateTitle(section.id, titleDraft.trim() || "Section"); setEditingTitle(false); };

  const style = { transform: CSS.Transform.toString(transform), transition };
  const sectionPoseMinutes = section.poses.reduce((sum, p) => sum + p.minutes, 0);
  const totalSectionMinutes = sectionPoseMinutes * roundsMultiplier(section);
  const rounds = section.rounds ?? 1;
  const isCompact = section.poses.length === 1;

  // Phase 3: section-level energy + body target aggregates
  const sectionMetas = section.poses.map((p) => getPoseMeta(p.pose)).filter(Boolean);
  const aggregateTargets = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const meta of sectionMetas) {
      for (const t of meta!.bodyTargets) {
        if (!seen.has(t)) { seen.add(t); result.push(t); }
      }
    }
    return result.slice(0, 5);
  })();
  const dominantEnergy = (() => {
    const counts: Record<string, number> = {};
    for (const meta of sectionMetas) counts[meta!.energy] = (counts[meta!.energy] ?? 0) + 1;
    const entries = Object.entries(counts);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  })();
  const energyStyles: Record<string, string> = {
    heating:  "bg-orange-100/60 text-orange-700/80",
    warming:  "bg-amber-100/60 text-amber-700/80",
    cooling:  "bg-sky-100/60 text-sky-700/80",
    grounding:"bg-stone-200/70 text-stone-600",
    neutral:  "bg-stone-100 text-stone-500",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`shadow-[0_1px_1px_rgba(0,0,0,0.03)] ${
        isCompact
          ? "rounded-2xl border border-stone-200 bg-white/80 p-4"
          : "rounded-2xl border border-stone-300/50 bg-[#e8e3da]/70 p-4 ring-1 ring-stone-200/60"
      }`}
    >
      <div
        className={
          isCompact
            ? "mb-3"
            : "mb-3 rounded-xl border border-dashed border-stone-300 bg-stone-200/40 px-3 py-2"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleCollapse(section.id)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-stone-200/60 hover:text-stone-700"
              aria-label={isCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="touch-none select-none cursor-grab text-stone-400 active:cursor-grabbing"
              aria-label={`Drag section ${section.title}`}
            >
              :::
            </button>
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
                className="min-w-0 flex-1 bg-transparent font-display text-base text-stone-700 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingTitle}
                className="truncate text-left font-display text-base text-stone-600 hover:text-stone-800"
              >
                {section.title}
              </button>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            {section.poses.length > 0 && (
              <p className="text-xs text-stone-500">
                {rounds > 1 && <span className="mr-1 font-medium text-stone-600">×{rounds}</span>}
                {formatMinutes(totalSectionMinutes)}
              </p>
            )}
            {isCollapsed && section.poses.length > 0 && (
              <p className="text-xs text-stone-400">
                {section.poses.length} pose{section.poses.length === 1 ? "" : "s"}
                {section.secondSide ? " · both sides" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Phase 3: energy badge + aggregate body targets */}
        {section.poses.length > 0 && (dominantEnergy || aggregateTargets.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {dominantEnergy && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${energyStyles[dominantEnergy] ?? energyStyles.neutral}`}>
                {dominantEnergy}
              </span>
            )}
            {aggregateTargets.map((t) => (
              <span key={t} className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] text-stone-500">
                {getBodyTargetLabel(t as Parameters<typeof getBodyTargetLabel>[0])}
              </span>
            ))}
          </div>
        )}
      </div>

      {isCollapsed ? null : (
        <>
          {section.poses.length > 0 ? (
            <div className="space-y-2">
              {section.poses.map((pose) => (
                <SectionPoseRow
                  key={pose.id}
                  pose={pose}
                  missingPrereqs={missingPrereqsMap.get(pose.id) ?? []}
                  isPeak={pose.id === peakPoseId}
                  peakReadiness={peakReadiness}
                  canMoveUp={pose.id !== firstPoseId}
                  canMoveDown={pose.id !== lastPoseId}
                  onMove={(dir) => onMovePose(section.id, pose.id, dir)}
                  onRemove={() => onRemovePose(section.id, pose.id)}
                  onAddPoseBelow={() => onAddPoseBelow(section.id, pose.id)}
                  onUpdateCue={onUpdateCue}
                  onUpdateBreaths={onUpdateBreaths}
                  onAddPrep={onAddPrep}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-stone-200 px-3 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/70 px-3 py-1.5 text-xs text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
                >
                  Start from template
                  <span aria-hidden>{showTemplatePicker ? "▴" : "▾"}</span>
                </button>
                <span className="text-[11px] text-stone-300">or</span>
                <button
                  type="button"
                  onClick={() => onAddPose(section.id)}
                  className="flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-xs text-stone-400 transition hover:text-stone-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0">
                    <circle cx="8" cy="8" r="6" />
                    <path strokeLinecap="round" d="M8 5.5v5M5.5 8h5" />
                  </svg>
                  Add pose
                </button>
              </div>
              {showTemplatePicker && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SECTION_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => { onApplyTemplate(section.id, template.id); setShowTemplatePicker(false); }}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-200/80 pt-3">
            <button
              type="button"
              onClick={() => onAddPose(section.id)}
              className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-stone-400 transition-colors hover:bg-[#e8e3da]/70 hover:text-stone-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
                <circle cx="10" cy="10" r="7.5" />
                <path strokeLinecap="round" d="M10 7v6M7 10h6" />
              </svg>
              Add pose
            </button>
            {section.poses.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateRounds(section.id, Math.max(1, rounds - 1))}
                    disabled={rounds <= 1}
                    aria-label="Decrease rounds"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className={`min-w-[2rem] text-center text-xs tabular-nums ${rounds > 1 ? "font-medium text-stone-700" : "text-stone-300"}`}>
                    ×{rounds}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateRounds(section.id, Math.min(6, rounds + 1))}
                    disabled={rounds >= 6}
                    aria-label="Increase rounds"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSecondSide(section.id)}
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
                  Repeat on other side
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}

// All unique body targets + energy qualities across the library, for filter chips
const ALL_BODY_TARGETS = (() => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of poseLibrary) {
    for (const pose of cat.poses) {
      for (const t of pose.bodyTargets) {
        if (!seen.has(t)) { seen.add(t); result.push(t); }
      }
    }
  }
  return result;
})();

const ALL_ENERGIES: EnergyQuality[] = ["grounding", "warming", "heating", "cooling", "neutral"];

const ENERGY_FILTER_CLASSES: Record<EnergyQuality, { active: string; inactive: string }> = {
  grounding: { active: "bg-slate-500 text-white",   inactive: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
  warming:   { active: "bg-amber-400 text-white",   inactive: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
  heating:   { active: "bg-orange-500 text-white",  inactive: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
  cooling:   { active: "bg-sky-400 text-white",     inactive: "bg-sky-50 text-sky-700 hover:bg-sky-100" },
  neutral:   { active: "bg-stone-500 text-white",   inactive: "bg-stone-100 text-stone-600 hover:bg-stone-200" },
};

function AddPoseModal({
  targetSection,
  onAdd,
  onAddMany,
  onClose,
}: {
  targetSection: Section;
  onAdd: (sectionId: string, option: PoseOption) => void;
  onAddMany: (sectionId: string, poses: PoseMeta[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"search" | "paste">("search");
  const [search, setSearch] = useState("");
  const [activeBodyTargets, setActiveBodyTargets] = useState<Set<string>>(new Set());
  const [activeEnergies, setActiveEnergies] = useState<Set<string>>(new Set());
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());

  const toggleIn = (setter: typeof setActiveBodyTargets) => (value: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleBodyTarget = toggleIn(setActiveBodyTargets);
  const toggleEnergy = toggleIn(setActiveEnergies);
  const toggleGroup = toggleIn(setActiveGroups);

  const query = search.trim().toLowerCase();

  // Relevance-ranked when searching (exact > prefix > substring > fuzzy), library
  // order otherwise. Body-part text matches are appended after the name matches.
  const base: PoseMeta[] = (() => {
    if (!query) return allPoses;
    const ranked = searchPoses(search.trim());
    const inRanked = new Set(ranked.map((p) => p.pose));
    const byBodyPart = allPoses.filter(
      (p) =>
        !inRanked.has(p.pose) &&
        p.bodyTargets.some((t) => getBodyTargetLabel(t).toLowerCase().includes(query))
    );
    return [...ranked, ...byBodyPart];
  })();

  const visiblePoses = base.filter((meta) => {
    if (activeEnergies.size > 0 && !activeEnergies.has(meta.energy)) return false;
    if (activeBodyTargets.size > 0 && !meta.bodyTargets.some((t) => activeBodyTargets.has(t))) return false;
    if (activeGroups.size > 0 && !(meta.groups ?? []).some((g) => activeGroups.has(g))) return false;
    return true;
  });

  const hasActiveFilters = activeBodyTargets.size > 0 || activeEnergies.size > 0 || activeGroups.size > 0;

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
            placeholder="Search by pose or body part…"
            autoFocus
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
          />
        </div>

        {/* Energy filter */}
        <div className="px-5 pb-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Energy</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ENERGIES.map((e) => {
              const active = activeEnergies.has(e);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEnergy(e)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active ? ENERGY_FILTER_CLASSES[e].active : ENERGY_FILTER_CLASSES[e].inactive
                  }`}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body target filter — horizontal scroll */}
        <div className="px-5 pb-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Body part</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {ALL_BODY_TARGETS.map((t) => {
              const active = activeBodyTargets.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleBodyTarget(t)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? "bg-stone-800 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {getBodyTargetLabel(t as Parameters<typeof getBodyTargetLabel>[0])}
                </button>
              );
            })}
          </div>
        </div>

        {/* Group / family filter — horizontal scroll */}
        <div className="px-5 pb-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Group</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {ALL_GROUPS.map((g) => {
              const active = activeGroups.has(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGroup(g)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? "bg-stone-800 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <div className="px-5 pb-2">
            <button
              type="button"
              onClick={() => { setActiveBodyTargets(new Set()); setActiveEnergies(new Set()); setActiveGroups(new Set()); }}
              className="text-[11px] text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Pose list — flat, ranked best-match-first when searching */}
        <div className="overflow-y-auto px-5 pb-5">
          {visiblePoses.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">No poses found</p>
          ) : (
            <div className="space-y-1.5">
              {visiblePoses.map((meta) => {
                const regionClasses = getBodyRegionClasses(meta.bodyRegion);
                const chips = meta.bodyTargets.slice(0, 3);
                return (
                  <button
                    key={meta.pose}
                    type="button"
                    onClick={() => onAdd(targetSection.id, { pose: meta.pose, duration: meta.duration, minutes: meta.minutes })}
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
                    {chips.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {chips.map((t) => (
                          <span
                            key={t}
                            className={`rounded-full px-2 py-0.5 text-[10px] transition ${
                              activeBodyTargets.has(t)
                                ? "bg-stone-800 text-white"
                                : "bg-white/60 text-stone-500"
                            }`}
                          >
                            {getBodyTargetLabel(t)}
                          </span>
                        ))}
                      </div>
                    )}
                    {meta.modifications?.length ? (
                      <p className="mt-1 text-[10px] italic text-stone-400">
                        {meta.modifications[0]}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

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
            : "border-stone-200 bg-white text-stone-400 hover:border-stone-300"
        }`}
      >
        <span>{value ?? "Select peak pose…"}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-stone-400">
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
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

// ─── Teaching Log ─────────────────────────────────────────────────────────────

function NoteEditor({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft)}
      placeholder="How did it go? What would you change?"
      rows={3}
      className="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
    />
  );
}

function TeachingLog({
  dates,
  onChange,
}: {
  dates: TeachEntry[];
  onChange: (dates: TeachEntry[]) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const past = sortedTaughtEntries(dates);
  const upcoming = sortedUpcomingEntries(dates);
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryDate, setEntryDate] = useState(today);
  const [entryNotes, setEntryNotes] = useState("");
  // Set true onMouseDown on Cancel so the form-level onBlur skips saving.
  // mousedown fires before blur, so the ref is readable when blur runs.
  const cancelingRef = useRef(false);

  const openForm = () => {
    setEntryDate(today);
    setEntryNotes("");
    cancelingRef.current = false;
    setAddingEntry(true);
  };

  const saveEntry = () => {
    if (entryDate && !dates.some((e) => e.date === entryDate)) {
      onChange([...dates, { date: entryDate, notes: entryNotes.trim() || undefined }]);
    }
    setAddingEntry(false);
  };

  const handleFormBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node) && !cancelingRef.current) {
      saveEntry();
    }
    cancelingRef.current = false;
  };

  const removeDate = (date: string) => {
    onChange(dates.filter((e) => e.date !== date));
  };

  const updateNotes = (date: string, notes: string) => {
    onChange(dates.map((e) => (e.date === date ? { ...e, notes: notes.trim() || undefined } : e)));
  };

  const renderEntry = (entry: TeachEntry) => (
    <div key={entry.date} className="rounded-xl border border-stone-200/60 bg-white/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-700">{formatDateShort(entry.date)}</span>
        <button
          type="button"
          onClick={() => removeDate(entry.date)}
          className="text-xs text-stone-400 transition hover:text-red-400"
        >
          Remove
        </button>
      </div>
      <NoteEditor
        key={entry.date}
        initialValue={entry.notes ?? ""}
        onSave={(val) => updateNotes(entry.date, val)}
      />
    </div>
  );

  return (
    <section className="mt-8">
      {/* Header */}
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="font-display text-lg font-light tracking-tight text-stone-800">
          Teaching Log
        </span>
        {!addingEntry && (
          <button
            type="button"
            onClick={openForm}
            className="rounded-lg border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-white hover:text-stone-800"
          >
            + Log a class
          </button>
        )}
      </div>

      {/* Log entry form */}
      <div className={addingEntry ? "mb-4" : ""}>
        {addingEntry ? (
          <div
            className="rounded-xl border border-stone-200 bg-white/80 px-4 py-3"
            onBlur={handleFormBlur}
          >
            <input
              type="date"
              value={entryDate}
              autoFocus
              onChange={(e) => setEntryDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { cancelingRef.current = true; setAddingEntry(false); }
              }}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-stone-400 focus:outline-none"
            />
            <textarea
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { cancelingRef.current = true; setAddingEntry(false); }
              }}
              placeholder="How did it go? What would you change?"
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
            />
            <div className="mt-2">
              <button
                type="button"
                onMouseDown={() => { cancelingRef.current = true; }}
                onClick={() => setAddingEntry(false)}
                className="text-xs text-stone-400 transition hover:text-stone-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Entries — always visible */}
      <div className="space-y-4">
        {upcoming.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Upcoming
            </p>
            <div className="space-y-2">{upcoming.map(renderEntry)}</div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Past
            </p>
            <div className="space-y-2">{past.map(renderEntry)}</div>
          </div>
        )}

        {dates.length === 0 && !addingEntry && (
          <p className="text-sm text-stone-400">No entries yet.</p>
        )}
      </div>
    </section>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === "new";

  // Sequence metadata
  const [sequenceId] = useState(() => (isNew ? generateId() : id));
  const [name, setName] = useState(isNew ? "" : "Loading…");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [theme, setTheme] = useState("");
  const [peakPose, setPeakPose] = useState<string | undefined>(undefined);
  const [dates, setDates] = useState<TeachEntry[]>([]);
  const [createdAt, setCreatedAt] = useState("");
  const [loaded, setLoaded] = useState(isNew);

  // Builder state
  const [sections, setSections] = useState<Section[]>([]);
  const [addPoseTarget, setAddPoseTarget] = useState<{ sectionId: string; insertAfterPoseId?: string } | null>(null);
  const [draggingSectionTitle, setDraggingSectionTitle] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);

  // Mouse: tiny movement starts a drag immediately. Touch: a short hold engages the
  // drag so a quick flick still scrolls the page — combined with `touch-none` on the
  // handles, this stops the page from panning while you reorder on mobile.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  /** Always keep a trailing empty section so there's always one ready to use. */
  const ensureTrailingEmpty = (secs: Section[]): Section[] => {
    const last = secs[secs.length - 1];
    if (!last || last.poses.length > 0) {
      return [...secs, { id: generateId(), title: "New section", secondSide: false, poses: [] }];
    }
    return secs;
  };

  /** Wrapper around setSections that maintains the trailing-empty invariant. */
  const updateSections = (updater: Section[] | ((prev: Section[]) => Section[])) => {
    setSections((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return ensureTrailingEmpty(next);
    });
  };

  useEffect(() => {
    // Hydrates client-only sequence state from browser storage.
    if (isNew) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreatedAt(new Date().toISOString());
      setSections(ensureTrailingEmpty([]));
      return;
    }
    const record = loadSequence(id);
    if (record) {
      setName(record.name);
      setTheme(record.theme ?? "");
      setPeakPose(record.peakPose);
      setDates(record.dates ?? []);
      setCreatedAt(record.createdAt);
      setSections(ensureTrailingEmpty(record.sections));
    } else {
      setName("Sequence not found");
      setCreatedAt(new Date().toISOString());
      setSections(ensureTrailingEmpty([]));
    }
    setLoaded(true);
  }, [id, isNew]);

  // Autosave: debounced 800ms on any meaningful change
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      saveSequence({
        id: sequenceId,
        name: name.trim() || "Untitled sequence",
        theme: theme.trim() || undefined,
        peakPose: peakPose || undefined,
        dates,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [sections, name, theme, peakPose, dates, loaded, sequenceId, createdAt]);


  // ── Section/pose handlers ────────────────────────────────────────────────

  const isDraggingSection = draggingSectionTitle !== null;
  const isSectionCollapsed = (sectionId: string) =>
    isDraggingSection || collapsedSectionIds.includes(sectionId);

  const expandSection = (sectionId: string) => {
    setCollapsedSectionIds((prev) => prev.filter((id) => id !== sectionId));
  };

  const toggleSectionCollapse = (sectionId: string) => {
    if (isDraggingSection) return;
    setCollapsedSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isSectionSortableId(event.active.id, sections)) {
      setDraggingSectionTitle(sections.find((s) => s.id === event.active.id)?.title ?? "Section");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingSectionTitle(null);
    if (!over || active.id === over.id) return;
    if (isSectionSortableId(active.id, sections) && isSectionSortableId(over.id, sections)) {
      updateSections((current) => {
        const oldIndex = current.findIndex((s) => s.id === active.id);
        const newIndex = current.findIndex((s) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return current;
        return arrayMove(current, oldIndex, newIndex);
      });
    }
  };

  const handleDragCancel = () => {
    setDraggingSectionTitle(null);
  };

  /** Nudge a pose one slot up/down, hopping into the adjacent non-empty section at the ends. */
  const movePose = (sectionId: string, poseId: string, dir: -1 | 1) => {
    const si = sections.findIndex((s) => s.id === sectionId);
    if (si === -1) return;
    const pi = sections[si].poses.findIndex((p) => p.id === poseId);
    if (pi === -1) return;

    const next = sections.map((s) => ({ ...s, poses: [...s.poses] }));
    const src = next[si];
    let crossedTo: string | null = null;

    if (dir === -1) {
      if (pi > 0) {
        [src.poses[pi - 1], src.poses[pi]] = [src.poses[pi], src.poses[pi - 1]];
      } else {
        let ti = -1;
        for (let k = si - 1; k >= 0; k--) if (next[k].poses.length > 0) { ti = k; break; }
        if (ti === -1) return;
        const [moved] = src.poses.splice(pi, 1);
        next[ti].poses.push(moved);
        crossedTo = next[ti].id;
      }
    } else {
      if (pi < src.poses.length - 1) {
        [src.poses[pi + 1], src.poses[pi]] = [src.poses[pi], src.poses[pi + 1]];
      } else {
        let ti = -1;
        for (let k = si + 1; k < next.length; k++) if (next[k].poses.length > 0) { ti = k; break; }
        if (ti === -1) return;
        const [moved] = src.poses.splice(pi, 1);
        next[ti].poses.unshift(moved);
        crossedTo = next[ti].id;
      }
    }

    updateSections(next);
    if (crossedTo) { expandSection(crossedTo); expandSection(sectionId); }
  };

  const removePose = (sectionId: string, poseId: string) => {
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, poses: s.poses.filter((p) => p.id !== poseId) } : s)),
    );
  };

  const handleAddPose = (sectionId: string, option: PoseOption, insertAfterPoseId?: string) => {
    const newPose = normalizePoseItem({ id: generateId(), pose: option.pose, duration: "", minutes: 0 });
    updateSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        if (insertAfterPoseId) {
          const idx = s.poses.findIndex((p) => p.id === insertAfterPoseId);
          const next = [...s.poses];
          next.splice(idx + 1, 0, newPose);
          return { ...s, poses: next };
        }
        return { ...s, poses: [...s.poses, newPose] };
      }),
    );
    setAddPoseTarget(null);
  };

  const handleAddPoses = (sectionId: string, poses: PoseMeta[]) => {
    const newPoses = poses.map((p) => normalizePoseItem({ id: generateId(), pose: p.pose, duration: "", minutes: 0 }));
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, poses: [...s.poses, ...newPoses] } : s)),
    );
    setAddPoseTarget(null);
  };

  const updatePoseBreaths = (poseId: string, breaths: number) => {
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        poses: s.poses.map((p) =>
          p.id === poseId ? normalizePoseItem({ ...p, breaths }) : p
        ),
      })),
    );
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    updateSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));
  };

  const toggleSecondSide = (sectionId: string) => {
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, secondSide: !s.secondSide } : s)),
    );
  };

  const updateSectionRounds = (sectionId: string, rounds: number) => {
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, rounds: rounds > 1 ? rounds : undefined } : s)),
    );
  };

  const applyTemplate = (sectionId: string, templateId: string) => {
    const template = SECTION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const newSection = sectionFromTemplate(template);
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...newSection, id: s.id } : s)),
    );
  };

  const updatePoseCue = (poseId: string, cue: string) => {
    const nextCue = cue || undefined;
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        poses: s.poses.map((p) => (p.id === poseId ? { ...p, cue: nextCue } : p)),
      })),
    );
  };

  // Phase 5: compute missing prerequisites per pose
  const missingPrereqsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const warmedSoFar = new Set<string>();
    for (const section of sections) {
      for (const pose of section.poses) {
        const meta = getPoseMeta(pose.pose);
        if (meta?.prerequisites?.length) {
          const missing = meta.prerequisites.filter((p) => !warmedSoFar.has(p));
          if (missing.length) map.set(pose.id, missing);
        }
        // accumulate this pose's targets for subsequent poses
        meta?.bodyTargets.forEach((t) => warmedSoFar.add(t));
      }
    }
    return map;
  }, [sections]);

  // Peak readiness: does the arc warm up what the peak depends on?
  const peakReadiness = useMemo(
    () => (peakPose ? computePeakReadiness(sections, peakPose) : null),
    [sections, peakPose],
  );

  // The id of the first placed instance of the peak pose, so its card can carry
  // the highlight + readiness note. Null when no peak is set or it isn't placed yet.
  const peakPoseId = useMemo(() => {
    if (!peakPose) return null;
    for (const section of sections) {
      const match = section.poses.find((p) => p.pose === peakPose);
      if (match) return match.id;
    }
    return null;
  }, [sections, peakPose]);

  // First/last pose ids across the whole sequence — used to disable ▲ / ▼ at the ends.
  const { firstPoseId, lastPoseId } = useMemo(() => {
    let first: string | null = null;
    let last: string | null = null;
    for (const section of sections) {
      for (const pose of section.poses) {
        if (first === null) first = pose.id;
        last = pose.id;
      }
    }
    return { firstPoseId: first, lastPoseId: last };
  }, [sections]);

  const handleAddPrep = (poseName: string) => {
    updateSections((prev) => insertPoseBeforePeak(prev, poseName, peakPose));
  };

  const makePoseItem = (poseName: string): PoseItem =>
    normalizePoseItem({ id: generateId(), pose: poseName, duration: "", minutes: 0 });

  const handleAuditAction = (action: AuditAction) => {
    if (action.kind === "mark_both_sides") {
      updateSections((prev) =>
        prev.map((section) =>
          section.id === action.sectionId ? { ...section, secondSide: true } : section,
        ),
      );
      return;
    }

    if (action.kind === "add_savasana") {
      updateSections((prev) => {
        if (hasPose(prev, "Savasana")) {
          return prev;
        }
        const closeIndex = prev.findIndex((section) =>
          /close|savasana/i.test(section.title),
        );
        const newPose = makePoseItem("Savasana");
        if (closeIndex !== -1) {
          return prev.map((section, index) =>
            index === closeIndex
              ? { ...section, poses: [...section.poses, newPose] }
              : section,
          );
        }
        const trailingEmptyIndex = prev.findIndex((section, index) =>
          index === prev.length - 1 && section.poses.length === 0,
        );
        const insertIndex = trailingEmptyIndex === -1 ? prev.length : trailingEmptyIndex;
        const savasanaSection: Section = {
          id: generateId(),
          title: "Savasana",
          secondSide: false,
          poses: [newPose],
        };
        return [
          ...prev.slice(0, insertIndex),
          savasanaSection,
          ...prev.slice(insertIndex),
        ];
      });
      return;
    }

    if (action.kind === "add_constructive_rest") {
      updateSections((prev) => {
        const lastWheel = findLastPoseIndex(prev, "Wheel");
        if (!lastWheel) return prev;
        if (posesAfter(prev, lastWheel).includes("Constructive Rest")) return prev;

        const newPose = makePoseItem("Constructive Rest");
        return prev.map((section, sectionIndex) => {
          if (sectionIndex !== lastWheel.sectionIndex) return section;
          const nextPoses = [...section.poses];
          nextPoses.splice(lastWheel.poseIndex + 1, 0, newPose);
          return { ...section, poses: nextPoses };
        });
      });
    }
  };

  const sectionIds = sections.map((s) => s.id);
  const addPoseTargetSection = sections.find((s) => s.id === addPoseTarget?.sectionId);

  const hasPoses = sections.some((s) => s.poses.length > 0);
  const totalMinutes = sections.reduce(
    (sum, s) => sum + s.poses.reduce((acc, p) => acc + p.minutes, 0) * roundsMultiplier(s),
    0,
  );

  const auditReport = useMemo(
    () => auditSequence({ sections, theme, peakPose }),
    [sections, theme, peakPose],
  );

  // ── Name editing ─────────────────────────────────────────────────────────

  const startEditingName = () => { setNameDraft(name); setEditingName(true); };
  const saveName = () => { setName(nameDraft.trim() || "Untitled sequence"); setEditingName(false); };

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl rounded-3xl bg-white/70 p-8 shadow-sm backdrop-blur-sm ring-1 ring-stone-300/30 sm:p-10">

        {/* Back nav */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            Library
          </Link>
          {hasPoses ? (
            <Link
              href={`/sequence/${sequenceId}/teach`}
              className="rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Teach
            </Link>
          ) : (
            <span
              className="cursor-not-allowed rounded-full border border-stone-200 px-4 py-1.5 text-sm font-medium text-stone-300"
              title="Add a pose to teach this sequence"
            >
              Teach
            </span>
          )}
        </div>

        {/* Sequence metadata header */}
        <header className="mb-8">
          {/* Name */}
          <div className="mb-3">
            {editingName ? (
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                placeholder="Sequence name…"
                className="w-full bg-transparent font-display text-3xl font-light tracking-tight text-stone-900 placeholder:text-stone-300 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingName}
                className={`text-left font-display text-3xl font-light tracking-tight transition hover:text-stone-600 ${
                  name ? "text-stone-900" : "text-stone-300"
                }`}
              >
                {name || "Sequence name…"}
              </button>
            )}
          </div>

          {/* Metadata fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-stone-400">
                Theme
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Intention or theme…"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-stone-400">
                Peak pose
              </label>
              <PeakPosePicker value={peakPose} onChange={setPeakPose} />
            </div>

          </div>
        </header>

        {/* Sequence builder */}
        {!loaded ? (
          <div className="py-16 text-center text-sm text-stone-400">Loading…</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {hasPoses && (
              <SequenceAuditPanel report={auditReport} onAction={handleAuditAction} />
            )}

            <EnergyArc sections={sections} />

            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {sections.map((section) => (
                  <SortableSectionBlock
                    key={section.id}
                    section={section}
                    isCollapsed={isSectionCollapsed(section.id)}
                    missingPrereqsMap={missingPrereqsMap}
                    peakPoseId={peakPoseId}
                    peakReadiness={peakReadiness}
                    firstPoseId={firstPoseId}
                    lastPoseId={lastPoseId}
                    onToggleCollapse={toggleSectionCollapse}
                    onUpdateTitle={updateSectionTitle}
                    onToggleSecondSide={toggleSecondSide}
                    onUpdateRounds={updateSectionRounds}
                    onUpdateCue={updatePoseCue}
                    onUpdateBreaths={updatePoseBreaths}
                    onAddPose={(id) => setAddPoseTarget({ sectionId: id })}
                    onAddPoseBelow={(sectionId, afterPoseId) => setAddPoseTarget({ sectionId, insertAfterPoseId: afterPoseId })}
                    onApplyTemplate={applyTemplate}
                    onAddPrep={handleAddPrep}
                    onMovePose={movePose}
                    onRemovePose={removePose}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {draggingSectionTitle ? (
                <div className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 shadow-md">
                  <p className="font-display text-base text-stone-700">
                    {draggingSectionTitle}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Teaching Log */}
        <TeachingLog dates={dates} onChange={setDates} />

        {/* Footer */}
        <footer className="mt-8">
          <div className="rounded-2xl bg-white/80 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-200/70">
            <p className="text-stone-600">
              About <span className="font-display text-base text-stone-800">{formatMinutes(totalMinutes)}</span> on the mat
            </p>
            <p className="mt-1 text-xs text-stone-400">
              ~5s per breath in flows, ~8s in holds, ~12s in deep holds
            </p>
          </div>
        </footer>
      </main>

      {/* Rendered outside <main> so backdrop-blur-sm doesn't create a stacking context that traps fixed positioning */}
      {addPoseTarget && addPoseTargetSection && (
        <AddPoseModal
          targetSection={addPoseTargetSection}
          onAdd={(sectionId, option) => handleAddPose(sectionId, option, addPoseTarget.insertAfterPoseId)}
          onAddMany={handleAddPoses}
          onClose={() => setAddPoseTarget(null)}
        />
      )}
    </div>
  );
}
