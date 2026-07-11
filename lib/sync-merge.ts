/**
 * Pure merge logic for device sync. Records carry `updatedAt` (bumped on every
 * edit, including the edit that tombstones them) so two devices can be merged
 * with per-record last-write-wins: whichever side touched a record most
 * recently keeps it. Deletions are tombstones (`deletedAt` set) and compete
 * like any other edit — a delete made after the other device's last edit wins,
 * an edit made after the delete resurrects the record.
 */

export type Syncable = {
  id: string;
  updatedAt: string;
  deletedAt?: string;
};

/**
 * Last-write-wins by `updatedAt` (ISO strings compare lexically). Ties keep
 * the local copy. Local order is preserved; records only the remote knows
 * are appended.
 */
export function mergeRecords<T extends Syncable>(local: T[], remote: T[]): T[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((l) => l.id));
  const merged = local.map((l) => {
    const r = remoteById.get(l.id);
    return r && (r.updatedAt ?? "") > (l.updatedAt ?? "") ? r : l;
  });
  for (const r of remote) {
    if (!localIds.has(r.id)) merged.push(r);
  }
  return merged;
}

/**
 * Tombstones only exist to propagate deletions between devices; once every
 * device has had a chance to see one it is dead weight. 90 days is generous —
 * a device offline longer than that may resurrect a deleted record, which is
 * the acceptable failure mode.
 */
const TOMBSTONE_TTL_DAYS = 90;

export function withoutExpiredTombstones<T extends Syncable>(records: T[]): T[] {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_DAYS * 86_400_000).toISOString();
  return records.filter((r) => !r.deletedAt || r.deletedAt > cutoff);
}
