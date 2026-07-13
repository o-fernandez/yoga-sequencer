"use client";

import { useRef, useState } from "react";
import { applyImport, parseBackupFile, type ImportPreview } from "@/lib/backup";
import { ConfirmDialog } from "@/components/modal";

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

  return (
    <ConfirmDialog
      title="Restore from backup?"
      body={<>This will {summary}. Nothing you currently have will be deleted.</>}
      confirmLabel="Restore"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/**
 * Backup-import flow shared by the data corner and the empty state: a hidden
 * file input, the parse step, and the confirmation modal. Render `elements`
 * once; call `openPicker` from any door.
 */
export function useImportBackup(onImported: () => void) {
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
