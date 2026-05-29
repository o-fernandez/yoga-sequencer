"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BulkPoseEntry } from "@/components/bulk-pose-entry";
import { type PoseMeta } from "@/lib/poses";
import { generateId, saveSequence, type Section } from "@/lib/sequences";

export default function QuickEntryPage() {
  const router = useRouter();

  const handleCreateSequence = (poses: PoseMeta[]) => {
    if (poses.length === 0) return;

    const section: Section = {
      id: generateId(),
      title: "Quick entry",
      secondSide: false,
      poses: poses.map((p) => ({
        id: generateId(),
        pose: p.pose,
        duration: p.duration,
        minutes: p.minutes,
      })),
    };

    const trailingEmpty: Section = {
      id: generateId(),
      title: "New section",
      secondSide: false,
      poses: [],
    };

    const newId = generateId();
    saveSequence({
      id: newId,
      name: "Quick entry sequence",
      dates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [section, trailingEmpty],
    });

    router.push(`/sequence/${newId}`);
  };

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl">
        {/* Back nav */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            Library
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Yoga Flow</p>
        </div>

        <header className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Quick entry</p>
          <h1 className="mt-2 text-4xl font-light tracking-tight text-stone-900">
            Paste your notes
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Type or paste a list of poses — commas or new lines work. English names,
            Sanskrit, or common nicknames are all fair game.
          </p>
        </header>

        <BulkPoseEntry
          autoFocus
          renderFooter={(resolved) => (
            <button
              type="button"
              disabled={resolved.length === 0}
              onClick={() => handleCreateSequence(resolved)}
              className="rounded-full bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create sequence →
            </button>
          )}
        />
      </main>
    </div>
  );
}
