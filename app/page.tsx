"use client";

import { useState, type ReactNode } from "react";
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

type PoseItem = {
  id: string;
  pose: string;
  duration: string;
  minutes: number;
  cue?: string;
};

type Section = {
  id: string;
  title: string;
  secondSide: boolean;
  poses: PoseItem[];
};

type PoseOption = {
  pose: string;
  duration: string;
  minutes: number;
};

type PoseCategory = {
  name: string;
  poses: PoseOption[];
};

const TRASH_ID = "trash";

const initialSections: Section[] = [
  {
    id: "section-1",
    title: "Opening",
    secondSide: false,
    poses: [
      { id: "pose-1", pose: "Centering Breath", duration: "3 min", minutes: 3 },
      { id: "pose-2", pose: "Cat/Cow", duration: "2 min", minutes: 2 },
      {
        id: "pose-3",
        pose: "Downward Dog",
        duration: "1 min",
        minutes: 1,
        cue: "Pedal legs if needed",
      },
    ],
  },
  {
    id: "section-2",
    title: "Standing flow",
    secondSide: true,
    poses: [
      { id: "pose-4", pose: "Low Lunge (Right)", duration: "1 min", minutes: 1 },
      {
        id: "pose-5",
        pose: "Warrior II (Right)",
        duration: "1 min",
        minutes: 1,
        cue: "Reach through fingertips",
      },
      { id: "pose-6", pose: "Reverse Warrior (Right)", duration: "45 sec", minutes: 0.75 },
    ],
  },
  {
    id: "section-3",
    title: "Closing",
    secondSide: false,
    poses: [
      { id: "pose-8", pose: "Seated Forward Fold", duration: "3 min", minutes: 3 },
      { id: "pose-9", pose: "Savasana", duration: "8 min", minutes: 8 },
    ],
  },
];

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

