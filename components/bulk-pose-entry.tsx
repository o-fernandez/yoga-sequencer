"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { matchPose, parseQuickEntry, type MatchResult } from "@/lib/pose-matcher";
import { poseLibrary, type PoseMeta } from "@/lib/poses";
import { generateId } from "@/lib/sequences";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryRow = {
  id: string;
  raw: string;
  match: MatchResult;
  overridePose?: string;
  showPicker: boolean;
};

const ALL_POSES = poseLibrary.flatMap((cat) => cat.poses);

function findPose(name: string): PoseMeta | undefined {
  return ALL_POSES.find((p) => p.pose === name);
}

/** The pose a row resolves to, or null if it has no confident match. */
function rowPose(row: EntryRow): PoseMeta | null {
  if (row.overridePose) return findPose(row.overridePose) ?? null;
  if (row.match.confidence !== "none") return row.match.pose;
  return null;
}

// ─── Confidence pill ─────────────────────────────────────────────────────────

const CONFIDENCE_STYLES = {
  high:   "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-red-100 text-red-700",
  none:   "bg-stone-100 text-stone-500",
};

function ConfidencePill({ confidence }: { confidence: MatchResult["confidence"] }) {
  const label = confidence === "none" ? "no match" : confidence;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLES[confidence]}`}>
      {label}
    </span>
  );
}

// ─── Pose picker popover ──────────────────────────────────────────────────────

function PosePicker({
  value,
  alternatives,
  onSelect,
  onClose,
}: {
  value: string;
  alternatives: MatchResult["alternatives"];
  onSelect: (pose: string) => void;
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

  const query = search.trim().toLowerCase();
  const visibleCategories = poseLibrary
    .map((cat) => ({
      name: cat.category,
      poses: cat.poses.filter((p) =>
        !query || p.pose.toLowerCase().includes(query) ||
        (p.sanskrit ?? "").toLowerCase().includes(query)
      ),
    }))
    .filter((cat) => cat.poses.length > 0);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-1 flex max-h-72 w-72 flex-col rounded-xl border border-stone-200 bg-white shadow-xl"
    >
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

      {!query && alternatives.length > 0 && (
        <div className="border-b border-stone-100 px-3 pb-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Suggestions</p>
          <div className="flex flex-wrap gap-1">
            {alternatives.map((alt) => (
              <button
                key={alt.pose.pose}
                type="button"
                onClick={() => { onSelect(alt.pose.pose); onClose(); }}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs text-stone-600 hover:bg-[#e8e3da] hover:text-stone-800"
              >
                {alt.pose.pose}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-y-auto p-2 pt-1">
        {visibleCategories.map((cat) => (
          <div key={cat.name} className="mb-2">
            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-stone-400">
              {cat.name}
            </p>
            {cat.poses.map((p) => (
              <button
                key={p.pose}
                type="button"
                onClick={() => { onSelect(p.pose); onClose(); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  p.pose === value
                    ? "bg-[#e8e3da] font-medium text-stone-900"
                    : "text-stone-700 hover:bg-stone-50"
                }`}
              >
                <span>{p.pose}</span>
                {p.sanskrit && (
                  <span className="truncate text-[10px] italic text-stone-400">{p.sanskrit}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Entry row ─────────────────────────────────────────────────────────────────

function EntryRowItem({
  row,
  onOverride,
  onRemove,
}: {
  row: EntryRow;
  onOverride: (id: string, pose: string | undefined, showPicker: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const noMatch = row.match.confidence === "none" && !row.overridePose;
  const resolvedPose = row.overridePose ?? row.match.pose.pose;
  const confidence = row.overridePose ? "high" : row.match.confidence;
  const matchedOn = row.overridePose ? row.overridePose : row.match.matchedOn;
  const showsSanskrit =
    !row.overridePose &&
    !noMatch &&
    row.match.matchedOn !== row.match.pose.pose &&
    matchedOn !== resolvedPose;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <p className="w-32 shrink-0 truncate text-xs text-stone-400" title={row.raw}>
        {row.raw}
      </p>

      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-stone-300">
        <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L9.22 5.03a.75.75 0 0 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
      </svg>

      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOverride(row.id, undefined, !row.showPicker)}
          className={`text-left text-sm font-medium ${
            noMatch ? "text-stone-400 italic" : "text-stone-800 hover:text-stone-600"
          }`}
        >
          {noMatch ? "No match — tap to set" : resolvedPose}
        </button>
        {showsSanskrit && (
          <p className="text-[10px] italic text-stone-400">{matchedOn}</p>
        )}
        {row.showPicker && (
          <PosePicker
            value={resolvedPose}
            alternatives={row.match.alternatives}
            onSelect={(pose) => onOverride(row.id, pose, false)}
            onClose={() => onOverride(row.id, undefined, false)}
          />
        )}
      </div>

      <ConfidencePill confidence={confidence} />

      <button
        type="button"
        onClick={() => onRemove(row.id)}
        className="shrink-0 rounded-md p-1 text-stone-300 transition hover:bg-red-50 hover:text-red-400"
        aria-label="Remove"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Web Speech API (not in the default TS lib) ────────────────────────────────

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEvent {
  results: ArrayLike<SpeechRecognitionResult>;
}
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

// ─── Bulk pose entry ───────────────────────────────────────────────────────────

const DEFAULT_PLACEHOLDER =
  "mountain pose, extended mountain, forward fold, half lift, chaturanga, updog, downdog, low lunge, low lunge twist…";

export function BulkPoseEntry({
  autoFocus = false,
  placeholder = DEFAULT_PLACEHOLDER,
  renderFooter,
}: {
  autoFocus?: boolean;
  placeholder?: string;
  /** Receives the poses that resolved to a confident match or manual override. */
  renderFooter: (resolved: PoseMeta[]) => ReactNode;
}) {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Parse input live, preserving override/picker state for unchanged tokens.
  useEffect(() => {
    const tokens = parseQuickEntry(input);
    if (tokens.length === 0) {
      setRows([]);
      return;
    }
    setRows((prev) =>
      tokens.map((token, i) => {
        const existing = prev[i];
        if (existing && existing.raw === token) return existing;
        return {
          id: existing?.id ?? generateId(),
          raw: token,
          match: matchPose(token),
          overridePose: undefined,
          showPicker: false,
        };
      })
    );
  }, [input]);

  const handleOverride = useCallback(
    (id: string, pose: string | undefined, showPicker: boolean) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, overridePose: pose ?? r.overridePose, showPicker } : r
        )
      );
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setInput(next.map((r) => r.raw).join(", "));
      return next;
    });
  }, []);

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(", ");
      setInput((prev) => (prev.trim() ? `${prev.trim()}, ${transcript}` : transcript));
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  const resolved = rows.map(rowPose).filter((p): p is PoseMeta => p !== null);
  const lowConfidenceCount = rows.filter(
    (r) => !r.overridePose && (r.match.confidence === "low" || r.match.confidence === "none")
  ).length;

  return (
    <div>
      {/* Input */}
      <div className="rounded-2xl border border-stone-300/40 bg-white/70 p-4 shadow-sm ring-1 ring-stone-300/30">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          rows={4}
          autoFocus={autoFocus}
          className="w-full resize-none bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between border-t border-stone-200/80 pt-3">
          <p className="text-xs text-stone-400">
            {rows.length > 0
              ? `${rows.length} item${rows.length === 1 ? "" : "s"} parsed`
              : "Separate poses with commas or new lines"}
          </p>
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isListening
                  ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                  : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 ${isListening ? "animate-pulse" : ""}`}>
                <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
                <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
              </svg>
              {isListening ? "Listening…" : "Dictate"}
            </button>
          )}
        </div>
      </div>

      {/* Matched rows */}
      {rows.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
              Matched poses
            </p>
            {lowConfidenceCount > 0 && (
              <p className="text-xs text-amber-600">
                {lowConfidenceCount} need{lowConfidenceCount === 1 ? "s" : ""} review
              </p>
            )}
          </div>
          {rows.map((row) => (
            <EntryRowItem
              key={row.id}
              row={row}
              onOverride={handleOverride}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {rows.length > 0 && (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-500">
            {resolved.length} of {rows.length} matched
          </p>
          {renderFooter(resolved)}
        </div>
      )}
    </div>
  );
}
