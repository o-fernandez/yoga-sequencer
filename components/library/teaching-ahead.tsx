"use client";

import { useState } from "react";
import Link from "next/link";
import { localTodayISO, type SequenceRecord } from "@/lib/sequences";
import { themePoseStyle, themeTagLabel, themeTagStyle } from "@/lib/themes";
import { getPoseIllustration } from "@/lib/pose-illustrations";

export type UpcomingItem = { sequence: SequenceRecord; date: string; isToday: boolean };

/** Soonest planned date (today or later) per sequence, soonest first. */
export function upcomingTeachingItems(sequences: SequenceRecord[]): UpcomingItem[] {
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

export function TeachingAheadStrip({
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
