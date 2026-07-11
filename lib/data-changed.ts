/**
 * A tiny signal the storage modules fire after every user-visible mutation.
 * The sync engine listens and schedules a push; nothing else should need it.
 * Kept dependency-free so sequences/inspirations/cues can import it without
 * creating a cycle with the sync module.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onDataChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitDataChanged(): void {
  for (const fn of listeners) fn();
}
