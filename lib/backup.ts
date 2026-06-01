import { loadSequences, saveSequence, migrateRecord, type SequenceRecord } from "./sequences";

const SCHEMA_VERSION = 1;
const BACKUP_TS_KEY = "yoga-backup-last";

type BackupEnvelope = {
  schemaVersion: number;
  exportedAt: string;
  sequences: SequenceRecord[];
};

export function exportBackup(): void {
  const sequences = loadSequences();
  const envelope: BackupEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sequences,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yoga-sequences-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(BACKUP_TS_KEY, new Date().toISOString());
}

export type ImportPreview = {
  toAdd: number;
  toUpdate: number;
  records: SequenceRecord[];
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

  const existing = loadSequences();
  const existingIds = new Set(existing.map((s) => s.id));
  const toAdd = records.filter((r) => !existingIds.has(r.id)).length;
  const toUpdate = records.filter((r) => existingIds.has(r.id)).length;

  return { toAdd, toUpdate, records };
}

export function applyImport(records: SequenceRecord[]): void {
  for (const record of records) {
    saveSequence(record);
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
