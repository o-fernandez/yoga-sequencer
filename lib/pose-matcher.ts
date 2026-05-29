import Fuse from "fuse.js";
import { poseLibrary, type PoseMeta } from "./poses";

type SearchEntry = {
  pose: PoseMeta;
  searchName: string;
};

// Build a flat list of entries — one per (pose name, sanskrit, alias) combination.
// This lets Fuse score each string independently against the query.
const searchEntries: SearchEntry[] = [];
for (const cat of poseLibrary) {
  for (const pose of cat.poses) {
    searchEntries.push({ pose, searchName: pose.pose });
    if (pose.sanskrit) {
      searchEntries.push({ pose, searchName: pose.sanskrit });
    }
    for (const alias of pose.aliases ?? []) {
      searchEntries.push({ pose, searchName: alias });
    }
  }
}

const fuse = new Fuse(searchEntries, {
  keys: ["searchName"],
  threshold: 0.45,         // higher = more lenient
  distance: 100,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
});

export type MatchResult = {
  pose: PoseMeta;
  matchedOn: string;       // which string matched (name / Sanskrit / alias)
  score: number;           // 0 = perfect, 1 = worst; we invert for display
  confidence: "high" | "medium" | "low" | "none";
  alternatives: { pose: PoseMeta; matchedOn: string }[];
};

export function matchPose(query: string): MatchResult {
  const q = query.trim();

  if (!q) {
    return {
      pose: poseLibrary[0].poses[0],
      matchedOn: "",
      score: 1,
      confidence: "none",
      alternatives: [],
    };
  }

  const results = fuse.search(q);
  if (results.length === 0) {
    return {
      pose: poseLibrary[0].poses[0],
      matchedOn: q,
      score: 1,
      confidence: "none",
      alternatives: [],
    };
  }

  // Deduplicate: best score per unique pose
  const seen = new Set<string>();
  const deduped: typeof results = [];
  for (const r of results) {
    const key = r.item.pose.pose;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  const best = deduped[0];
  const score = best.score ?? 1;

  const confidence: MatchResult["confidence"] =
    score <= 0.1 ? "high" :
    score <= 0.25 ? "medium" :
    score <= 0.45 ? "low" : "none";

  const alternatives = deduped
    .slice(1, 4)
    .map((r) => ({ pose: r.item.pose, matchedOn: r.item.searchName }));

  return {
    pose: best.item.pose,
    matchedOn: best.item.searchName,
    score,
    confidence,
    alternatives,
  };
}

/**
 * Ranked fuzzy search for the single-pose picker. Returns unique poses
 * ordered best-match-first. An empty query returns the whole library in
 * its natural order.
 */
export function searchPoses(query: string): PoseMeta[] {
  const q = query.trim();
  if (!q) return poseLibrary.flatMap((cat) => cat.poses);

  const seen = new Set<string>();
  const out: PoseMeta[] = [];
  for (const r of fuse.search(q)) {
    if (!seen.has(r.item.pose.pose)) {
      seen.add(r.item.pose.pose);
      out.push(r.item.pose);
    }
  }
  return out;
}

export function parseQuickEntry(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
