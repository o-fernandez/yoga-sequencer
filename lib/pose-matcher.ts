import Fuse from "fuse.js";
import { allPoses, type PoseMeta } from "./poses";

type SearchEntry = {
  pose: PoseMeta;
  searchName: string;
};

// Build a flat list of entries — one per (pose name, sanskrit, alias) combination.
// This lets Fuse score each string independently against the query.
// `searchables` is the same data grouped per pose, with lowercased strings, so
// we can test exact / prefix / substring hits before falling back to Fuse.
const searchEntries: SearchEntry[] = [];
const searchables: { pose: PoseMeta; entries: { display: string; lower: string }[] }[] = [];
for (const pose of allPoses) {
  const names = [pose.pose, pose.sanskrit, ...(pose.aliases ?? [])].filter(Boolean) as string[];
  for (const name of names) searchEntries.push({ pose, searchName: name });
  searchables.push({
    pose,
    entries: names.map((display) => ({ display, lower: display.toLowerCase() })),
  });
}

// Fuse is now only a typo/abbreviation fallback — exact, prefix and substring
// hits are caught literally before we ever consult it, so we can keep the
// threshold fairly tight to avoid a long tail of weak fuzzy matches.
const fuse = new Fuse(searchEntries, {
  keys: ["searchName"],
  threshold: 0.3,
  distance: 100,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
});

type Ranked = { pose: PoseMeta; matchedOn: string; score: number };

// Rank poses best-first. Literal matches (exact > prefix > substring) always
// outrank fuzzy ones, so a full-string match like "savasana" lands at the top.
function rankedMatches(query: string): Ranked[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const out: (Ranked & { tie: number })[] = [];
  const matched = new Set<string>();

  searchables.forEach(({ pose, entries }, i) => {
    let tier: number | null = null;
    let matchedOn = "";
    for (const { display, lower } of entries) {
      let t: number | null = null;
      if (lower === q) t = 0;
      else if (lower.startsWith(q)) t = 1;
      else if (lower.includes(q)) t = 2;
      if (t !== null && (tier === null || t < tier)) {
        tier = t;
        matchedOn = display;
        if (t === 0) break;
      }
    }
    if (tier !== null) {
      const score = tier === 0 ? 0 : tier === 1 ? 0.05 : 0.12;
      out.push({ pose, matchedOn, score, tie: i });
      matched.add(pose.pose);
    }
  });

  // Fuzzy fallback for typos — only when nothing matched literally. Yoga's
  // shared Sanskrit suffixes (…asana) make fuzzy matching noisy, so we never
  // pad a good literal result set with fuzzy guesses.
  if (out.length === 0) {
    for (const r of fuse.search(q)) {
      if (matched.has(r.item.pose.pose)) continue;
      matched.add(r.item.pose.pose);
      out.push({
        pose: r.item.pose,
        matchedOn: r.item.searchName,
        score: Math.max(0.2, r.score ?? 1),
        tie: 1000,
      });
    }
  }

  out.sort((a, b) => a.score - b.score || a.tie - b.tie);
  return out.map(({ pose, matchedOn, score }) => ({ pose, matchedOn, score }));
}

export type MatchResult = {
  pose: PoseMeta;
  matchedOn: string;       // which string matched (name / Sanskrit / alias)
  score: number;           // 0 = perfect, 1 = worst; we invert for display
  confidence: "high" | "medium" | "low" | "none";
  alternatives: { pose: PoseMeta; matchedOn: string }[];
};

export function matchPose(query: string): MatchResult {
  const q = query.trim();
  const ranked = rankedMatches(q);

  if (ranked.length === 0) {
    return {
      pose: allPoses[0],
      matchedOn: q,
      score: 1,
      confidence: "none",
      alternatives: [],
    };
  }

  const best = ranked[0];
  const score = best.score;

  const confidence: MatchResult["confidence"] =
    score <= 0.1 ? "high" :
    score <= 0.25 ? "medium" :
    score <= 0.45 ? "low" : "none";

  const alternatives = ranked
    .slice(1, 4)
    .map((r) => ({ pose: r.pose, matchedOn: r.matchedOn }));

  return {
    pose: best.pose,
    matchedOn: best.matchedOn,
    score,
    confidence,
    alternatives,
  };
}

/**
 * Ranked search for the pose pickers. Returns unique poses ordered
 * best-match-first (exact > prefix > substring > fuzzy). An empty query
 * returns the whole library in its natural order.
 */
export function searchPoses(query: string): PoseMeta[] {
  if (!query.trim()) return allPoses;
  return rankedMatches(query).map((r) => r.pose);
}

export function parseQuickEntry(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
