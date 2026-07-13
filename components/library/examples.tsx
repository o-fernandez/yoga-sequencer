"use client";

import { exportBackup } from "@/lib/backup";
import { ConfirmDialog } from "@/components/modal";

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

export function StartOverModal({
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
  return (
    <ConfirmDialog
      title="Start over?"
      body={body}
      confirmLabel="Start over"
      tone="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
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
    </ConfirmDialog>
  );
}
