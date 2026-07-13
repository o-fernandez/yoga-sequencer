import { roundsMultiplier, type SequenceRecord, type Section } from "./sequences";
import { themeTagLabel } from "./themes";

/**
 * A class as plain text, for handing to a sub or pasting into a message.
 * Compact on purpose: sections appear once with rounds/both-sides annotated
 * rather than written out, and journal content (teaching log, scratch pad)
 * stays private — only name, theme, peak, timing, poses, and cues travel.
 */

function sectionHeading(section: Section): string {
  const notes: string[] = [];
  const rounds = section.rounds ?? 1;
  if (rounds > 1) notes.push(`${rounds} rounds`);
  if (section.secondSide) notes.push("both sides");
  return notes.length > 0 ? `${section.title} — ${notes.join(" · ")}` : section.title;
}

function approxMinutes(sections: Section[]): number {
  const total = sections.reduce(
    (sum, s) => sum + s.poses.reduce((acc, p) => acc + p.minutes, 0) * roundsMultiplier(s),
    0,
  );
  return Math.max(5, Math.round(total / 5) * 5);
}

export function classAsText(seq: SequenceRecord): string {
  const lines: string[] = [];

  const title = seq.name || seq.theme || "Untitled class";
  lines.push(title);
  if (seq.theme && seq.theme !== title) {
    const tag = seq.themeType && seq.themeSub ? ` · ${themeTagLabel(seq.themeType, seq.themeSub)}` : "";
    lines.push(`${seq.theme}${tag}`);
  }

  const realSections = seq.sections.filter((s) => s.poses.length > 0);
  const metaParts: string[] = [];
  if (seq.peakPose) metaParts.push(`Peak: ${seq.peakPose}`);
  if (realSections.length > 0) metaParts.push(`~${approxMinutes(realSections)}-min class`);
  if (metaParts.length > 0) lines.push(metaParts.join(" · "));

  for (const section of realSections) {
    lines.push("");
    lines.push(sectionHeading(section));
    for (const pose of section.poses) {
      const breaths = pose.breaths ?? 5;
      lines.push(`· ${pose.pose} — ${breaths} breath${breaths === 1 ? "" : "s"}`);
      if (pose.cue) lines.push(`    “${pose.cue}”`);
    }
  }

  return lines.join("\n");
}
