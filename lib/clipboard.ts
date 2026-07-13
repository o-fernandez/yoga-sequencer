function copyViaExecCommand(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy with fallbacks. The synchronous execCommand path runs FIRST: in
 * embedded browsers and webviews, navigator.clipboard.writeText can hang
 * forever on a permission that never resolves (not reject — hang), and by the
 * time any timeout fires the click's user activation may be spent. execCommand
 * is deprecated but synchronous, so it runs while the activation is certainly
 * live. The async API is the backup, raced against a timeout so a hang reads
 * as failure instead of silence. Returns whether anything actually copied.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (copyViaExecCommand(text)) return true;
  try {
    return await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800)),
    ]);
  } catch {
    return false;
  }
}

/** Select an element's full text — so a failed copy is one keystroke from a manual one. */
export function selectContents(el: HTMLElement | null): void {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
