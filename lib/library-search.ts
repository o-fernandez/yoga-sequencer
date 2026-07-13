import { getPoseMeta } from "./poses";
import type { SequenceRecord } from "./sequences";

/**
 * Everything a teacher might remember a class by, joined into one lowercase
 * haystack: name, theme, peak, scratch-pad notes, teaching-log notes, section
 * titles, pose names (English + Sanskrit), and the cues written on them.
 */
function haystack(seq: SequenceRecord): string {
  const parts: (string | undefined)[] = [
    seq.name,
    seq.theme,
    seq.themeSub,
    seq.peakPose,
    seq.peakPose ? getPoseMeta(seq.peakPose)?.sanskrit : undefined,
    seq.notes,
    ...seq.dates.map((e) => e.notes),
  ];
  for (const section of seq.sections) {
    // The default placeholder title would make "new" match every sketch.
    if (section.title !== "New section") parts.push(section.title);
    for (const pose of section.poses) {
      parts.push(pose.pose, getPoseMeta(pose.pose)?.sanskrit, pose.cue);
    }
  }
  return parts.filter(Boolean).join("\n").toLowerCase();
}

/**
 * Case-insensitive class filter: every whitespace-separated term must appear
 * somewhere in the class, so "kapha pigeon" narrows rather than widens.
 * An empty query returns everything, in the order given.
 */
export function filterSequences(sequences: SequenceRecord[], query: string): SequenceRecord[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return sequences;
  return sequences.filter((seq) => {
    const hay = haystack(seq);
    return terms.every((term) => hay.includes(term));
  });
}
