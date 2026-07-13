"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The one dialog shell: dimmed backdrop, centered card. `sheet` slides the
 * card to the bottom edge on small screens (the capture-on-the-go pattern).
 * Pass `onDismiss` to let a tap on the backdrop close the dialog; omit it for
 * dialogs that should only close through their own buttons.
 */
export function Modal({
  children,
  onDismiss,
  sheet = false,
}: {
  children: ReactNode;
  onDismiss?: () => void;
  sheet?: boolean;
}) {
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-stone-900/40 backdrop-blur-sm ${
        sheet ? "items-end sm:items-center" : "items-center"
      }`}
      onPointerDown={
        onDismiss ? (e) => { if (e.target === e.currentTarget) onDismiss(); } : undefined
      }
    >
      <div
        className={
          sheet
            ? "w-full max-w-lg rounded-t-3xl border border-stone-200 bg-white px-6 pb-8 pt-6 shadow-xl sm:rounded-3xl"
            : "mx-6 w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        }
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * Title + body + Cancel/confirm, for the yes-or-no moments. `children` renders
 * between the body and the buttons for an optional extra line (a backup link,
 * a checkbox). `tone: "danger"` colors the confirm button for destructive acts.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = "neutral",
  children,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "neutral" | "danger";
  children?: ReactNode;
}) {
  return (
    <Modal>
      <p className="font-display text-base font-medium text-stone-800">{title}</p>
      <p className="mt-2 text-sm text-stone-500">{body}</p>
      {children}
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
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tone === "danger"
              ? "bg-rose-700 text-rose-50 hover:bg-rose-800"
              : "bg-stone-800 text-stone-100 hover:bg-stone-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
