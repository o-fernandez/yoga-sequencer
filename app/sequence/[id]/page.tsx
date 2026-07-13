"use client";

import { useState, useEffect, useReducer, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  generateId,
  loadSequence,
  saveSequence,
  roundsMultiplier,
  type TeachEntry,
  type ThemeType,
} from "@/lib/sequences";
import { sectionsReducer, type SectionsAction } from "@/lib/sections-reducer";
import type { PoseMeta } from "@/lib/poses";
import { rememberCue } from "@/lib/cues";
import { computePeakReadiness } from "@/lib/peak-readiness";
import { auditSequence } from "@/lib/sequence-audit";
import { ThemeIntentionField } from "@/components/builder/theme-field";
import { PeakPoseField } from "@/components/builder/peak-pose-field";
import { TeachingLog } from "@/components/builder/teaching-log";
import { CompactSectionBlock } from "@/components/builder/section-block";
import { AddPoseModal } from "@/components/builder/add-pose-modal";
import { SequenceAuditPanel } from "@/components/builder/audit-panel";
import { EnergyArc } from "@/components/builder/energy-arc";

/**
 * Derive a sequence name from a theme string by taking the first 3 content
 * words (skipping stop-words). Falls back to "Untitled class".
 */
function autoNameFromTheme(theme: string): string {
  const stop = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "by","is","are","was","were","your","my","our","their",
  ]);
  const words = theme
    .trim()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stop.has(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.join(" ");
}

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const isNew = id === "new";

  // Sequence metadata
  const [sequenceId] = useState(() => (isNew ? generateId() : id));
  const [theme, setTheme] = useState("");
  const [themeType, setThemeType] = useState<ThemeType | undefined>(undefined);
  const [themeSub, setThemeSub] = useState<string | undefined>(undefined);
  const [peakPose, setPeakPose] = useState<string | undefined>(undefined);
  const [dates, setDates] = useState<TeachEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // After the first save of a new sequence, mint a permanent URL.
  const redirectedRef = useRef(false);
  // Snapshot of the last state written to storage (or hydrated from it), so
  // autosave only fires on real edits. Merely opening a class must not bump
  // updatedAt — a no-op visit on one device would beat genuine offline edits
  // on another when sync merges by last-write-wins.
  const lastSavedRef = useRef<string | null>(null);

  // Builder state: every section/pose edit is a reducer action (lib/sections-reducer).
  const [sections, dispatchSections] = useReducer(sectionsReducer, []);
  const [addPoseTarget, setAddPoseTarget] = useState<{ sectionId: string; insertAfterPoseId?: string } | null>(null);

  /**
   * Route section edits through the reducer, intercepting cue writes to feed
   * the cue library on the way. Skips no-op re-saves of the same words so the
   * library's recency/frequency stays honest.
   */
  const dispatch = (action: SectionsAction) => {
    if (action.type === "set_cue" && action.cue) {
      const existing = sections.flatMap((s) => s.poses).find((p) => p.id === action.poseId);
      if (existing && action.cue !== existing.cue) rememberCue(existing.pose, action.cue);
    }
    dispatchSections(action);
  };

  useEffect(() => {
    // Hydrates client-only sequence state from browser storage.
    if (isNew) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreatedAt(new Date().toISOString());
      dispatchSections({ type: "hydrate", sections: [] });
      setLoaded(true);
      return;
    }
    const record = loadSequence(id);
    if (record) {
      // Migrate: 'peak-pose' themeType is no longer a chip; treat as unset
      const isLegacyPeakType = (record.themeType as string) === 'peak-pose';
      const hydrated = {
        theme: record.theme ?? "",
        themeType: isLegacyPeakType ? undefined : record.themeType,
        themeSub: isLegacyPeakType ? undefined : record.themeSub,
        peakPose: record.peakPose,
        notes: record.notes ?? "",
        dates: record.dates ?? [],
        sections: record.sections,
        showAnalysis: record.showAnalysis ?? false,
      };
      setTheme(hydrated.theme);
      setThemeType(hydrated.themeType);
      setThemeSub(hydrated.themeSub);
      setPeakPose(hydrated.peakPose);
      setNotes(hydrated.notes);
      setDates(hydrated.dates);
      setCreatedAt(record.createdAt);
      dispatchSections({ type: "hydrate", sections: hydrated.sections });
      setShowAnalysis(hydrated.showAnalysis);
      lastSavedRef.current = JSON.stringify(hydrated);
    } else {
      // Unknown or deleted id (stale bookmark, back-nav after delete): render
      // "not found" instead of seeding fresh state — autosaving that state
      // would recreate the record under the old id and resurrect it on sync.
      setNotFound(true);
    }
    setLoaded(true);
  }, [id, isNew]);

  // Autosave: debounced 800ms on any meaningful change.
  // For brand-new sequences, waits until there's real content before saving,
  // then mints a permanent URL so reloading doesn't spin up another blank.
  useEffect(() => {
    if (!loaded || notFound) return;
    // For new sequences, only start saving once there's real content: a theme,
    // notes, or at least one pose (new sequences start with empty sections, so
    // any pose is user intent).
    const hasContent =
      theme.trim() !== "" ||
      notes.trim() !== "" ||
      sections.some((s) => s.poses.length > 0);
    if (isNew && !hasContent) return;
    // Same shape and key order as the hydration snapshot above.
    const snapshot = JSON.stringify({
      theme, themeType, themeSub, peakPose, notes, dates, sections, showAnalysis,
    });
    if (snapshot === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      lastSavedRef.current = snapshot;
      saveSequence({
        id: sequenceId,
        name: autoNameFromTheme(theme.trim()) || theme.trim().slice(0, 40) || "",
        theme: theme.trim() || undefined,
        themeType: themeType || undefined,
        themeSub: themeSub || undefined,
        peakPose: peakPose || undefined,
        notes: notes.trim() || undefined,
        dates,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections,
        showAnalysis,
      });
      if (isNew && !redirectedRef.current) {
        redirectedRef.current = true;
        router.replace(`/sequence/${sequenceId}`);
      }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, theme, themeType, themeSub, peakPose, notes, dates, loaded, notFound, sequenceId, createdAt, showAnalysis]);

  // ── Handlers that pair a dispatch with page-level state ─────────────────────

  const handleAddPose = (sectionId: string, poseName: string, afterPoseId?: string) => {
    dispatch({ type: "add_pose", sectionId, pose: poseName, afterPoseId });
    setAddPoseTarget(null);
  };

  const handleAddPoses = (sectionId: string, poses: PoseMeta[]) => {
    dispatch({ type: "add_poses", sectionId, poses: poses.map((p) => p.pose) });
    setAddPoseTarget(null);
  };

  const addPrepPose = (poseName: string) => {
    dispatch({ type: "add_prep_before_peak", pose: poseName, peakPose });
  };

  // Marking a pose as peak fills the header field; clearing it empties the field.
  // Peak lives on the record as `peakPose` — one source of truth shared with the
  // header picker, so the two views can never disagree.
  const setPeakFromPose = (poseName: string | undefined) => {
    setPeakPose(poseName);
  };

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

  const handleThemeTypeChange = (newType: ThemeType | undefined) => {
    setThemeType(newType);
    setThemeSub(undefined);
  };

  if (loaded && notFound) {
    return (
      <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
        <main className="mx-auto w-full max-w-2xl py-24 text-center">
          <p className="text-stone-500">This class doesn&rsquo;t exist anymore.</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-stone-600 underline-offset-2 hover:underline"
          >
            Back to library
          </Link>
        </main>
      </div>
    );
  }

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
          <div className="flex items-center gap-3">
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
                title="Add a pose to teach this class"
              >
                Teach
              </span>
            )}
          </div>
        </div>

        {/* Scratch pad — raw notes, first and most prominent */}
        <div className="mb-6">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-stone-400">
            Notes &amp; ideas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What's on your mind? Poses, transitions, a theme, anything."
            autoFocus
            rows={4}
            className="w-full resize-none rounded-xl border border-stone-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
          />
        </div>
        <hr className="mb-8 border-stone-200/60" />

        {/* Sequence metadata header */}
        <header className="mb-8">
          {/* Theme / intention — this is the class title */}
          <ThemeIntentionField
            theme={theme}
            onThemeChange={setTheme}
            themeType={themeType}
            onThemeTypeChange={handleThemeTypeChange}
            themeSub={themeSub}
            onThemeSubChange={setThemeSub}
          />
          {/* Peak pose — independent of intention type */}
          <PeakPoseField value={peakPose} onChange={setPeakPose} />
        </header>

        {/* Teaching Log — anchor of the record, above the structural detail */}
        <TeachingLog dates={dates} onChange={setDates} />

        {/* Sequence builder */}
        <div className="mt-8 border-t border-stone-200/50 pt-8">
        {!loaded ? (
          <div className="py-16 text-center text-sm text-stone-400">Loading…</div>
        ) : (
          <>
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <span className="font-display text-lg font-light tracking-tight text-stone-800">
                Build your flow
              </span>
              <div className="flex items-baseline gap-4">
                {hasPoses && (
                  <p className="text-[10px] text-stone-400">
                    Tap a chip to expand. Thicker border = saved cue.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowAnalysis((v) => !v)}
                  className={`flex items-center gap-1 text-sm transition ${
                    showAnalysis
                      ? "font-medium text-stone-700"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  {showAnalysis && <span className="text-[10px] leading-none">✦</span>}
                  Analysis
                  <span className="text-[10px] leading-none">{showAnalysis ? "↘" : "↗"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {sections.map((section, sectionIdx) => (
                <CompactSectionBlock
                  key={section.id}
                  section={section}
                  peakPoseId={peakPoseId}
                  peakReadiness={peakReadiness}
                  firstPoseId={firstPoseId}
                  lastPoseId={lastPoseId}
                  canMoveUp={sectionIdx > 0}
                  canMoveDown={sectionIdx < sections.length - 1}
                  dispatch={dispatch}
                  onSetPeak={setPeakFromPose}
                  onOpenAddPose={(sectionId, afterPoseId) =>
                    setAddPoseTarget({ sectionId, insertAfterPoseId: afterPoseId })
                  }
                  onAddPrep={addPrepPose}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => dispatch({ type: "add_section" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-200 py-3 text-sm text-stone-400 transition hover:border-stone-300 hover:text-stone-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
                <circle cx="10" cy="10" r="7.5" />
                <path strokeLinecap="round" d="M10 7v6M7 10h6" />
              </svg>
              Add section
            </button>

            {showAnalysis && hasPoses && (
              <SequenceAuditPanel
                report={auditReport}
                onAction={(action) => dispatch({ type: "apply_audit_action", action })}
              />
            )}

            {showAnalysis && <EnergyArc sections={sections} />}
          </>
        )}
        </div>

        {/* Footer */}
        <footer className="mt-8">
          <div className="rounded-2xl bg-white/80 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-200/70">
            <p className="text-stone-500">
              {hasPoses
                ? `~${Math.max(5, Math.round(totalMinutes / 5) * 5)}-min class structure`
                : "Add poses to estimate class time"}
            </p>
          </div>
        </footer>
      </main>

      {/* Rendered outside <main> so backdrop-blur-sm doesn't create a stacking context that traps fixed positioning */}
      {addPoseTarget && addPoseTargetSection && (
        <AddPoseModal
          targetSection={addPoseTargetSection}
          onAdd={(sectionId, poseName) => handleAddPose(sectionId, poseName, addPoseTarget.insertAfterPoseId)}
          onAddMany={handleAddPoses}
          onClose={() => setAddPoseTarget(null)}
          onApplyTemplate={(sectionId, templateId) =>
            dispatch({ type: "append_template", sectionId, templateId })
          }
        />
      )}
    </div>
  );
}
