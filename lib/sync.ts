/**
 * Device sync, local-first: localStorage stays the source of truth and the app
 * never waits on the network. A secret link is the whole identity — the token
 * in it names one cloud copy of the library, and anyone holding the link can
 * read and write that copy.
 *
 * Flow: every local mutation (via lib/data-changed) schedules a debounced push
 * of the full backup envelope. On boot (and when connecting a new device) we
 * pull the cloud copy, merge it record-by-record (last-write-wins by
 * updatedAt, tombstones carrying deletions), apply the merge locally, then
 * push the merged result back. The server keeps a revision counter; a push
 * against a stale revision returns 409 with the newer copy, which we merge
 * and retry — so two devices writing near-simultaneously converge instead of
 * clobbering each other.
 */

import { buildBackupEnvelope, type BackupEnvelope } from "./backup";
import { mergeRecords } from "./sync-merge";
import {
  applyExampleFlags,
  examplesCleared,
  isExampleSequence,
  migrateRecord,
  replaceAllSequences,
} from "./sequences";
import { isExampleInspiration, replaceAllInspirations } from "./inspirations";
import { replaceAllCues } from "./cues";
import { onDataChanged } from "./data-changed";

const TOKEN_KEY = "yoga-sync-token";
const REV_KEY = "yoga-sync-rev";
const LAST_SYNCED_KEY = "yoga-sync-last";
const PUSH_DEBOUNCE_MS = 2_500;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

// ─── Status (for the library footer UI) ─────────────────────────────────────

export type SyncStatus = {
  enabled: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
};

const statusListeners = new Set<(s: SyncStatus) => void>();
const appliedListeners = new Set<() => void>();
let syncing = false;
let lastError: string | null = null;

const SERVER_STATUS: SyncStatus = { enabled: false, syncing: false, error: null, lastSyncedAt: null };
// Cached so getSyncStatus is a stable snapshot getter for useSyncExternalStore.
let statusSnapshot: SyncStatus | null = null;

function computeStatus(): SyncStatus {
  return {
    enabled: getSyncToken() !== null,
    syncing,
    error: lastError,
    lastSyncedAt: localStorage.getItem(LAST_SYNCED_KEY),
  };
}

export function getSyncStatus(): SyncStatus {
  if (typeof window === "undefined") return SERVER_STATUS;
  if (!statusSnapshot) statusSnapshot = computeStatus();
  return statusSnapshot;
}

export function getServerSyncStatus(): SyncStatus {
  return SERVER_STATUS;
}