function formatMinutes(minutes: number) {
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  if (seconds === 0) return `${wholeMinutes} min`;
  return `${wholeMinutes} min ${seconds} sec`;
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
  return sections.some((section) => section.id === id);
}

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

  const cancel = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") cancel();
        }}
        placeholder="Teaching cue…"
        autoFocus
        className={`mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none ${
          compact ? "text-xs" : "text-sm"
        }`}
        onClick={(event) => event.stopPropagation()}
      />
    );
  }

  if (cue) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          startEditing();
        }}
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
      onClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
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
      <span aria-hidden className="text-base">
        🗑
      </span>
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
  onToggleCollapse: (sectionId: string) => void;
  onUpdateTitle: (sectionId: string, title: string) => void;
  onToggleSecondSide: (sectionId: string) => void;
  onUpdateCue: (poseId: string, cue: string) => void;
  onAddPose: (sectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: section.id,
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startEditingTitle = () => {
    setTitleDraft(section.title);
    setEditingTitle(true);
  };

  const saveTitle = () => {
    onUpdateTitle(section.id, titleDraft.trim() || "Section");
    setEditingTitle(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sectionMinutes = section.poses.reduce((sum, pose) => sum + pose.minutes, 0);
  const totalSectionMinutes = section.secondSide ? sectionMinutes * 2 : sectionMinutes;
  const sectionDuration = formatMinutes(totalSectionMinutes);
  const isCompact = section.poses.length === 1;
  const poseSortableIds = section.poses.map((pose) => poseSortableId(section.id, pose.id));

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
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveTitle();
                  if (event.key === "Escape") setEditingTitle(false);
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
              <p className="text-xs text-stone-500">{sectionDuration}</p>
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
          {section.poses.length > 0 ? (
            <p className="py-1 text-center text-xs text-stone-400">Drop poses here to add at end</p>
          ) : null}
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

          <div className="mt-3 space-y-3 border-t border-stone-200/80 pt-3">
            <button
              type="button"
              onClick={() => onAddPose(section.id)}
              className="text-sm text-stone-600 underline-offset-2 hover:text-stone-800 hover:underline"
            >
              Add pose
            </button>
            {section.poses.length > 0 && (
              <label className="flex w-fit items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={section.secondSide}
                  onChange={() => onToggleSecondSide(section.id)}
                  className="h-3.5 w-3.5 rounded border-stone-300 text-stone-700 focus:ring-stone-300"
                />
                Repeat on other side
              </label>
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close pose picker"
          >
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
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-stone-400">
                    {cat.name}
                  </p>
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

function updatePoseCueInSections(sections: Section[], poseId: string, cue: string) {
  const nextCue = cue || undefined;
  return sections.map((section) => ({
    ...section,
    poses: section.poses.map((pose) =>
      pose.id === poseId ? { ...pose, cue: nextCue } : pose,
    ),
  }));
}

export default function Home() {
  const [sections, setSections] = useState(initialSections);
  const [addPoseSectionId, setAddPoseSectionId] = useState<string | null>(null);
  const [draggingPoseLabel, setDraggingPoseLabel] = useState<string | null>(null);
  const [draggingSectionTitle, setDraggingSectionTitle] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);
  const [nextPoseId, setNextPoseId] = useState(10);
  const [nextSectionId, setNextSectionId] = useState(4);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const isDraggingSection = draggingSectionTitle !== null;
  const isSectionCollapsed = (sectionId: string) =>
    isDraggingSection || collapsedSectionIds.includes(sectionId);

  const expandSection = (sectionId: string) => {
    setCollapsedSectionIds((current) => current.filter((id) => id !== sectionId));
  };

  const toggleSectionCollapse = (sectionId: string) => {
    if (isDraggingSection) return;
    setCollapsedSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activePose = parsePoseSortableId(event.active.id);
    if (activePose) {
      setDraggingSectionTitle(null);
      const section = sections.find((item) => item.id === activePose.sectionId);
      const pose = section?.poses.find((item) => item.id === activePose.poseId);
      setDraggingPoseLabel(pose?.pose ?? null);
      return;
    }
    if (isSectionSortableId(event.active.id, sections)) {
      setDraggingPoseLabel(null);
      const section = sections.find((item) => item.id === event.active.id);
      setDraggingSectionTitle(section?.title ?? "Section");
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
        setSections((current) =>
          current.map((section) =>
            section.id === activePose.sectionId
              ? { ...section, poses: section.poses.filter((pose) => pose.id !== activePose.poseId) }
              : section,
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
          const targetSection = current.find((section) => section.id === targetSectionId);
          if (!targetSection) return current;
          targetIndex = targetSection.poses.length;
        } else if (isSectionSortableId(over.id, current)) {
          targetSectionId = String(over.id);
          const targetSection = current.find((section) => section.id === targetSectionId);
          if (!targetSection) return current;
          targetIndex = targetSection.poses.length;
        } else {
          const overPose = parsePoseSortableId(over.id);
          if (!overPose) return current;
          targetSectionId = overPose.sectionId;
          const targetSection = current.find((section) => section.id === targetSectionId);
          targetIndex = targetSection?.poses.findIndex((pose) => pose.id === overPose.poseId) ?? -1;
          if (targetIndex === -1) return current;
        }

        if (activePose.sectionId === targetSectionId && active.id === over.id) return current;

        poseDropTargetSectionId = targetSectionId;

        const sourceSection = current.find((section) => section.id === activePose.sectionId);
        if (!sourceSection) return current;
        const pose = sourceSection.poses.find((item) => item.id === activePose.poseId);
        if (!pose) return current;

        if (activePose.sectionId === targetSectionId) {
          const fromIndex = sourceSection.poses.findIndex((item) => item.id === activePose.poseId);
          let toIndex = targetIndex;
          if (fromIndex < toIndex) toIndex -= 1;
          if (fromIndex === toIndex) return current;

          return current.map((section) =>
            section.id === targetSectionId
              ? { ...section, poses: arrayMove(section.poses, fromIndex, toIndex) }
              : section,
          );
        }

        return current.map((section) => {
          if (section.id === activePose.sectionId) {
            return {
              ...section,
              poses: section.poses.filter((item) => item.id !== activePose.poseId),
            };
          }
          if (section.id === targetSectionId) {
            const nextPoses = [...section.poses];
            nextPoses.splice(targetIndex, 0, pose);
            return { ...section, poses: nextPoses };
          }
          return section;
        });
      });

      if (poseDropTargetSectionId) {
        expandSection(poseDropTargetSectionId);
      }
      return;
    }

    if (isSectionSortableId(active.id, sections) && isSectionSortableId(over.id, sections)) {
      if (active.id === over.id) return;
      setSections((current) => {
        const oldIndex = current.findIndex((section) => section.id === active.id);
        const newIndex = current.findIndex((section) => section.id === over.id);
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
      id: `pose-${nextPoseId}`,
      pose: option.pose,
      duration: option.duration,
      minutes: option.minutes,
    };

    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? { ...section, poses: [...section.poses, newPose] }
          : section,
      ),
    );
    setNextPoseId((current) => current + 1);
    setAddPoseSectionId(null);
  };

  const addPoseTargetSection = sections.find((section) => section.id === addPoseSectionId);

  const addSection = () => {
    setSections((current) => [
      ...current,
      {
        id: `section-${nextSectionId}`,
        title: "New section",
        secondSide: false,
        poses: [],
      },
    ]);
    setNextSectionId((current) => current + 1);
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, title } : section)),
    );
  };

  const toggleSecondSide = (sectionId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, secondSide: !section.secondSide } : section,
      ),
    );
  };

  const updatePoseCue = (poseId: string, cue: string) => {
    setSections((current) => updatePoseCueInSections(current, poseId, cue));
  };

  const sectionIds = sections.map((section) => section.id);
  const baseMinutes = sections.reduce(
    (sum, section) => sum + section.poses.reduce((sectionSum, pose) => sectionSum + pose.minutes, 0),
    0,
  );
  const secondSideMinutes = sections.reduce((sum, section) => {
    if (!section.secondSide) return sum;
    return sum + section.poses.reduce((sectionSum, pose) => sectionSum + pose.minutes, 0);
  }, 0);
  const totalMinutes = baseMinutes + secondSideMinutes;
  const formattedDuration = formatMinutes(totalMinutes);

  return (
    <div className="min-h-screen bg-stone-100 px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl rounded-3xl bg-stone-50/90 p-8 shadow-sm ring-1 ring-stone-200/70 sm:p-10">
        <header className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Yoga Flow</p>
          <h1 className="mt-3 text-4xl font-light tracking-tight text-stone-900">
            Sequence Builder
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            Drag poses between sections, or drop on the trash to remove.
          </p>
        </header>

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

        <footer className="mt-8 rounded-2xl bg-white/80 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-200/70">
          <p className="font-medium text-stone-800">Estimated class time: {formattedDuration}</p>
          <p className="mt-1">
            Sections marked repeat on other side count that block twice in the total.
          </p>
        </footer>
      </main>
    </div>
  );
}
