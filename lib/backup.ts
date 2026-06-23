import { loadSequences, localTodayISO, saveSequence, migrateRecord, type SequenceRecord } from "./sequences";
import { loadInspirations, saveInspiration, type InspirationEntry } from "./inspirations";
import { loadCues, saveCue, type CueEntry } from "./cues";

const SCHEMA_VERSION = 3;
const BACKUP_TS_KEY = "yoga-backup-last";

type BackupEnvelope = {
  schemaVersion: number;
  exportedAt: string;
  sequences: SequenceRecord[];
  /** Added in schema v2; v1 backups won't have it. */
  inspirations?: InspirationEntry[];
  /** Added in schema v3; older backups won't have it. */
  cues?: CueEntry[];
};

export function exportBackup(): void {
  const envelope: BackupEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sequences: loadSequences(),
    inspirations: loadInspirations(),
    cues: loadCues(),
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yoga-sequences-backup-${localTodayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(BACKUP_TS_KEY, new Date().toISOString());
}

export type ImportPreview = {
  toAdd: number;
  toUpdate: number;
  inspirationsToAdd: number;
  inspirationsToUpdate: number;
  cuesToAdd: number;
  cuesToUpdate: number;
  records: SequenceRecord[];
  inspirations: InspirationEntry[];
  cues: CueEntry[];
};

export function parseBackupFile(text: string): ImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("schemaVersion" in parsed) ||
    !("sequences" in parsed) ||
    !Array.isArray((parsed as BackupEnvelope).sequences)
  ) {
    throw new Error("invalid");
  }

  const envelope = parsed as BackupEnvelope;
  const records = envelope.sequences.map(migrateRecord);
  const inspirations = Array.isArray(envelope.inspirations) ? envelope.inspirations : [];
  const cues = Array.isArray(envelope.cues) ? envelope.cues : [];

  const existing = loadSequences();
  const existingIds = new Set(existing.map((s) => s.id));
  const toAdd = records.filter((r) => !existingIds.has(r.id)).length;
  const toUpdate = records.filter((r) => existingIds.has(r.id)).length;

  const existingInspirationIds = new Set(loadInspirations().map((e) => e.id));
  const inspirationsToAdd = inspirations.filter((e) => !existingInspirationIds.has(e.id)).length;
  const inspirationsToUpdate = inspirations.filter((e) => existingInspirationIds.has(e.id)).length;

  const existingCueIds = new Set(loadCues().map((c) => c.id));
  const cuesToAdd = cues.filter((c) => !existingCueIds.has(c.id)).length;
  const cuesToUpdate = cues.filter((c) => existingCueIds.has(c.id)).length;

  return {
    toAdd,
    toUpdate,
    inspirationsToAdd,
    inspirationsToUpdate,
    cuesToAdd,
    cuesToUpdate,
    records,
    inspirations,
    cues,
  };
}

export function applyImport(preview: ImportPreview): void {
  for (const record of preview.records) {
    saveSequence(record);
  }
  for (const entry of preview.inspirations) {
    saveInspiration(entry);
  }
  for (const cue of preview.cues) {
    saveCue(cue);
  }
}

export function getLastBackupAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BACKUP_TS_KEY);
}

export function formatLastBackup(iso: string | null): string {
  if (!iso) return "Never backed up";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Last backup today";
  if (days === 1) return "Last backup yesterday";
  if (days < 14) return `Last backup ${days} days ago`;
  const weeks = Math.round(days / 7);
  return `Last backup ${weeks} week${weeks === 1 ? "" : "s"} ago`;
}