export function subscribeSync(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

/** Fires after a pull changed local data — pages re-read their lists on this. */
export function subscribeSyncApplied(fn: () => void): () => void {
  appliedListeners.add(fn);
  return () => appliedListeners.delete(fn);
}

function notifyStatus(): void {
  statusSnapshot = computeStatus();
  for (const fn of statusListeners) fn(statusSnapshot);
}

// ─── Token & link ────────────────────────────────────────────────────────────

export function getSyncToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

function generateToken(): string {
  const bytes = new Uint8Array(18); // 144 bits — the whole security of the link
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The link the user keeps. Token rides in the fragment so it never reaches server logs. */
export function syncLink(token: string): string {
  return `${window.location.origin}/#sync=${token}`;
}

/** Accepts a full sync link, a pasted URL, or the bare code. */
export function parseSyncInput(input: string): string | null {
  const trimmed = input.trim();
  const fromHash = trimmed.match(/[#&?]sync=([A-Za-z0-9_-]+)/)?.[1] ?? trimmed;
  return TOKEN_PATTERN.test(fromHash) ? fromHash : null;
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

type PullResult =
  | { kind: "found"; rev: number; envelope: BackupEnvelope }
  | { kind: "empty" };

async function apiGet(token: string): Promise<PullResult> {
  const res = await fetch("/api/sync", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404) return { kind: "empty" };
  if (!res.ok) throw new Error(`sync fetch failed (${res.status})`);
  const body = (await res.json()) as { rev: number; envelope: BackupEnvelope };
  return { kind: "found", rev: body.rev, envelope: body.envelope };
}

async function apiPut(
  token: string,
  baseRev: number,
  envelope: BackupEnvelope
): Promise<{ ok: true; rev: number } | { ok: false; rev: number; envelope: BackupEnvelope }> {
  const res = await fetch("/api/sync", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ baseRev, envelope }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { rev: number; envelope: BackupEnvelope };
    return { ok: false, rev: body.rev, envelope: body.envelope };
  }
  if (!res.ok) throw new Error(`sync push failed (${res.status})`);
  const body = (await res.json()) as { rev: number };
  return { ok: true, rev: body.rev };
}

// ─── Merge & apply ───────────────────────────────────────────────────────────

function getRev(): number {
  return Number(localStorage.getItem(REV_KEY) ?? 0);
}

function setRev(rev: number): void {
  localStorage.setItem(REV_KEY, String(rev));
}

/** Merge the cloud copy into local storage. Returns true if anything local changed. */
function applyRemote(remote: BackupEnvelope): boolean {
  const local = buildBackupEnvelope();

  let localSequences = local.sequences;
  let localInspirations = local.inspirations ?? [];
  if (remote.flags?.examplesCleared && !examplesCleared()) {
    // The other device removed the examples. This device may have freshly
    // seeded its own copies — drop them before merging so they can't resurrect.
    localSequences = localSequences.filter((s) => !isExampleSequence(s.id));
    localInspirations = localInspirations.filter((e) => !isExampleInspiration(e.id));
  }

  const mergedSequences = mergeRecords(localSequences, remote.sequences.map(migrateRecord));
  const mergedInspirations = mergeRecords(localInspirations, remote.inspirations ?? []);
  const mergedCues = mergeRecords(local.cues ?? [], remote.cues ?? []);

  applyExampleFlags(remote.flags);
  replaceAllSequences(mergedSequences);
  replaceAllInspirations(mergedInspirations);
  replaceAllCues(mergedCues);

  const changed =
    JSON.stringify(mergedSequences) !== JSON.stringify(local.sequences) ||
    JSON.stringify(mergedInspirations) !== JSON.stringify(local.inspirations ?? []) ||
    JSON.stringify(mergedCues) !== JSON.stringify(local.cues ?? []);
  if (changed) for (const fn of appliedListeners) fn();
  return changed;
}

// ─── Push (debounced) ────────────────────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pushQueued = false;

function schedulePush(): void {
  if (!getSyncToken()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), PUSH_DEBOUNCE_MS);
}

async function pushNow(): Promise<void> {
  const token = getSyncToken();
  if (!token) return;
  if (pushing) {
    pushQueued = true;
    return;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  pushing = true;
  syncing = true;
  notifyStatus();
  try {
    // One 409-merge-retry round; a second conflict just waits for the next push.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await apiPut(token, getRev(), buildBackupEnvelope());
      if (result.ok) {
        setRev(result.rev);
        localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
        lastError = null;
        break;
      }
      applyRemote(result.envelope);
      setRev(result.rev);
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "sync failed";
  } finally {
    pushing = false;
    syncing = false;
    notifyStatus();
    if (pushQueued) {
      pushQueued = false;
      schedulePush();
    }
  }
}

// ─── Pull on boot / connect ──────────────────────────────────────────────────

async function pullMergePush(): Promise<void> {
  const token = getSyncToken();
  if (!token) return;
  syncing = true;
  notifyStatus();
  try {
    const result = await apiGet(token);
    if (result.kind === "found") {
      applyRemote(result.envelope);
      setRev(result.rev);
    }
    lastError = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : "sync failed";
    syncing = false;
    notifyStatus();
    return;
  }
  syncing = false;
  await pushNow();
}

// ─── Public control surface ──────────────────────────────────────────────────

/** Turn sync on for the first time. Returns the token to show the user. */
export async function enableSync(): Promise<string> {
  const token = generateToken();
  localStorage.setItem(TOKEN_KEY, token);
  setRev(0);
  notifyStatus();
  await pushNow();
  return token;
}

/** Connect this device to an existing sync link, merging the cloud copy with what's here. */
export async function connectWithSyncInput(input: string): Promise<void> {
  const token = parseSyncInput(input);
  if (!token) throw new Error("That doesn't look like a sync link or code.");
  localStorage.setItem(TOKEN_KEY, token);
  setRev(0);
  notifyStatus();
  await pullMergePush();
}

/** Stop syncing this device. Optionally delete the cloud copy for every device. */
export async function disconnectSync(deleteRemote: boolean): Promise<void> {
  const token = getSyncToken();
  if (deleteRemote && token) {
    try {
      await fetch("/api/sync", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best effort — the local disconnect still proceeds.
    }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REV_KEY);
  localStorage.removeItem(LAST_SYNCED_KEY);
  lastError = null;
  notifyStatus();
}

/**
 * Adopt a token arriving in the page URL (#sync=…) — the "open your link on a
 * new device" path. Ignored when this device is already connected to a
 * different link, so a stray click can't silently rewire an existing setup.
 */
export function adoptLinkToken(token: string): "connected" | "already" | "ignored" {
  const current = getSyncToken();
  if (current === token) return "already";
  if (current) {
    console.warn("Ignoring sync link: this device is already connected to a different one.");
    return "ignored";
  }
  localStorage.setItem(TOKEN_KEY, token);
  setRev(0);
  notifyStatus();
  void pullMergePush();
  return "connected";
}

let initialized = false;

/** Wire the engine up once per page load (called from the layout boot component). */
export function initSyncClient(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  onDataChanged(schedulePush);
  // Flush a pending debounced push when the tab goes to the background —
  // closing the PWA mid-debounce shouldn't lose the last edit.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) void pushNow();
  });
  if (getSyncToken()) void pullMergePush();
}
