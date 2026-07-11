"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadSequences,
  deleteSequence,
  duplicateSequence,
  dismissExamplesNotice,
  examplesNoticeDismissed,
  generateId,
  isExampleSequence,
  localTodayISO,
  removeExampleSequences,
  resetSequencesToSeeds,
  saveSequence,
  type SequenceRecord,
  type ThemeType,
} from "@/lib/sequences";
import {
  exportBackup,
  parseBackupFile,
  applyImport,
  getLastBackupAt,
  formatLastBackup,
  type ImportPreview,
} from "@/lib/backup";
import { getPoseIllustration } from "@/lib/pose-illustrations";
import {
  connectWithSyncInput,
  disconnectSync,
  enableSync,
  getServerSyncStatus,
  getSyncStatus,
  getSyncToken,
  subscribeSync,
  subscribeSyncApplied,
  syncLink,
} from "@/lib/sync";
import {
  loadInspirations,
  saveInspiration,
  deleteInspiration,
  isExampleInspiration,
  removeExampleInspirations,
  resetInspirationsToSeeds,
  type InspirationEntry,
} from "@/lib/inspirations";
import { allCues, updateCue, deleteCue, type CueEntry } from "@/lib/cues";

const AYURVEDIC_SEASONS = ['Vata', 'Kapha', 'Pitta'];

function formatThemeSubLabel(themeType: ThemeType, themeSub: string): string {
  if (themeType === 'season') {
    return AYURVEDIC_SEASONS.includes(themeSub) ? `${themeSub} season` : themeSub;
  }
  if (themeType === 'meridian') return `${themeSub} meridian`;
  return themeSub;
}

// ─── Theme color system ───────────────────────────────────────────────────────

type ColorStyle = { bg: string; text: string; border: string };

