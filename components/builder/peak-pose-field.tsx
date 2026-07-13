"use client";

import { useEffect, useRef, useState } from "react";
import { allPoses } from "@/lib/poses";
import { searchPoses } from "@/lib/pose-matcher";

function PosePicker({
  value,
  onChange,
  onClose,
}: {
  value?: string;
  onChange: (pose: string | undefined) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const visiblePoses = search.trim() ? searchPoses(search.trim()) : allPoses;

  return (
    <div ref={ref} className="absolute left-0 top-full z-20 mt-1 flex max-h-72 w-72 flex-col rounded-xl border border-stone-200 bg-white shadow-lg">
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
        {visiblePoses.length === 0 ? (
          <p className="px-3 py-3 text-center text-sm text-stone-400">No poses found</p>
        ) : (
          visiblePoses.map((p) => (
            <button
              key={p.pose}
              type="button"
              onClick={() => { onChange(p.pose); onClose(); setSearch(""); }}
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
  );
}

export function PeakPoseField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (pose: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = value ? allPoses.find((p) => p.pose === value) : undefined;

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center gap-2">
        <hr className="flex-1 border-stone-200/70" />
        <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Peak pose</span>
        <hr className="flex-1 border-stone-200/70" />
      </div>
      <div className="relative">
        {value ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-sm text-stone-700 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <span aria-hidden className="text-amber-500 text-xs leading-none">△</span>
              <span className="font-medium">{value}</span>
              {meta?.sanskrit && (
                <span className="text-[11px] italic text-stone-400">{meta.sanskrit}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label="Remove peak pose"
              className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-300 px-3 py-1 text-sm text-stone-400 transition hover:border-stone-400 hover:text-stone-600"
          >
            <span aria-hidden className="text-stone-300 text-xs leading-none">△</span>
            Select pose…
          </button>
        )}
        {open && (
          <PosePicker
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
