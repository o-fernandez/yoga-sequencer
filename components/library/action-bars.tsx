"use client";

/** Floating bar while cards are selected: count, bulk actions, cancel. */
export function SelectionBar({
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

/** Quiet confirmation after a delete, with the way back. Deletes are tombstones, so undo just clears the flag. */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-300 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm">
      <span className="whitespace-nowrap px-3 text-sm text-stone-600">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-[#e8e3da] hover:text-stone-900"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      >
        ✕
      </button>
    </div>
  );
}
