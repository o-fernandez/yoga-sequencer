"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  exportBackup,
  getLastBackupAt,
  formatLastBackup,
  dataCardDismissed,
  dismissDataCard,
} from "@/lib/backup";
import {
  connectWithSyncInput,
  disconnectSync,
  enableSync,
  getServerSyncStatus,
  getSyncStatus,
  getSyncToken,
  subscribeSync,
  syncLink,
} from "@/lib/sync";
import { copyTextToClipboard, selectContents } from "@/lib/clipboard";
import { Modal } from "@/components/modal";

function formatLastSynced(iso: string | null): string {
  if (!iso) return "not synced yet";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "synced just now";
  if (diff < 3_600_000) return `synced ${Math.floor(diff / 60_000)}m ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "synced today";
  if (days === 1) return "synced yesterday";
  return `synced ${days} days ago`;
}

/** Shows the sync link for safekeeping — the user's only way back in. */
function SyncLinkModal({
  token,
  onClose,
  onTurnOff,
}: {
  token: string;
  onClose: () => void;
  onTurnOff?: () => void;
}) {
  const link = syncLink(token);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const ok = await copyTextToClipboard(link);
    if (ok) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } else {
      // Leave the link selected so the user can copy it themselves.
      selectContents(linkRef.current);
      setCopyState("failed");
    }
  };
  return (
    <Modal>
      <p className="font-display text-base font-medium text-stone-800">Your sync link</p>
      <p className="mt-2 text-sm text-stone-500">
        This link is how you open your library on another device — and the only
        way back in. Save it somewhere safe, and treat it like a password:
        anyone holding it can see and change your classes.
      </p>
      <p
        ref={linkRef}
        onClick={() => selectContents(linkRef.current)}
        className="mt-3 cursor-text break-all rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12px] text-stone-600 select-all"
      >
        {link}
      </p>
      {copyState === "failed" && (
        <p className="mt-2 text-[12px] text-amber-700/80">
          Copying isn&apos;t available in this browser — the link is selected above,
          copy it with {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘C" : "Ctrl+C"}.
        </p>
      )}
      <div className="mt-5 flex items-center justify-between gap-2">
        {onTurnOff ? (
          <button
            type="button"
            onClick={onTurnOff}
            className="text-[13px] text-stone-400 transition hover:text-stone-600"
          >
            Turn off sync…
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
          >
            {copyState === "copied" ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Paste a sync link (or bare code) to bring this device into an existing library. */
function ConnectSyncModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectWithSyncInput(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect — try again.");
      setConnecting(false);
    }
  };
  return (
    <Modal>
      <p className="font-display text-base font-medium text-stone-800">Use a sync link</p>
      <p className="mt-2 text-sm text-stone-500">
        Paste the sync link (or code) from your other device. Anything already
        here is kept — the two libraries merge.
      </p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) void connect(); }}
        placeholder="https://…/#sync=…"
        autoFocus
        className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12px] text-stone-700 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
      />
      {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting || !input.trim()}
          className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700 disabled:opacity-50"
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </div>
    </Modal>
  );
}

function TurnOffSyncModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [deleteRemote, setDeleteRemote] = useState(false);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const ok = await copyTextToClipboard(syncLink(token));
    if (ok) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } else {
      // Can't copy programmatically here — reveal the link for a manual copy.
      setCopyState("failed");
      setTimeout(() => selectContents(linkRef.current), 0);
    }
  };
  return (
    <Modal>
      <p className="font-display text-base font-medium text-stone-800">Turn off sync?</p>
      <p className="mt-2 text-sm text-stone-500">
        Everything stays on this device; it just stops syncing. Unless you
        delete the cloud copy, your link keeps working —{" "}
        <button
          type="button"
          onClick={() => void copy()}
          className="underline underline-offset-2 transition hover:text-stone-700"
        >
          {copyState === "copied" ? "copied" : "copy it now"}
        </button>{" "}
        if you might want back in later.
      </p>
      {copyState === "failed" && (
        <p
          ref={linkRef}
          onClick={() => selectContents(linkRef.current)}
          className="mt-2 cursor-text break-all rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12px] text-stone-600 select-all"
        >
          {syncLink(token)}
        </p>
      )}
      <label className="mt-3 flex items-start gap-2 text-[13px] text-stone-500">
        <input
          type="checkbox"
          checked={deleteRemote}
          onChange={(e) => setDeleteRemote(e.target.checked)}
          className="mt-0.5 accent-stone-700"
        />
        Also delete the cloud copy (other devices keep their local data but stop syncing)
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            void disconnectSync(deleteRemote);
            onClose();
          }}
          className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-800"
        >
          Turn off
        </button>
      </div>
    </Modal>
  );
}

/** The one door to sync for devices without the choice card: create a link, or use an existing one. */
function SyncStartModal({
  enabling,
  onCreate,
  onConnect,
  onClose,
}: {
  enabling: boolean;
  onCreate: () => void;
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <Modal>
      <p className="font-display text-base font-medium text-stone-800">Sync across devices</p>
      <p className="mt-2 text-sm text-stone-500">
        One library on every device you teach from, kept current by a private
        link — no account needed.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={enabling}
          className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-stone-700 disabled:opacity-50"
        >
          {enabling ? "Creating your link…" : "Create my sync link"}
        </button>
        <button
          type="button"
          onClick={onConnect}
          className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
        >
          I already have a link
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] text-stone-400 transition hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/**
 * The library's data story, in one place. Three states: a choice card when
 * there's unprotected work of the teacher's own, a single quiet row once
 * they've picked a path (sync or files), and an honest staleness reminder
 * only for the file path — never a backup nag while sync is on.
 */
export function DataFooter({
  onImport,
  importError,
  onStartOver,
  hasOwnWork,
}: {
  onImport: () => void;
  importError: string | null;
  onStartOver: () => void;
  hasOwnWork: boolean;
}) {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus, getServerSyncStatus);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [cardDismissed, setCardDismissed] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [turnOffOpen, setTurnOffOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    setLastBackup(getLastBackupAt());
    setCardDismissed(dataCardDismissed());
  }, []);

  const token = status.enabled ? getSyncToken() : null;

  const handleTurnOn = async () => {
    setEnabling(true);
    try {
      await enableSync();
      setStartOpen(false);
      setLinkOpen(true);
    } finally {
      setEnabling(false);
    }
  };

  const handleExport = () => {
    exportBackup();
    setLastBackup(new Date().toISOString());
  };

  const handleDismissCard = () => {
    dismissDataCard();
    setCardDismissed(true);
  };

  // The choice moment: own work, unprotected, not yet waved away.
  const showCard = !status.enabled && hasOwnWork && !lastBackup && !cardDismissed;

  // Staleness only nags the teacher who chose files — never while sync is on.
  const backupStale =
    lastBackup !== null && (Date.now() - new Date(lastBackup).getTime()) / 86_400_000 >= 14;

  const quietLink = "text-[13px] text-stone-400 transition hover:text-stone-600";

  return (
    <div className="mt-10 border-t border-stone-300/50 pt-4">
      {showCard ? (
        <>
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-6 py-5">
            <p className="font-display text-[15px] italic text-stone-700">
              Your classes live only on this device.
            </p>
            <p className="mt-1 text-[13px] text-stone-500">
              Two ways to keep them safe — pick whichever suits you.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleTurnOn()}
                disabled={enabling}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-stone-700">
                  {enabling ? "Turning on…" : "Sync across devices"}
                </span>
                <span className="mt-1 block text-[12px] leading-relaxed text-stone-400">
                  A private link keeps every device current, automatically.
                </span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-stone-50"
              >
                <span className="block text-sm font-medium text-stone-700">Export a file</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-stone-400">
                  A snapshot you keep yourself, whenever you choose.
                </span>
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="text-[12px] text-stone-400 underline underline-offset-2 transition hover:text-stone-600"
              >
                Already have a sync link?
              </button>
              <button
                type="button"
                onClick={handleDismissCard}
                className="text-[12px] text-stone-400 transition hover:text-stone-600"
              >
                Not now
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3">
            <button type="button" onClick={onImport} className={quietLink}>
              Import
            </button>
            <button type="button" onClick={onStartOver} className={quietLink}>
              Start over…
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {status.enabled && token ? (
            <span className={`text-[13px] ${status.error ? "text-amber-700/70" : "text-stone-400"}`}>
              {status.syncing
                ? "Syncing…"
                : status.error
                  ? "Sync is catching up — changes are safe on this device"
                  : `Synced across your devices · ${formatLastSynced(status.lastSyncedAt)}`}
            </span>
          ) : lastBackup ? (
            <span className={`text-[13px] ${backupStale ? "text-amber-700/70" : "text-stone-400"}`}>
              {formatLastBackup(lastBackup)}
            </span>
          ) : (
            <span className="text-[13px] text-stone-400">On this device only</span>
          )}
          <div className="flex items-center gap-3">
            {status.enabled && token ? (
              <button type="button" onClick={() => setLinkOpen(true)} className={quietLink}>
                Sync link
              </button>
            ) : (
              <button type="button" onClick={() => setStartOpen(true)} className={quietLink}>
                Sync across devices
              </button>
            )}
            <button type="button" onClick={handleExport} className={quietLink}>
              Export
            </button>
            <button type="button" onClick={onImport} className={quietLink}>
              Import
            </button>
            <button type="button" onClick={onStartOver} className={quietLink}>
              Start over…
            </button>
          </div>
        </div>
      )}
      {importError && (
        <p className="mt-2 text-[12px] text-rose-500">{importError}</p>
      )}
      {linkOpen && token && (
        <SyncLinkModal
          token={token}
          onClose={() => setLinkOpen(false)}
          onTurnOff={() => {
            setLinkOpen(false);
            setTurnOffOpen(true);
          }}
        />
      )}
      {connectOpen && <ConnectSyncModal onClose={() => setConnectOpen(false)} />}
      {turnOffOpen && token && <TurnOffSyncModal token={token} onClose={() => setTurnOffOpen(false)} />}
      {startOpen && (
        <SyncStartModal
          enabling={enabling}
          onCreate={() => void handleTurnOn()}
          onConnect={() => {
            setStartOpen(false);
            setConnectOpen(true);
          }}
          onClose={() => setStartOpen(false)}
        />
      )}
    </div>
  );
}
