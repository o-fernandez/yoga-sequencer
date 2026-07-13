"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isExampleSequence, localTodayISO, type SequenceRecord } from "@/lib/sequences";
import { themePoseStyle, themeTagLabel, themeTagStyle } from "@/lib/themes";
import { formatShortDate } from "@/lib/format";
import { getPoseIllustration } from "@/lib/pose-illustrations";

/** A lightweight log has no sections with poses and no user-named sections. */
function isLightweightLog(seq: SequenceRecord): boolean {
  return !seq.sections.some(
    (s) => s.poses.length > 0 || (s.title !== "New section" && s.title.trim())
  );
}

/** Up to 4 chips for substantive sections (named or with poses). */
function sectionChips(seq: SequenceRecord): string[] {
  return seq.sections
    .filter((s) => s.poses.length > 0 || (s.title !== "New section" && s.title.trim()))
    .slice(0, 4)
    .map((s) => {
      const r = s.rounds ?? 1;
      return r > 1 ? `${s.title} × ${r}` : s.title;
    });
}

/** First 80 chars of the most recent teach entry's notes. */
function firstNoteExcerpt(seq: SequenceRecord): string | null {
  const entry = [...seq.dates]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((e) => e.notes?.trim());
  if (!entry?.notes) return null;
  const n = entry.notes.trim();
  return n.length > 80 ? n.slice(0, 77) + "…" : n;
}

/** First 100 chars of the scratch-pad notes field. */
function scratchPadExcerpt(seq: SequenceRecord): string | null {
  if (!seq.notes?.trim()) return null;
  const n = seq.notes.trim();
  return n.length > 100 ? n.slice(0, 97) + "…" : n;
}

/** Auto-name for notes-only entries with no name or theme. */
function notesAutoName(seq: SequenceRecord): string {
  const d = new Date(seq.createdAt);
  return `Notes — ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/**
 * Press-and-hold to long-press, plain tap to click. Distinguishes the two using
 * pointer events so it works for both touch and mouse, and cancels on scroll.
 */
function useLongPress(onLongPress: () => void, onClick: () => void, ms = 450) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const moved = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      moved.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) {
        moved.current = true;
        clearTimer();
      }
    },
    onPointerUp: () => {
      clearTimer();
      if (!fired.current && !moved.current) onClick();
    },
    onPointerLeave: clearTimer,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function SelectIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
        selected
          ? "border-stone-800 bg-stone-800 text-white"
          : "border-stone-300 bg-white"
      }`}
    >
      {selected && (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
        </svg>
      )}
    </span>
  );
}

