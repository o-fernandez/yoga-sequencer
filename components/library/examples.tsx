"use client";

import { useState } from "react";
import { exportBackup } from "@/lib/backup";
import { getSyncToken } from "@/lib/sync";
import { ConfirmDialog, Modal } from "@/components/modal";

export function ExamplesNotice({ onRemove, onDismiss }: { onRemove: () => void; onDismiss: () => void }) {
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

export function RemoveExamplesModal({
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
  return (
    <ConfirmDialog
      title="Remove the examples?"
      body={
        <>
          This removes the {parts.join(" and ")}, including any changes you made to them.
          Your own classes aren&rsquo;t touched.
        </>
      }
      confirmLabel="Remove"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function BackupFirstLink() {
  return (
    <button
      type="button"
      onClick={() => exportBackup()}
      className="underline underline-offset-2 transition hover:text-stone-600"
    >
      Export a backup first
    </button>
  );
}

/**
 * "Start over" is two very different acts — removing the examples (harmless)
 * and erasing the user's own work (the most destructive action in the app,
 * with sync-wide reach). The dialog separates them: a chooser first, then a
 * dedicated confirm step for erasing that spells out the blast radius.
 */
export function StartOverModal({
  ownClassCount,
  ownInspirationCount,
  hasExamples,
  onRemoveExamples,
  onErase,
  onCancel,
}: {
  ownClassCount: number;
  ownInspirationCount: number;
  hasExamples: boolean;
  onRemoveExamples: () => void;
  onErase: () => void;
  onCancel: () => void;
}) {
  // With no examples to remove, the chooser has only one real option — go
  // straight to the erase confirm.
  const [step, setStep] = useState<"choose" | "erase">(hasExamples ? "choose" : "erase");
  const syncEnabled = getSyncToken() !== null;

  const own: string[] = [];
  if (ownClassCount > 0) own.push(`${ownClassCount} class${ownClassCount === 1 ? "" : "es"}`);
  if (ownInspirationCount > 0) own.push(`${ownInspirationCount} inspiration${ownInspirationCount === 1 ? "" : "s"}`);
  const ownSummary = own.length > 0 ? `your ${own.join(" and ")}` : null;

  if (step === "choose") {
    return (
      <Modal onDismiss={onCancel}>
        <p className="font-display text-base font-medium text-stone-800">Start over?</p>
        <p className="mt-1 text-[13px] text-stone-400">
          Two very different things — pick the one you mean.
        </p>
        <button
          type="button"
          onClick={onRemoveExamples}
          className="mt-4 block w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:bg-stone-100"
        >
          <span className="block text-sm font-medium text-stone-800">Remove the examples</span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-stone-500">
            {ownSummary
              ? <>Keeps {ownSummary}. The examples won&rsquo;t come back.</>
              : <>The examples won&rsquo;t come back.</>}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStep("erase")}
          className="mt-2.5 block w-full rounded-xl border border-stone-200 px-4 py-3 text-left transition hover:bg-stone-50"
        >
          <span className="block text-sm font-medium text-rose-700">Erase everything…</span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-stone-400">
            {ownSummary
              ? <>Deletes {ownSummary}, then brings back the fresh examples.</>
              : <>Clears this library and brings back the fresh examples.</>}
          </span>
        </button>
        <div className="mt-4 flex items-center justify-between text-[13px] text-stone-400">
          {ownSummary ? <BackupFirstLink /> : <span />}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3 py-1.5 font-medium text-stone-500 transition hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onDismiss={onCancel}>
      <p className="font-display text-base font-medium text-stone-800">Erase everything?</p>
      <p className="mt-2 text-sm text-stone-500">
        {ownSummary
          ? <>This deletes {ownSummary} and brings back the fresh examples. There is no undo.</>
          : <>This resets everything back to just the fresh examples. There is no undo.</>}
      </p>
      {syncEnabled && ownSummary && (
        <div className="mt-3 rounded-lg border border-rose-200/70 bg-rose-50/60 px-3.5 py-2.5">
          <p className="text-[13px] leading-relaxed text-rose-700">
            Sync is on — this also erases them from your other devices. It happens quickly
            and everywhere.
          </p>
        </div>
      )}
      {ownSummary && (
        <p className="mt-3 text-[13px] text-stone-400">
          <BackupFirstLink /> — takes a second, undoes anything.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={hasExamples ? () => setStep("choose") : onCancel}
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
        >
          {ownSummary ? "Keep my work" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={onErase}
          className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-800"
        >
          Erase everything
        </button>
      </div>
    </Modal>
  );
}
