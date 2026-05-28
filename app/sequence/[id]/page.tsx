"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
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
  type SequenceRecord,
} from "@/lib/sequences";

// ─── Pose library ───────────────────────────────────────────────────────────

type PoseOption = { pose: string; duration: string; minutes: number };
type PoseCategory = { name: string; poses: PoseOption[] };

const poseCategories: PoseCategory[] = [
  {
    name: "Warm-up",
    poses: [
      { pose: "Centering Breath", duration: "2 min", minutes: 2 },
      { pose: "Cat/Cow", duration: "2 min", minutes: 2 },
      { pose: "Child's Pose", duration: "1 min", minutes: 1 },
      { pose: "Downward Dog", duration: "1 min", minutes: 1 },
      { pose: "Beast", duration: "1 min", minutes: 1 },
    ],
  },
  {
    name: "Surya A",
    poses: [
      { pose: "Mountain Pose", duration: "30 sec", minutes: 0.5 },
      { pose: "Standing Forward Fold", duration: "30 sec", minutes: 0.5 },
      { pose: "Half Lift", duration: "30 sec", minutes: 0.5 },
      { pose: "Plank", duration: "30 sec", minutes: 0.5 },
      { pose: "Chaturanga", duration: "30 sec", minutes: 0.5 },
      { pose: "Upward Dog", duration: "30 sec", minutes: 0.5 },
    ],
  },
  {
    name: "Surya B",
    poses: [
      { pose: "Chair", duration: "30 sec", minutes: 0.5 },
      { pose: "Warrior I", duration: "1 min", minutes: 1 },
      { pose: "Vinyasa", duration: "30 sec", minutes: 0.5 },
    ],
  },
  {
    name: "Neutral Hips",
    poses: [
      { pose: "Low Lunge", duration: "1 min", minutes: 1 },
      { pose: "Crescent", duration: "1 min", minutes: 1 },
      { pose: "Twisted Crescent", duration: "1 min", minutes: 1 },
      { pose: "Warrior III", duration: "1 min", minutes: 1 },
      { pose: "Eagle", duration: "1 min", minutes: 1 },
      { pose: "Side Plank", duration: "30 sec", minutes: 0.5 },
      { pose: "Figure 4 Balance", duration: "1 min", minutes: 1 },
      { pose: "Dancing Shiva", duration: "1 min", minutes: 1 },
      { pose: "Standing Splits", duration: "1 min", minutes: 1 },
      { pose: "Skandasana", duration: "1 min", minutes: 1 },
    ],
  },
  {
    name: "Open Hips",
    poses: [
      { pose: "Devotional Warrior", duration: "1 min", minutes: 1 },
      { pose: "Warrior II", duration: "1 min", minutes: 1 },
      { pose: "Peaceful Warrior", duration: "45 sec", minutes: 0.75 },
      { pose: "Triangle", duration: "1 min", minutes: 1 },
      { pose: "Extended Side Angle", duration: "1 min", minutes: 1 },
      { pose: "Half Moon", duration: "1 min", minutes: 1 },
      { pose: "Revolved Triangle", duration: "1 min", minutes: 1 },
      { pose: "Prasarita", duration: "1 min", minutes: 1 },
      { pose: "Lizard", duration: "1 min", minutes: 1 },
      { pose: "Pyramid", duration: "1 min", minutes: 1 },
    ],
  },
  {
    name: "Midline Close",
    poses: [
      { pose: "Chair", duration: "30 sec", minutes: 0.5 },
      { pose: "Revolved Chair", duration: "30 sec", minutes: 0.5 },
      { pose: "Malasana", duration: "1 min", minutes: 1 },
      { pose: "Crow", duration: "1 min", minutes: 1 },
    ],
  },
  {
    name: "Floor",
    poses: [
      { pose: "Forearm Plank", duration: "30 sec", minutes: 0.5 },
      { pose: "Sphinx", duration: "1 min", minutes: 1 },
      { pose: "Locust", duration: "30 sec", minutes: 0.5 },
      { pose: "Bow", duration: "1 min", minutes: 1 },
      { pose: "Bridge", duration: "1 min", minutes: 1 },
      { pose: "Wheel", duration: "1 min", minutes: 1 },
      { pose: "Constructive Rest", duration: "1 min", minutes: 1 },
      { pose: "Supta Baddhakonasana", duration: "2 min", minutes: 2 },
    ],
  },
  {
    name: "Wind-down",
    poses: [
      { pose: "Pigeon", duration: "2 min", minutes: 2 },
      { pose: "Gomukhasana", duration: "2 min", minutes: 2 },
      { pose: "Janu Sirsasana", duration: "2 min", minutes: 2 },
      { pose: "Stargazer", duration: "1 min", minutes: 1 },
      { pose: "Seated Forward Fold", duration: "2 min", minutes: 2 },
      { pose: "Supine Twist", duration: "2 min", minutes: 2 },
      { pose: "Happy Baby", duration: "1 min", minutes: 1 },
      { pose: "Savasana", duration: "5 min", minutes: 5 },
    ],
  },
];

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
        isOver ? "bg-stone-100/80 ring-1 ring-stone-300" : ""
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
  onUpdateCue,
}: {
  sectionId: string;
  pose: PoseItem;
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

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
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
            <p className="text-sm text-stone-800">{pose.pose}</p>
          </div>
          <div className="pl-8">
            <PoseCueField cue={pose.cue} compact onSave={(cue) => onUpdateCue(pose.id, cue)} />
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
  onToggleCollapse,
  onUpdateTitle,
  onToggleSecondSide,
  onUpdateCue,
  onAddPose,
}: {
  section: Section;
  isCollapsed: boolean;
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

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`shadow-[0_1px_1px_rgba(0,0,0,0.03)] ${
        isCompact
          ? "rounded-2xl border border-stone-200 bg-white/80 p-4"
          : "rounded-2xl border border-stone-300 bg-stone-50/80 p-4 ring-1 ring-stone-200/80"
      }`}
    >
      <div
        className={
          isCompact
            ? "mb-3"
            : "mb-3 rounded-xl border border-dashed border-stone-300 bg-stone-100/60 px-3 py-2"
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
              className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-stone-400 transition-colors hover:bg-stone-100/70 hover:text-stone-700"
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

function AddPoseModal({
  targetSection,
  onAdd,
  onClose,
}: {
  targetSection: Section;
  onAdd: (sectionId: string, option: PoseOption) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visibleCategories = query
    ? poseCategories
        .map((cat) => ({ ...cat, poses: cat.poses.filter((p) => p.pose.toLowerCase().includes(query)) }))
        .filter((cat) => cat.poses.length > 0)
    : poseCategories;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-stone-900/20 p-6">
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-stone-50 shadow-lg ring-1 ring-stone-200">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-base font-medium text-stone-800">Add pose</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-700" aria-label="Close">
            Close
          </button>
        </div>
        <p className="px-5 pb-3 text-xs text-stone-500">
          Adding to <span className="font-medium text-stone-700">{targetSection.title}</span>
        </p>
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
        <div className="overflow-y-auto px-5 pb-5">
          {visibleCategories.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">No poses found</p>
          ) : (
            <div className="space-y-4">
              {visibleCategories.map((cat) => (
                <div key={cat.name}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-stone-400">{cat.name}</p>
                  <div className="space-y-1.5">
                    {cat.poses.map((option) => (
                      <button
                        key={option.pose}
                        type="button"
                        onClick={() => onAdd(targetSection.id, option)}
                        className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition hover:bg-stone-50"
                      >
                        <span className="text-sm text-stone-800">{option.pose}</span>
                        <span className="text-xs text-stone-500">{option.duration}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
                    className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm transition ${
                      p.pose === value
                        ? "bg-stone-100 font-medium text-stone-900"
                        : "text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {p.pose}
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
                    ? "bg-stone-100 text-stone-600"
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

  // Save state
  const [saveFlash, setSaveFlash] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (isNew) {
      setCreatedAt(new Date().toISOString());
      return;
    }
    const record = loadSequence(id);
    if (record) {
      setName(record.name);
      setTheme(record.theme ?? "");
      setPeakPose(record.peakPose);
      setDates(record.dates ?? []);
      setCreatedAt(record.createdAt);
      setSections(record.sections);
    } else {
      setName("Sequence not found");
      setCreatedAt(new Date().toISOString());
    }
    setLoaded(true);
  }, [id, isNew]);

  const buildRecord = (datesOverride?: string[]): SequenceRecord => ({
    id: sequenceId,
    name: name.trim() || "Untitled sequence",
    theme: theme.trim() || undefined,
    peakPose: peakPose || undefined,
    dates: datesOverride ?? dates,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections,
  });

  const handleSave = () => {
    saveSequence(buildRecord());
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  /**
   * Auto-save dates immediately when they change.
   * Other metadata (name, theme, peak pose) requires an explicit Save click,
   * but teaching dates are quick-logged (right after class) and easy to lose.
   * New sequences are excluded — they need an explicit first save.
   */
  const handleDatesChange = (newDates: string[]) => {
    setDates(newDates);
    if (!isNew) {
      saveSequence(buildRecord(newDates));
    }
  };


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
        setSections((prev) =>
          prev.map((s) =>
            s.id === activePose.sectionId
              ? { ...s, poses: s.poses.filter((p) => p.id !== activePose.poseId) }
              : s,
          ),
        );
        return;
      }

      let poseDropTargetSectionId: string | null = null;

      setSections((current) => {
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
      setSections((current) => {
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
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, poses: [...s.poses, newPose] } : s)),
    );
    setAddPoseSectionId(null);
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { id: generateId(), title: "New section", secondSide: false, poses: [] },
    ]);
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));
  };

  const toggleSecondSide = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, secondSide: !s.secondSide } : s)),
    );
  };

  const updatePoseCue = (poseId: string, cue: string) => {
    const nextCue = cue || undefined;
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        poses: s.poses.map((p) => (p.id === poseId ? { ...p, cue: nextCue } : p)),
      })),
    );
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
    <div className="min-h-screen bg-stone-100 px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl rounded-3xl bg-stone-50/90 p-8 shadow-sm ring-1 ring-stone-200/70 sm:p-10">

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
              onChange={handleDatesChange}
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
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {sections.map((section) => (
                  <SortableSectionBlock
                    key={section.id}
                    section={section}
                    isCollapsed={isSectionCollapsed(section.id)}
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

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={addSection}
            className="rounded-full border border-stone-300 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
          >
            Add Section
          </button>
        </div>

        {addPoseSectionId && addPoseTargetSection && (
          <AddPoseModal
            targetSection={addPoseTargetSection}
            onAdd={handleAddPose}
            onClose={() => setAddPoseSectionId(null)}
          />
        )}

        {/* Footer */}
        <footer className="mt-8 space-y-3">
          <div className="rounded-2xl bg-white/80 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-200/70">
            <p className="font-medium text-stone-800">Estimated class time: {formatMinutes(totalMinutes)}</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className={`w-full rounded-2xl px-5 py-3.5 text-sm font-medium transition ${
              saveFlash
                ? "bg-stone-700 text-white"
                : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            {saveFlash ? "Saved!" : "Save"}
          </button>
        </footer>
      </main>
    </div>
  );
}