export function SequenceCard({
  sequence,
  selectionMode,
  selected,
  onOpen,
  onToggleSelect,
  onEnterSelection,
  onDuplicate,
  onDelete,
}: {
  sequence: SequenceRecord;
  selectionMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onEnterSelection: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const isLight = isLightweightLog(sequence);
  const padExcerpt = scratchPadExcerpt(sequence);
  const noteExcerpt = padExcerpt ?? firstNoteExcerpt(sequence);
  const chips = sectionChips(sequence);
  const today = localTodayISO();
  const taughtDates = (sequence.dates ?? []).filter((e) => e.date <= today);
  const plannedDates = (sequence.dates ?? []).filter((e) => e.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const nextPlanned = plannedDates[0]?.date;
  const lastTaught = [...taughtDates].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  const taughtCount = taughtDates.length;
  const createdDateIso = sequence.createdAt?.slice(0, 10) ?? null;
  const displayDate = lastTaught ?? nextPlanned ?? (sequence.notes?.trim() ? createdDateIso : null);
  const hasAnyDate = !!displayDate;

  const tagStyle = themeTagStyle(sequence.themeType, sequence.themeSub);
  const poseStyle = themePoseStyle(sequence.themeType, sequence.themeSub);

  const filledDots = Math.min(taughtCount, 5);
  const firstDotPlanned = taughtCount === 0 && !!nextPlanned;
  const dotLabel =
    taughtCount === 1 ? "Taught once" :
    taughtCount > 1 ? `Taught ${taughtCount}×` :
    nextPlanned ? "Planned · never taught" :
    "Never taught";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) close();
    };
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); return; }
    const rect = buttonRef.current!.getBoundingClientRect();
    const MENU_HEIGHT = 80;
    const top = window.innerHeight - rect.bottom >= MENU_HEIGHT + 8
      ? rect.bottom + 4
      : rect.top - MENU_HEIGHT - 4;
    setMenuPos({ top, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  const handlers = useLongPress(
    onEnterSelection,
    () => (selectionMode ? onToggleSelect() : onOpen()),
  );

  const menuPortal = menuOpen && menuPos
    ? createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-36 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); setMenuOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
          >
            Delete
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? selected : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectionMode) onToggleSelect();
          else onOpen();
        }
      }}
      {...handlers}
      className={`relative cursor-pointer select-none touch-pan-y rounded-2xl border bg-white/70 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-sm transition [-webkit-touch-callout:none] hover:bg-white/80 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)] ${
        selected
          ? "border-stone-400 ring-2 ring-stone-400/60"
          : "border-stone-300/40"
      }`}
    >
      {/* ⋯ menu — absolute top-right so the highlight block owns the right column */}
      {!selectionMode && (
        <div
          className="absolute right-3.5 top-3.5"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={handleMenuToggle}
            aria-label={`More actions for ${sequence.name || sequence.theme}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
            </svg>
          </button>
          {menuPortal}
        </div>
      )}
      <div className={`flex items-start gap-3 ${!selectionMode ? "pr-10" : ""}`}>
        {selectionMode && <SelectIndicator selected={selected} />}
        {/* Left column: theme, date/status, pull quote, section chips */}
        <div className="min-w-0 flex-1">
          <h2
            className="font-display text-base font-medium leading-snug text-stone-900"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {sequence.theme || sequence.name || (sequence.notes?.trim() ? notesAutoName(sequence) : null) || (
              <span className="text-stone-400">Untitled class</span>
            )}
          </h2>
          {tagStyle && sequence.themeType && sequence.themeSub && (
            <span
              className="mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none"
              style={{ backgroundColor: tagStyle.bg, color: tagStyle.text, borderColor: tagStyle.border }}
            >
              {themeTagLabel(sequence.themeType, sequence.themeSub)}
            </span>
          )}
          {hasAnyDate && (
            <p className="mt-1.5 text-[13px] text-stone-500">
              {formatShortDate(displayDate!)}
            </p>
          )}
          {noteExcerpt && (
            <p className="mt-2 border-l-2 border-stone-200 pl-2.5 text-[13px] italic leading-relaxed text-stone-500">
              {noteExcerpt}
            </p>
          )}
          {!isLight && chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.slice(0, 2).map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-stone-100 bg-stone-50/80 px-2 py-0.5 text-[11px] text-stone-500"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Class highlight block — right-anchored */}
        {sequence.peakPose && (
          <div
            className="flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 text-center"
            style={poseStyle
              ? { backgroundColor: poseStyle.bg, borderColor: poseStyle.border, color: poseStyle.text }
              : { backgroundColor: '#f7f6f4', borderColor: 'rgba(214,211,207,0.8)', color: '#57534e' }
            }
          >
            {getPoseIllustration(sequence.peakPose, "w-9 h-9")}
            <span className="mt-1 break-words text-[11px] font-medium leading-tight">
              {sequence.peakPose}
            </span>
          </div>
        )}
      </div>
      {/* Taught history dot row */}
      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-stone-100">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const filled = i < filledDots;
            const planned = i === 0 && firstDotPlanned;
            return (
              <span
                key={i}
                className="block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: filled ? '#4ade80' : planned ? '#a78bfa' : '#e7e5e4',
                }}
              />
            );
          })}
        </div>
        <span className="text-[11px] text-stone-400">{dotLabel}</span>
        {isExampleSequence(sequence.id) && (
          <span className="ml-auto rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-[10px] leading-none text-stone-400">
            Example
          </span>
        )}
      </div>
    </article>
  );
}