const CHAKRA_COLORS: ColorStyle[] = [
  { bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }, // 1 Muladhara
  { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' }, // 2 Svadhisthana
  { bg: '#FAEEDA', text: '#BA7517', border: '#EF9F27' }, // 3 Manipura
  { bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }, // 4 Anahata
  { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' }, // 5 Vishuddha
  { bg: '#EEEDFE', text: '#534AB7', border: '#AFA9EC' }, // 6 Ajna
  { bg: '#FBEAF0', text: '#993556', border: '#F4C0D1' }, // 7 Sahasrara
];

const SEASON_GREEN: ColorStyle = { bg: '#E1F5EE', text: '#0F6E56', border: '#9FE1CB' };
const SEASON_AMBER: ColorStyle = { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' };
const SEASON_BLUE: ColorStyle  = { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' };

function chakraColor(themeSub: string): ColorStyle | null {
  const n = parseInt(themeSub[0]);
  if (isNaN(n) || n < 1 || n > 7) return null;
  return CHAKRA_COLORS[n - 1];
}

function seasonPoseColor(themeSub: string): ColorStyle {
  if (themeSub === 'Pitta' || themeSub === 'Summer' || themeSub === 'Fall') return SEASON_AMBER;
  if (themeSub === 'Vata' || themeSub === 'Winter') return SEASON_BLUE;
  return SEASON_GREEN; // Kapha, Spring
}

function themeTagStyle(themeType: ThemeType | undefined, themeSub: string | undefined): ColorStyle | null {
  if (!themeType || !themeSub || themeType === 'custom') return null;
  if (themeType === 'season') return SEASON_GREEN;
  if (themeType === 'meridian') return SEASON_GREEN;
  if (themeType === 'chakra') return chakraColor(themeSub);
  return null;
}

function themePoseStyle(themeType: ThemeType | undefined, themeSub: string | undefined): ColorStyle | null {
  if (!themeType || !themeSub || themeType === 'custom') return null;
  if (themeType === 'season') return seasonPoseColor(themeSub);
  if (themeType === 'meridian') return SEASON_GREEN;
  if (themeType === 'chakra') return chakraColor(themeSub);
  return null;
}

function themeTagLabel(themeType: ThemeType, themeSub: string): string {
  if (themeType === 'season') return formatThemeSubLabel(themeType, themeSub);
  if (themeType === 'meridian') return themeSub;
  if (themeType === 'chakra') {
    // "1 · Muladhara (root)" → "Muladhara · chakra"
    const name = themeSub.split('·')[1]?.split('(')[0]?.trim() ?? themeSub;
    return `${name} · chakra`;
  }
  return themeSub;
}

function formatDate(iso: string): string {
  // Parse as local noon to avoid timezone off-by-one
  const d = new Date(`${iso}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

/** Max date from a sequence's dates array; falls back to updatedAt for sorting. */
function sortKey(seq: SequenceRecord): string {
  if (seq.dates && seq.dates.length > 0) {
    return [...seq.dates.map((e) => e.date)].sort().at(-1)!;
  }
  return seq.updatedAt;
}

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

// ─── Teaching ahead strip ─────────────────────────────────────────────────────

type UpcomingItem = { sequence: SequenceRecord; date: string; isToday: boolean };

/** Soonest planned date (today or later) per sequence, soonest first. */
function upcomingTeachingItems(sequences: SequenceRecord[]): UpcomingItem[] {
  const today = localTodayISO();
  const items: UpcomingItem[] = [];
  for (const seq of sequences) {
    const soonest = (seq.dates ?? [])
      .map((e) => e.date)
      .filter((d) => d >= today)
      .sort()[0];
    if (soonest) items.push({ sequence: seq, date: soonest, isToday: soonest === today });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function UpcomingRow({
  item,
  onOpen,
}: {
  item: UpcomingItem;
  onOpen: () => void;
}) {
  const { sequence, date, isToday } = item;
  const d = new Date(`${date}T12:00:00`);
  // Within the coming week the weekday is unambiguous; beyond it, the month says more.
  const daysAway = Math.round((d.getTime() - new Date(`${localTodayISO()}T12:00:00`).getTime()) / 86_400_000);
  const topLabel = daysAway <= 6
    ? d.toLocaleDateString("en-US", { weekday: "short" })
    : d.toLocaleDateString("en-US", { month: "short" });
  const tagStyle = themeTagStyle(sequence.themeType, sequence.themeSub);
  const poseStyle = themePoseStyle(sequence.themeType, sequence.themeSub);
  const teachable = isToday && sequence.sections.some((s) => s.poses.length > 0);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex cursor-pointer select-none items-center gap-4 rounded-2xl border p-3.5 pl-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-sm transition ${
        isToday
          ? "border-amber-200/80 bg-white/90 hover:bg-white"
          : "border-stone-300/40 bg-white/70 hover:bg-white/80"
      }`}
    >
      <div className="w-11 shrink-0 text-center">
        {isToday ? (
          <p className="font-display text-[13px] italic leading-snug text-amber-700/80">Today</p>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.1em] text-stone-400">{topLabel}</p>
            <p className="text-lg font-medium leading-tight text-stone-700">{d.getDate()}</p>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] leading-snug text-stone-900">
          {sequence.theme || sequence.name || <span className="text-stone-400">Untitled class</span>}
        </p>
        {tagStyle && sequence.themeType && sequence.themeSub && (
          <span
            className="mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
            style={{ backgroundColor: tagStyle.bg, color: tagStyle.text, borderColor: tagStyle.border }}
          >
            {themeTagLabel(sequence.themeType, sequence.themeSub)}
          </span>
        )}
      </div>
      {teachable && (
        <Link
          href={`/sequence/${sequence.id}/teach`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
        >
          Teach
        </Link>
      )}
      {sequence.peakPose && (
        <div
          className="flex w-14 shrink-0 flex-col items-center rounded-xl border px-1.5 py-1.5 text-center"
          style={poseStyle
            ? { backgroundColor: poseStyle.bg, borderColor: poseStyle.border, color: poseStyle.text }
            : { backgroundColor: '#f7f6f4', borderColor: 'rgba(214,211,207,0.8)', color: '#57534e' }
          }
        >
          {getPoseIllustration(sequence.peakPose, "w-7 h-7")}
          <span className="break-words text-[10px] font-medium leading-tight">{sequence.peakPose}</span>
        </div>
      )}
    </article>
  );
}

function TeachingAheadStrip({
  items,
  onOpen,
}: {
  items: UpcomingItem[];
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 3);
  const hiddenCount = items.length - visible.length;

  return (
    <section className="mb-7">
      <p className="mb-2 font-display text-sm italic text-stone-400">Teaching ahead</p>
      <div className="space-y-2">
        {visible.map((item) => (
          <UpcomingRow
            key={item.sequence.id}
            item={item}
            onOpen={() => onOpen(item.sequence.id)}
          />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-stone-400 transition hover:text-stone-600"
        >
          {hiddenCount} more planned
        </button>
      )}
    </section>
  );
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

function SequenceCard({
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
              {formatDate(displayDate!)}
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

function InspirationCard({
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
          {formatDate(entry.date)}
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

function InspirationSheet({
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-stone-200 bg-white px-6 pb-8 pt-6 shadow-xl sm:rounded-3xl">
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
      </div>
    </div>,
    document.body
  );
}

function SelectionBar({
  count,
  onDuplicate,
  onDelete,
  onCancel,
}: {
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-300 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm">
      <span className="whitespace-nowrap px-3 text-sm font-medium text-stone-600">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-[#e8e3da] hover:text-stone-800"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      >
        ✕
      </button>
    </div>
  );
}

function EmptyState({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
      <p className="text-sm text-stone-500">No classes yet.</p>
      <Link
        href="/sequence/new"
        className="mt-4 inline-block rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
      >
        Plan your first class
      </Link>
      <p className="mt-3 text-[13px] text-stone-400">
        or{" "}
        <button
          type="button"
          onClick={onRestore}
          className="underline underline-offset-2 transition hover:text-stone-600"
        >
          restore from a backup
        </button>
      </p>
    </div>
  );
}

// ─── Example management ──────────────────────────────────────────────────────

function ExamplesNotice({ onRemove, onDismiss }: { onRemove: () => void; onDismiss: () => void }) {
  return (
    <div className="relative mb-5 border-l-2 border-stone-300/60 py-0.5 pl-4 pr-8">
      <p className="font-display text-sm italic leading-relaxed text-stone-500">
        The classes marked &ldquo;Example&rdquo; are here to show how the journal works.
      </p>
      <p className="mt-0.5 text-[13px] text-stone-400">
        <button
          type="button"
          onClick={onRemove}
          className="underline underline-offset-2 transition hover:text-stone-600"
        >
          Remove them
        </button>{" "}
        whenever you&rsquo;re ready, or{" "}
        <button
          type="button"
          onClick={onDismiss}
          className="underline underline-offset-2 transition hover:text-stone-600"
        >
          keep them and hide this
        </button>
        .
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide this notice and keep the examples"
        className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
        </svg>
      </button>
    </div>
  );
}

function RemoveExamplesModal({
  classCount,
  inspirationCount,
  onConfirm,
  onCancel,
}: {
  classCount: number;
  inspirationCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const parts = [`${classCount} example class${classCount === 1 ? "" : "es"}`];
  if (inspirationCount > 0) {
    parts.push(`${inspirationCount} example inspiration${inspirationCount === 1 ? "" : "s"}`);
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <p className="font-display text-base font-medium text-stone-800">Remove the examples?</p>
        <p className="mt-2 text-sm text-stone-500">
          This removes the {parts.join(" and ")}, including any changes you made to them.
          Your own classes aren&rsquo;t touched.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700"
          >
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function StartOverModal({
  ownClassCount,
  ownInspirationCount,
  onConfirm,
  onCancel,
}: {
  ownClassCount: number;
  ownInspirationCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const own: string[] = [];
  if (ownClassCount > 0) own.push(`${ownClassCount} class${ownClassCount === 1 ? "" : "es"}`);
  if (ownInspirationCount > 0) own.push(`${ownInspirationCount} inspiration${ownInspirationCount === 1 ? "" : "s"}`);
  const body = own.length > 0
    ? `This deletes your ${own.join(" and ")} and brings back the fresh examples. There is no undo.`
    : "This resets everything back to just the fresh examples. There is no undo.";
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <p className="font-display text-base font-medium text-stone-800">Start over?</p>
        <p className="mt-2 text-sm text-stone-500">{body}</p>
        {own.length > 0 && (
          <p className="mt-2 text-[13px] text-stone-400">
            <button
              type="button"
              onClick={() => exportBackup()}
              className="underline underline-offset-2 transition hover:text-stone-600"
            >
              Export a backup first
            </button>
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-800"
          >
            Start over
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function InspirationsEmptyState({ onNew }: { onNew: () => void }) {
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

function CuesEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
      <p className="text-sm text-stone-500">Your cue library is empty.</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-stone-400">
        Every cue you write onto a pose is quietly kept here, in your own words —
        ready to reuse, or to vary when a pose comes back around.
      </p>
    </div>
  );
}

/** One remembered cue: the pose it was written for, tap the words to reword or remove. */
function CueRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: CueEntry;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.text);

  const startEditing = () => { setDraft(entry.text); setEditing(true); };
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entry.text) onEdit(entry.id, trimmed);
    setEditing(false);
  };

  return (
    <article className="rounded-2xl border border-stone-200/70 bg-white/70 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] uppercase tracking-[0.15em] text-stone-400">{entry.pose}</p>
      {editing ? (
        <div className="mt-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[14px] leading-relaxed text-stone-800 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="text-[13px] text-rose-500 transition hover:text-rose-700"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-stone-500 transition hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-full bg-stone-800 px-4 py-1.5 text-[13px] font-medium text-stone-100 transition hover:bg-stone-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="mt-1 block w-full text-left text-[14px] italic leading-relaxed text-stone-700 transition hover:text-stone-900"
        >
          {entry.text}
        </button>
      )}
    </article>
  );
}

function CuesView({
  cues,
  query,
  onQueryChange,
  onEdit,
  onDelete,
}: {
  cues: CueEntry[];
  query: string;
  onQueryChange: (q: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? cues.filter(
        (c) => c.text.toLowerCase().includes(q) || c.pose.toLowerCase().includes(q),
      )
    : cues;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search your cues…"
        className="mb-4 w-full rounded-full border border-stone-200 bg-white/70 px-4 py-2.5 text-[14px] text-stone-800 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
      />
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400">
          No cues match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <CueRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImportModal({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const parts: string[] = [];
  if (preview.toAdd > 0) parts.push(`add ${preview.toAdd} class${preview.toAdd === 1 ? "" : "es"}`);
  if (preview.toUpdate > 0) parts.push(`update ${preview.toUpdate}`);
  const inspirationCount = preview.inspirationsToAdd + preview.inspirationsToUpdate;
  if (inspirationCount > 0) parts.push(`restore ${inspirationCount} inspiration${inspirationCount === 1 ? "" : "s"}`);
  const cueCount = preview.cuesToAdd + preview.cuesToUpdate;
  if (cueCount > 0) parts.push(`restore ${cueCount} cue${cueCount === 1 ? "" : "s"}`);
  const summary = parts.length > 0 ? parts.join(" and ") : "no changes";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <p className="font-display text-base font-medium text-stone-800">Restore from backup?</p>
        <p className="mt-2 text-sm text-stone-500">
          This will {summary}. Nothing you currently have will be deleted.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700"
          >
            Restore
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Backup-import flow shared by the data corner and the empty state: a hidden
 * file input, the parse step, and the confirmation modal. Render `elements`
 * once; call `openPicker` from any door.
 */
function useImportBackup(onImported: () => void) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    setError(null);
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseBackupFile(ev.target?.result as string);
        setError(null);
        setPreview(result);
      } catch {
        setError("That doesn't look like a backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirm = () => {
    if (!preview) return;
    applyImport(preview);
    setPreview(null);
    onImported();
  };

  const elements = (
    <>
      {preview && (
        <ImportModal
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={() => setPreview(null)}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );

  return { openPicker, error, elements };
}

// ─── Device sync ──────────────────────────────────────────────────────────────

function formatLastSynced(iso: string | null): string {
  if (!iso) return "not synced yet";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "synced just now";
  if (diff < 3_600_000) return `synced ${Math.floor(diff / 60_000)}m ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "synced today";
  if (days === 1) return "synced yesterday";
  return `synced ${days} days ago`;
}

function copyViaExecCommand(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy with fallbacks. The synchronous execCommand path runs FIRST: in
 * embedded browsers and webviews, navigator.clipboard.writeText can hang
 * forever on a permission that never resolves (not reject — hang), and by the
 * time any timeout fires the click's user activation may be spent. execCommand
 * is deprecated but synchronous, so it runs while the activation is certainly
 * live. The async API is the backup, raced against a timeout so a hang reads
 * as failure instead of silence. Returns whether anything actually copied.
 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (copyViaExecCommand(text)) return true;
  try {
    return await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800)),
    ]);
  } catch {
    return false;
  }
}

/** Select an element's full text — so a failed copy is one keystroke from a manual one. */
function selectContents(el: HTMLElement | null): void {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** Shows the sync link for safekeeping — the user's only way back in. */
function SyncLinkModal({ token, onClose }: { token: string; onClose: () => void }) {
  const link = syncLink(token);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const ok = await copyTextToClipboard(link);
    if (ok) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } else {
      // Leave the link selected so the user can copy it themselves.
      selectContents(linkRef.current);
      setCopyState("failed");
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <p className="font-display text-base font-medium text-stone-800">Your sync link</p>
        <p className="mt-2 text-sm text-stone-500">
          This link is how you open your library on another device — and the only
          way back in. Save it somewhere safe, and treat it like a password:
          anyone holding it can see and change your classes.
        </p>
        <p
          ref={linkRef}
          onClick={() => selectContents(linkRef.current)}
          className="mt-3 cursor-text break-all rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12px] text-stone-600 select-all"
        >
          {link}
        </p>
        {copyState === "failed" && (
          <p className="mt-2 text-[12px] text-amber-700/80">
            Copying isn&apos;t available in this browser — the link is selected above,
            copy it with {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘C" : "Ctrl+C"}.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            {copyState === "copied" ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Paste a sync link (or bare code) to bring this device into an existing library. */
function ConnectSyncModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectWithSyncInput(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect — try again.");
      setConnecting(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <p className="font-display text-base font-medium text-stone-800">Use a sync link</p>
        <p className="mt-2 text-sm text-stone-500">
          Paste the sync link (or code) from your other device. Anything already
          here is kept — the two libraries merge.
        </p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) void connect(); }}
          placeholder="https://…/#sync=…"
          autoFocus
          className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12px] text-stone-700 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
        {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={connecting || !input.trim()}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700 disabled:opacity-50"
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TurnOffSyncModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [deleteRemote, setDeleteRemote] = useState(false);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const ok = await copyTextToClipboard(syncLink(token));
    if (ok) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } else {
      // Can't copy programmatically here — reveal the link for a manual copy.
      setCopyState("failed");
      setTimeout(() => selectContents(linkRef.current), 0);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <p className="font-display text-base font-medium text-stone-800">Turn off sync?</p>
        <p className="mt-2 text-sm text-stone-500">
          Everything stays on this device; it just stops syncing. Unless you
          delete the cloud copy, your link keeps working —{" "}
          <button
            type="button"
            onClick={() => void copy()}
            className="underline underline-offset-2 transition hover:text-stone-700"
          >
            {copyState === "copied" ? "copied" : "copy it now"}
          </button>{" "}
          if you might want back in later.
        </p>
        {copyState === "failed" && (
          <p
            ref={linkRef}
            onClick={() => selectContents(linkRef.current)}
            className="mt-2 cursor-text break-all rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12px] text-stone-600 select-all"
          >
            {syncLink(token)}
          </p>
        )}
        <label className="mt-3 flex items-start gap-2 text-[13px] text-stone-500">
          <input
            type="checkbox"
            checked={deleteRemote}
            onChange={(e) => setDeleteRemote(e.target.checked)}
            className="mt-0.5 accent-stone-700"
          />
          Also delete the cloud copy (other devices keep their local data but stop syncing)
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void disconnectSync(deleteRemote);
              onClose();
            }}
            className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-800"
          >
            Turn off
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** The quiet sync line in the data footer: state on the left, doors on the right. */
function SyncRow() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus, getServerSyncStatus);
  const [linkOpen, setLinkOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [turnOffOpen, setTurnOffOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const token = status.enabled ? getSyncToken() : null;

  const handleTurnOn = async () => {
    setEnabling(true);
    try {
      await enableSync();
      setLinkOpen(true);
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 pb-3">
      {status.enabled && token ? (
        <>
          <span className={`text-[13px] ${status.error ? "text-amber-700/70" : "text-stone-400"}`}>
            {status.syncing
              ? "Syncing…"
              : status.error
                ? "Sync is catching up — changes are safe on this device"
                : `Synced across your devices · ${formatLastSynced(status.lastSyncedAt)}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="text-[13px] text-stone-400 transition hover:text-stone-600"
            >
              Sync link
            </button>
            <button
              type="button"
              onClick={() => setTurnOffOpen(true)}
              className="text-[13px] text-stone-400 transition hover:text-stone-600"
            >
              Turn off…
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="text-[13px] text-stone-400">On this device only</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleTurnOn()}
              disabled={enabling}
              className="text-[13px] text-stone-400 transition hover:text-stone-600 disabled:opacity-50"
            >
              {enabling ? "Turning on…" : "Sync across devices"}
            </button>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="text-[13px] text-stone-400 transition hover:text-stone-600"
            >
              I have a sync link
            </button>
          </div>
        </>
      )}
      {linkOpen && token && <SyncLinkModal token={token} onClose={() => setLinkOpen(false)} />}
      {connectOpen && <ConnectSyncModal onClose={() => setConnectOpen(false)} />}
      {turnOffOpen && token && <TurnOffSyncModal token={token} onClose={() => setTurnOffOpen(false)} />}
    </div>
  );
}

function BackupFooter({
  onImport,
  importError,
  onStartOver,
}: {
  onImport: () => void;
  importError: string | null;
  onStartOver: () => void;
}) {
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    setLastBackup(getLastBackupAt());
  }, []);

  const stale = (() => {
    if (!lastBackup) return true;
    const days = (Date.now() - new Date(lastBackup).getTime()) / 86_400_000;
    return days >= 14;
  })();

  const handleExport = () => {
    exportBackup();
    setLastBackup(new Date().toISOString());
  };

  return (
    <div className="mt-10 border-t border-stone-300/50 pt-4">
      <SyncRow />
      <div className="flex items-center justify-between gap-4">
        <span className={`text-[13px] ${stale ? "text-amber-700/70" : "text-stone-400"}`}>
          {formatLastBackup(lastBackup)}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="text-[13px] text-stone-400 transition hover:text-stone-600"
          >
            Export
          </button>
          <button
            type="button"
            onClick={onImport}
            className="text-[13px] text-stone-400 transition hover:text-stone-600"
          >
            Import
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="text-[13px] text-stone-400 transition hover:text-stone-600"
          >
            Start over…
          </button>
        </div>
      </div>
      {importError && (
        <p className="mt-2 text-[12px] text-rose-500">{importError}</p>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"classes" | "inspirations" | "cues">("classes");
  const [inspirations, setInspirations] = useState<InspirationEntry[]>([]);
  const [cues, setCues] = useState<CueEntry[]>([]);
  const [cueQuery, setCueQuery] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editingInspiration, setEditingInspiration] = useState<InspirationEntry | null>(null);
  const [removeExamplesOpen, setRemoveExamplesOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(true);

  const selectionMode = selectedIds.size > 0;
  const upcoming = upcomingTeachingItems(sequences);
  const exampleClassCount = sequences.filter((s) => isExampleSequence(s.id)).length;
  const exampleInspirationCount = inspirations.filter((e) => isExampleInspiration(e.id)).length;

  useEffect(() => {
    const reload = () => {
      const all = loadSequences();
      setSequences([...all].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
      setInspirations(
        [...loadInspirations()].sort((a, b) => b.date.localeCompare(a.date))
      );
      setCues(allCues());
      setNoticeDismissed(examplesNoticeDismissed());
      setLoaded(true);
    };
    reload();
    // Re-read when the tab regains focus (catches back-navigation from router cache)
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  const reloadInspirations = useCallback(() => {
    setInspirations(
      [...loadInspirations()].sort((a, b) => b.date.localeCompare(a.date))
    );
  }, []);

  const handleCueEdited = useCallback((id: string, text: string) => {
    updateCue(id, text);
    setCues(allCues());
  }, []);

  const handleCueDeleted = useCallback((id: string) => {
    deleteCue(id);
    setCues((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelection = (id: string) => {
    setSelectedIds((prev) => new Set(prev).add(id));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => deleteSequence(id));
    setSequences((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    clearSelection();
  };

  const handleDuplicateSelected = () => {
    // Duplicate in display order so the copies land together at the top.
    const copies: SequenceRecord[] = [];
    sequences
      .filter((s) => selectedIds.has(s.id))
      .forEach((s) => {
        const copy = duplicateSequence(s.id);
        if (copy) copies.push(copy);
      });
    if (copies.length) setSequences((prev) => [...copies.reverse(), ...prev]);
    clearSelection();
  };

  const handleDuplicateOne = useCallback((id: string) => {
    const copy = duplicateSequence(id);
    if (copy) setSequences((prev) => [copy, ...prev]);
  }, []);

  const handleDeleteOne = useCallback((id: string) => {
    deleteSequence(id);
    setSequences((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reloadSequences = useCallback(() => {
    const all = loadSequences();
    setSequences([...all].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
  }, []);

  // A sync pull can land data from another device at any time — re-read the lists.
  useEffect(
    () =>
      subscribeSyncApplied(() => {
        reloadSequences();
        reloadInspirations();
        setCues(allCues());
      }),
    [reloadSequences, reloadInspirations]
  );

  const handleInspirationSaved = useCallback((saved: InspirationEntry) => {
    setInspirations((prev) => {
      const without = prev.filter((e) => e.id !== saved.id);
      return [saved, ...without].sort((a, b) => b.date.localeCompare(a.date));
    });
    setCaptureOpen(false);
    setEditingInspiration(null);
  }, []);

  const handleInspirationDeleted = useCallback((id: string) => {
    deleteInspiration(id);
    setInspirations((prev) => prev.filter((e) => e.id !== id));
    setEditingInspiration(null);
  }, []);

  const importer = useImportBackup(() => {
    reloadSequences();
    reloadInspirations();
  });

  const handleStartClassFromInspiration = useCallback((entry: InspirationEntry) => {
    const now = new Date().toISOString();
    const noteBody = entry.source
      ? `${entry.note.trim()}\n\n— from ${entry.source}`
      : entry.note.trim();
    const id = generateId();
    saveSequence({
      id,
      name: "",
      notes: noteBody,
      dates: [],
      createdAt: now,
      updatedAt: now,
      sections: [{ id: generateId(), title: "New section", secondSide: false, poses: [] }],
    });
    router.push(`/sequence/${id}`);
  }, [router]);

  const handleRemoveExamples = () => {
    removeExampleSequences();
    removeExampleInspirations();
    reloadSequences();
    reloadInspirations();
    setRemoveExamplesOpen(false);
  };

  const handleDismissNotice = () => {
    dismissExamplesNotice();
    setNoticeDismissed(true);
  };

  const handleStartOver = () => {
    resetSequencesToSeeds();
    resetInspirationsToSeeds();
    reloadSequences();
    reloadInspirations();
    clearSelection();
    setNoticeDismissed(false);
    setStartOverOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Yoga Flow</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-stone-900">
                Library
              </h1>
            </div>
            <div className="mt-3 flex shrink-0 items-center">
              {activeTab === "classes" ? (
                <Link
                  href="/sequence/new"
                  className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700"
                >
                  + New class
                </Link>
              ) : activeTab === "inspirations" ? (
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700"
                >
                  + New inspiration
                </button>
              ) : null}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 rounded-full border border-stone-200 bg-stone-100/60 p-1 w-fit">
            <button
              type="button"
              onClick={() => { setActiveTab("classes"); clearSelection(); }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeTab === "classes"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Classes
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("inspirations"); clearSelection(); }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeTab === "inspirations"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Inspirations
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("cues"); clearSelection(); }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeTab === "cues"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Cues
            </button>
          </div>
        </header>

        {!loaded ? (
          <div className="py-16 text-center text-sm text-stone-400">Loading…</div>
        ) : activeTab === "classes" ? (
          sequences.length === 0 ? (
            <EmptyState onRestore={importer.openPicker} />
          ) : (
            <>
              {upcoming.length > 0 && !selectionMode && (
                <TeachingAheadStrip
                  items={upcoming}
                  onOpen={(id) => router.push(`/sequence/${id}`)}
                />
              )}
              {exampleClassCount > 0 && !selectionMode && !noticeDismissed && (
                <ExamplesNotice
                  onRemove={() => setRemoveExamplesOpen(true)}
                  onDismiss={handleDismissNotice}
                />
              )}
              {selectionMode && (
                <p className="mb-3 text-xs text-stone-400">
                  Tap to select · press and hold any card to start
                </p>
              )}
              <div className="space-y-3">
                {sequences.map((seq) => (
                  <SequenceCard
                    key={seq.id}
                    sequence={seq}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(seq.id)}
                    onOpen={() => router.push(`/sequence/${seq.id}`)}
                    onToggleSelect={() => toggleSelect(seq.id)}
                    onEnterSelection={() => enterSelection(seq.id)}
                    onDuplicate={() => handleDuplicateOne(seq.id)}
                    onDelete={() => handleDeleteOne(seq.id)}
                  />
                ))}
              </div>
            </>
          )
        ) : activeTab === "inspirations" ? (
          inspirations.length === 0 ? (
            <InspirationsEmptyState onNew={() => setCaptureOpen(true)} />
          ) : (
            <div className="space-y-3">
              {inspirations.map((entry) => (
                <InspirationCard
                  key={entry.id}
                  entry={entry}
                  onOpen={() => setEditingInspiration(entry)}
                  onStartClass={() => handleStartClassFromInspiration(entry)}
                />
              ))}
            </div>
          )
        ) : cues.length === 0 ? (
          <CuesEmptyState />
        ) : (
          <CuesView
            cues={cues}
            query={cueQuery}
            onQueryChange={setCueQuery}
            onEdit={handleCueEdited}
            onDelete={handleCueDeleted}
          />
        )}

        {loaded && activeTab === "classes" && (
          <BackupFooter
            onImport={importer.openPicker}
            importError={importer.error}
            onStartOver={() => setStartOverOpen(true)}
          />
        )}
      </main>

      {importer.elements}

      {removeExamplesOpen && (
        <RemoveExamplesModal
          classCount={exampleClassCount}
          inspirationCount={exampleInspirationCount}
          onConfirm={handleRemoveExamples}
          onCancel={() => setRemoveExamplesOpen(false)}
        />
      )}

      {startOverOpen && (
        <StartOverModal
          ownClassCount={sequences.length - exampleClassCount}
          ownInspirationCount={inspirations.length - exampleInspirationCount}
          onConfirm={handleStartOver}
          onCancel={() => setStartOverOpen(false)}
        />
      )}

      {selectionMode && (
        <SelectionBar
          count={selectedIds.size}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onCancel={clearSelection}
        />
      )}

      {captureOpen && (
        <InspirationSheet
          onSave={handleInspirationSaved}
          onClose={() => setCaptureOpen(false)}
        />
      )}

      {editingInspiration && (
        <InspirationSheet
          entry={editingInspiration}
          onSave={handleInspirationSaved}
          onDelete={() => handleInspirationDeleted(editingInspiration.id)}
          onClose={() => setEditingInspiration(null)}
        />
      )}
    </div>
  );
}
