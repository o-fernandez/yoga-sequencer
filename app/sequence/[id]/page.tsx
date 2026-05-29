"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
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
  type PoseItem,
  type Section,
} from "@/lib/sequences";
import {
  poseLibrary,
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

// ─── Pose library ───────────────────────────────────────────────────────────

type PoseOption = { pose: string; duration: string; minutes: number };
type PoseCategory = { name: string; poses: PoseOption[] };

const poseCategories: PoseCategory[] = poseLibrary.map((cat) => ({
  name: cat.category,
  poses: cat.poses.map((p) => ({ pose: p.pose, duration: p.duration, minutes: p.minutes })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const TRASH_ID = "trash";

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

function poseSortableId(sectionId: string, poseId: string) {
  return `${sectionId}::${poseId}`;
}

function sectionDropId(sectionId: string) {
  return `section-drop-${sectionId}`;
}

function parsePoseSortableId(id: string | number) {
  const value = String(id);
  if (!value.includes("::")) return null;
  const [sectionId, poseId] = value.split("::");
  return { sectionId, poseId };
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
  heating:  "bg-orange-400",
  warming:  "bg-amber-400",
  cooling:  "bg-sky-400",
  grounding:"bg-slate-400",
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
      const minutes = s.secondSide
        ? s.poses.reduce((sum, p) => sum + p.minutes, 0) * 2
        : s.poses.reduce((sum, p) => sum + p.minutes, 0);
      const energy = getDominantEnergy(s);
      return { id: s.id, title: s.title, minutes, energy };
    })
    .filter((b) => b.minutes > 0 && b.energy);

  const total = blocks.reduce((sum, b) => sum + b.minutes, 0);
  if (!total || blocks.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
        Energy arc
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

// ─── Peak readiness panel ─────────────────────────────────────────────────────

function PeakReadinessPanel({
  readiness,
  onAddPrep,
}: {
  readiness: PeakReadiness;
  onAddPrep: (poseName: string) => void;
}) {
  const { peak, depends, warmed, unwarmed, suggestionsByArea } = readiness;
  const allWarmed = unwarmed.length === 0;

  return (
    <div className="mb-5 rounded-2xl border border-stone-200 bg-white/80 p-4 ring-1 ring-stone-200/60">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
          Peak readiness
        </p>
        <p className="text-xs font-medium text-stone-500">
          {warmed.length} / {depends.length} warmed
        </p>
      </div>

      {/* Area chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {depends.map((area) => {
          const isWarmed = warmed.includes(area);
          return (
            <span
              key={area}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                isWarmed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <span aria-hidden className="text-[10px] leading-none">
                {isWarmed ? "✓" : "!"}
              </span>
              {getBodyTargetLabel(area)}
            </span>
          );
        })}
      </div>

      {/* Verdict */}
      {allWarmed ? (
        <p className="text-sm text-emerald-700">
          <span aria-hidden>✓ </span>Your class warms up for {peak}.
        </p>
      ) : (
        <p className="text-sm text-stone-600">
          Warm these before {peak}:{" "}
          <span className="font-medium text-amber-700">
            {unwarmed.map((a) => getBodyTargetLabel(a)).join(", ")}
          </span>
        </p>
      )}

      {/* Suggestions per unwarmed area */}
      {!allWarmed && (
        <div className="mt-3 space-y-2.5 border-t border-stone-200/80 pt-3">
          {suggestionsByArea.map(({ area, poses }) => (
            <div key={area}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">
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
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600 transition hover:border-stone-300 hover:bg-[#e8e3da]/70 hover:text-stone-800"
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

function TrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID });
  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border px-5 py-3 shadow-lg transition ${
        isOver
          ? "scale-105 border-red-300 bg-red-50 text-red-700"
          : "border-stone-300 bg-white/95 text-stone-600"
      }`}
    >
      <span aria-hidden className="text-base">🗑</span>
      <span className="text-sm font-medium">Drop to delete</span>
    </div>
  );
}

function SectionPoseDropArea({
  sectionId,
  isEmpty,
  children,
}: {
  sectionId: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(sectionId) });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[2rem] rounded-xl transition ${
        isOver ? "bg-[#e8e3da]/80 ring-1 ring-stone-300" : ""
      } ${isEmpty ? "border border-dashed border-stone-200 px-3 py-4" : ""}`}
    >
      {isEmpty ? (
        <p className="text-center text-xs text-stone-400">Drop poses here</p>
      ) : (
        children
      )}
    </div>
  );
}

function SortableSectionPoseRow({
  sectionId,
  pose,
  missingPrereqs,
  onUpdateCue,
}: {
  sectionId: string;
  pose: PoseItem;
  missingPrereqs: string[];
  onUpdateCue: (poseId: string, cue: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: poseSortableId(sectionId, pose.id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [showWarning, setShowWarning] = useState(false);
  const [showMods, setShowMods] = useState(false);
  const meta = getPoseMeta(pose.pose);
  const regionClasses = meta?.bodyRegion ? getBodyRegionClasses(meta.bodyRegion) : null;
  const bodyChips = meta?.bodyTargets.slice(0, 3) ?? [];
  const hasMods = (meta?.modifications?.length ?? 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-stone-200 px-4 py-3 ${
        regionClasses ? regionClasses.gradient : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab text-stone-400 active:cursor-grabbing"
              aria-label={`Drag ${pose.pose}`}
            >
              :::
            </button>
            <div className="flex min-w-0 items-baseline gap-2">
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
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition hover:bg-amber-200"
                  aria-label="Prerequisite warning"
                >
                  <span className="text-[11px] font-bold leading-none">!</span>
                </button>
                {showWarning && (
                  <div className="absolute left-0 top-7 z-10 w-52 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-md">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
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
            <div className="mt-1.5 flex flex-wrap gap-1 pl-8">
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
          <div className="pl-8">
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
          </div>
        </div>
        <p className="shrink-0 text-xs text-stone-500">{pose.duration}</p>
      </div>
    </div>
  );
}

function SortableSectionBlock({
  section,
  isCollapsed,
  missingPrereqsMap,
  onToggleCollapse,
  onUpdateTitle,
  onToggleSecondSide,
  onUpdateCue,
  onAddPose,
}: {
  section: Section;
  isCollapsed: boolean;
  missingPrereqsMap: Map<string, string[]>;
  onToggleCollapse: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onToggleSecondSide: (id: string) => void;
  onUpdateCue: (poseId: string, cue: string) => void;
  onAddPose: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startEditingTitle = () => { setTitleDraft(section.title); setEditingTitle(true); };
  const saveTitle = () => { onUpdateTitle(section.id, titleDraft.trim() || "Section"); setEditingTitle(false); };

  const style = { transform: CSS.Transform.toString(transform), transition };
  const sectionMinutes = section.poses.reduce((sum, p) => sum + p.minutes, 0);
  const totalSectionMinutes = section.secondSide ? sectionMinutes * 2 : sectionMinutes;
  const isCompact = section.poses.length === 1;
  const poseSortableIds = section.poses.map((p) => poseSortableId(section.id, p.id));

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
    heating:  "bg-orange-100 text-orange-700",
    warming:  "bg-amber-100 text-amber-700",
    cooling:  "bg-sky-100 text-sky-700",
    grounding:"bg-stone-200 text-stone-600",
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
              className="cursor-grab text-stone-400 active:cursor-grabbing"
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
                className="min-w-0 flex-1 bg-transparent text-sm font-medium uppercase tracking-[0.14em] text-stone-700 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingTitle}
                className="truncate text-left text-sm font-medium uppercase tracking-[0.14em] text-stone-600 hover:text-stone-800"
              >
                {section.title}
              </button>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            {section.poses.length > 0 && (
              <p className="text-xs text-stone-500">{formatMinutes(totalSectionMinutes)}</p>
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

      {isCollapsed ? (
        <SectionPoseDropArea sectionId={section.id} isEmpty={section.poses.length === 0}>
          {null}
        </SectionPoseDropArea>
      ) : (
        <>
          <SectionPoseDropArea sectionId={section.id} isEmpty={section.poses.length === 0}>
            {section.poses.length > 0 && (
              <SortableContext items={poseSortableIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {section.poses.map((pose) => (
                    <SortableSectionPoseRow
                      key={pose.id}
                      sectionId={section.id}
                      pose={pose}
                      missingPrereqs={missingPrereqsMap.get(pose.id) ?? []}
                      onUpdateCue={onUpdateCue}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </SectionPoseDropArea>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200/80 pt-3">
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

  const toggleBodyTarget = (t: string) =>
    setActiveBodyTargets((prev) => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });
  const toggleEnergy = (e: string) =>
    setActiveEnergies((prev) => { const next = new Set(prev); next.has(e) ? next.delete(e) : next.add(e); return next; });

  const query = search.trim().toLowerCase();
  // Fuzzy name match (tolerant of typos/abbreviations); body-part text search stays exact.
  const fuzzyMatchNames = search.trim()
    ? new Set(searchPoses(search.trim()).map((p) => p.pose))
    : null;

  const visibleCategories = poseLibrary
    .map((cat) => ({
      name: cat.category,
      poses: cat.poses.filter((p) => {
        const meta = getPoseMeta(p.pose)!;
        // Search: fuzzy match on name, or substring match on any body target label
        if (query) {
          const nameMatch = fuzzyMatchNames!.has(p.pose);
          const targetMatch = meta.bodyTargets.some((t) =>
            getBodyTargetLabel(t).toLowerCase().includes(query)
          );
          if (!nameMatch && !targetMatch) return false;
        }
        // Energy filter
        if (activeEnergies.size > 0 && !activeEnergies.has(meta.energy)) return false;
        // Body target filter (any match)
        if (activeBodyTargets.size > 0 && !meta.bodyTargets.some((t) => activeBodyTargets.has(t))) return false;
        return true;
      }),
    }))
    .filter((cat) => cat.poses.length > 0);

  const hasActiveFilters = activeBodyTargets.size > 0 || activeEnergies.size > 0;

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

        {/* Clear filters */}
        {hasActiveFilters && (
          <div className="px-5 pb-2">
            <button
              type="button"
              onClick={() => { setActiveBodyTargets(new Set()); setActiveEnergies(new Set()); }}
              className="text-[11px] text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Pose list */}
        <div className="overflow-y-auto px-5 pb-5">
          {visibleCategories.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">No poses found</p>
          ) : (
            <div className="space-y-4">
              {visibleCategories.map((cat) => (
                <div key={cat.name}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-stone-400">{cat.name}</p>
                  <div className="space-y-1.5">
                    {cat.poses.map((option) => {
                      const meta = getPoseMeta(option.pose);
                      const regionClasses = meta?.bodyRegion ? getBodyRegionClasses(meta.bodyRegion) : null;
                      const chips = meta?.bodyTargets.slice(0, 3) ?? [];
                      return (
                        <button
                          key={option.pose}
                          type="button"
                          onClick={() => onAdd(targetSection.id, option)}
                          className={`w-full rounded-xl border border-stone-200 px-4 py-3 text-left transition hover:brightness-95 ${
                            regionClasses ? regionClasses.gradient : "bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <span className="text-sm text-stone-800">{option.pose}</span>
                              {meta?.sanskrit && (
                                <span className="truncate text-[11px] italic text-stone-400">{meta.sanskrit}</span>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-stone-500">{option.duration}</span>
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
                          {meta?.modifications?.length ? (
                            <p className="mt-1 text-[10px] italic text-stone-400">
                              {meta.modifications[0]}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
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

  const query = search.trim().toLowerCase();
  const visibleCategories = query
    ? poseCategories
        .map((cat) => ({ ...cat, poses: cat.poses.filter((p) => p.pose.toLowerCase().includes(query)) }))
        .filter((cat) => cat.poses.length > 0)
    : poseCategories;

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
            {visibleCategories.map((cat) => (
              <div key={cat.name} className="mb-2">
                <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-[0.1em] text-stone-400">{cat.name}</p>
                {cat.poses.map((p) => (
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
                    {getPoseMeta(p.pose)?.sanskrit && (
                      <span className="truncate text-[11px] italic text-stone-400">
                        {getPoseMeta(p.pose)!.sanskrit}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Teaching dates ──────────────────────────────────────────────────────────

function TeachingDatesField({
  dates,
  onChange,
}: {
  dates: string[];
  onChange: (dates: string[]) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [addingDate, setAddingDate] = useState(false);
  const [newDateInput, setNewDateInput] = useState(today);

  const sorted = [...dates].sort();

  const remove = (date: string) => {
    onChange(dates.filter((d) => d !== date));
  };

  const openPicker = () => {
    setNewDateInput(today); // default to today each time
    setAddingDate(true);
  };

  const addDate = () => {
    if (!newDateInput || dates.includes(newDateInput)) {
      setAddingDate(false);
      return;
    }
    onChange([...dates, newDateInput].sort());
    setAddingDate(false);
  };

  return (
    <div className="col-span-2">
      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-stone-400">
        Teaching dates
      </label>

      {/* Date chips */}
      {sorted.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {sorted.map((date) => {
            const isPast = date <= today;
            return (
              <span
                key={date}
                className={`inline-flex items-center gap-2 rounded-full py-1 pl-3 pr-2 text-xs ${
                  isPast
                    ? "bg-[#e8e3da] text-stone-600"
                    : "border border-stone-300 bg-white text-stone-600"
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  {isPast ? "Taught" : "Planned"}
                </span>
                <span>{formatDateShort(date)}</span>
                <button
                  type="button"
                  onClick={() => remove(date)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-200 hover:text-stone-700"
                  aria-label={`Remove ${date}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Add date */}
      {addingDate ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={newDateInput}
            onChange={(e) => setNewDateInput(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") addDate();
              if (e.key === "Escape") setAddingDate(false);
            }}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-stone-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={addDate}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingDate(false)}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="text-xs text-stone-400 transition hover:text-stone-600"
        >
          + Add date
        </button>
      )}
    </div>
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
  const [dates, setDates] = useState<string[]>([]);
  const [createdAt, setCreatedAt] = useState("");
  const [loaded, setLoaded] = useState(isNew);

  // Builder state
  const [sections, setSections] = useState<Section[]>([]);
  const [addPoseSectionId, setAddPoseSectionId] = useState<string | null>(null);
  const [draggingPoseLabel, setDraggingPoseLabel] = useState<string | null>(null);
  const [draggingSectionTitle, setDraggingSectionTitle] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
    if (isNew) {
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
    const activePose = parsePoseSortableId(event.active.id);
    if (activePose) {
      setDraggingSectionTitle(null);
      const section = sections.find((s) => s.id === activePose.sectionId);
      setDraggingPoseLabel(section?.poses.find((p) => p.id === activePose.poseId)?.pose ?? null);
      return;
    }
    if (isSectionSortableId(event.active.id, sections)) {
      setDraggingPoseLabel(null);
      setDraggingSectionTitle(sections.find((s) => s.id === event.active.id)?.title ?? "Section");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingPoseLabel(null);
    setDraggingSectionTitle(null);
    if (!over) return;

    const activePose = parsePoseSortableId(active.id);

    if (activePose) {
      if (over.id === TRASH_ID) {
        updateSections((prev) =>
          prev.map((s) =>
            s.id === activePose.sectionId
              ? { ...s, poses: s.poses.filter((p) => p.id !== activePose.poseId) }
              : s,
          ),
        );
        return;
      }

      let poseDropTargetSectionId: string | null = null;

      updateSections((current) => {
        let targetSectionId: string;
        let targetIndex: number;

        if (String(over.id).startsWith("section-drop-")) {
          targetSectionId = String(over.id).replace("section-drop-", "");
          const targetSection = current.find((s) => s.id === targetSectionId);
          if (!targetSection) return current;
          targetIndex = targetSection.poses.length;
        } else if (isSectionSortableId(over.id, current)) {
          targetSectionId = String(over.id);
          const targetSection = current.find((s) => s.id === targetSectionId);
          if (!targetSection) return current;
          targetIndex = targetSection.poses.length;
        } else {
          const overPose = parsePoseSortableId(over.id);
          if (!overPose) return current;
          targetSectionId = overPose.sectionId;
          const targetSection = current.find((s) => s.id === targetSectionId);
          targetIndex = targetSection?.poses.findIndex((p) => p.id === overPose.poseId) ?? -1;
          if (targetIndex === -1) return current;
        }

        if (activePose.sectionId === targetSectionId && active.id === over.id) return current;

        poseDropTargetSectionId = targetSectionId;

        const sourceSection = current.find((s) => s.id === activePose.sectionId);
        if (!sourceSection) return current;
        const pose = sourceSection.poses.find((p) => p.id === activePose.poseId);
        if (!pose) return current;

        if (activePose.sectionId === targetSectionId) {
          const fromIndex = sourceSection.poses.findIndex((p) => p.id === activePose.poseId);
          let toIndex = targetIndex;
          if (fromIndex < toIndex) toIndex -= 1;
          if (fromIndex === toIndex) return current;
          return current.map((s) =>
            s.id === targetSectionId ? { ...s, poses: arrayMove(s.poses, fromIndex, toIndex) } : s,
          );
        }

        return current.map((s) => {
          if (s.id === activePose.sectionId) return { ...s, poses: s.poses.filter((p) => p.id !== activePose.poseId) };
          if (s.id === targetSectionId) {
            const next = [...s.poses];
            next.splice(targetIndex, 0, pose);
            return { ...s, poses: next };
          }
          return s;
        });
      });

      if (poseDropTargetSectionId) expandSection(poseDropTargetSectionId);
      return;
    }

    if (isSectionSortableId(active.id, sections) && isSectionSortableId(over.id, sections)) {
      if (active.id === over.id) return;
      updateSections((current) => {
        const oldIndex = current.findIndex((s) => s.id === active.id);
        const newIndex = current.findIndex((s) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return current;
        return arrayMove(current, oldIndex, newIndex);
      });
    }
  };

  const handleDragCancel = () => {
    setDraggingPoseLabel(null);
    setDraggingSectionTitle(null);
  };

  const handleAddPose = (sectionId: string, option: PoseOption) => {
    const newPose: PoseItem = {
      id: generateId(),
      pose: option.pose,
      duration: option.duration,
      minutes: option.minutes,
    };
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, poses: [...s.poses, newPose] } : s)),
    );
    setAddPoseSectionId(null);
  };

  const handleAddPoses = (sectionId: string, poses: PoseMeta[]) => {
    const newPoses: PoseItem[] = poses.map((p) => ({
      id: generateId(),
      pose: p.pose,
      duration: p.duration,
      minutes: p.minutes,
    }));
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, poses: [...s.poses, ...newPoses] } : s)),
    );
    setAddPoseSectionId(null);
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    updateSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));
  };

  const toggleSecondSide = (sectionId: string) => {
    updateSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, secondSide: !s.secondSide } : s)),
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

  const handleAddPrep = (poseName: string) => {
    updateSections((prev) => insertPoseBeforePeak(prev, poseName, peakPose));
  };

  const sectionIds = sections.map((s) => s.id);
  const addPoseTargetSection = sections.find((s) => s.id === addPoseSectionId);

  const baseMinutes = sections.reduce((sum, s) => sum + s.poses.reduce((acc, p) => acc + p.minutes, 0), 0);
  const secondSideMinutes = sections.reduce((sum, s) => {
    if (!s.secondSide) return sum;
    return sum + s.poses.reduce((acc, p) => acc + p.minutes, 0);
  }, 0);
  const totalMinutes = baseMinutes + secondSideMinutes;

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
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Yoga Flow</p>
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
                className="w-full bg-transparent text-3xl font-light tracking-tight text-stone-900 placeholder:text-stone-300 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingName}
                className={`text-left text-3xl font-light tracking-tight transition hover:text-stone-600 ${
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
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-stone-400">
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
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-stone-400">
                Peak pose
              </label>
              <PeakPosePicker value={peakPose} onChange={setPeakPose} />
            </div>

            <TeachingDatesField
              dates={dates}
              onChange={setDates}
            />
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
            {peakReadiness && (
              <PeakReadinessPanel readiness={peakReadiness} onAddPrep={handleAddPrep} />
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
                    onToggleCollapse={toggleSectionCollapse}
                    onUpdateTitle={updateSectionTitle}
                    onToggleSecondSide={toggleSecondSide}
                    onUpdateCue={updatePoseCue}
                    onAddPose={setAddPoseSectionId}
                  />
                ))}
              </div>
            </SortableContext>

            {draggingPoseLabel && <TrashDropZone />}

            <DragOverlay>
              {draggingPoseLabel ? (
                <div className="rounded-xl border border-stone-300 bg-white px-4 py-3 shadow-md">
                  <p className="text-sm font-medium text-stone-800">{draggingPoseLabel}</p>
                </div>
              ) : null}
              {draggingSectionTitle ? (
                <div className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 shadow-md">
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-stone-700">
                    {draggingSectionTitle}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Footer */}
        <footer className="mt-8">
          <div className="rounded-2xl bg-white/80 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-200/70">
            <p className="font-medium text-stone-800">Estimated class time: {formatMinutes(totalMinutes)}</p>
          </div>
        </footer>
      </main>

      {/* Rendered outside <main> so backdrop-blur-sm doesn't create a stacking context that traps fixed positioning */}
      {addPoseSectionId && addPoseTargetSection && (
        <AddPoseModal
          targetSection={addPoseTargetSection}
          onAdd={handleAddPose}
          onAddMany={handleAddPoses}
          onClose={() => setAddPoseSectionId(null)}
        />
      )}
    </div>
  );
}
