/** "May 28", with the year added only when it isn't the current one. */
export function formatShortDate(iso: string): string {
  // Parse as local noon to avoid timezone off-by-one
  const d = new Date(`${iso}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

/** "12 min", "45 sec", or "12 min 30 sec" from fractional minutes. */
export function formatMinutes(minutes: number): string {
  const whole = Math.floor(minutes);
  const secs = Math.round((minutes - whole) * 60);
  if (secs === 0) return `${whole} min`;
  if (whole === 0) return `${secs} sec`;
  return `${whole} min ${secs} sec`;
}
