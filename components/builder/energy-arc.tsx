"use client";

import { getPoseMeta, type EnergyQuality } from "@/lib/poses";
import { roundsMultiplier, type Section } from "@/lib/sequences";

function getDominantEnergy(section: Section): EnergyQuality | null {
  const counts: Partial<Record<EnergyQuality, number>> = {};
  for (const pose of section.poses) {
    const meta = getPoseMeta(pose.pose);
    if (meta) counts[meta.energy] = (counts[meta.energy] ?? 0) + 1;
  }
  const entries = Object.entries(counts) as [EnergyQuality, number][];
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

const ENERGY_ARC_CLASSES: Record<EnergyQuality, string> = {
  heating:  "bg-orange-300",
  warming:  "bg-amber-300",
  cooling:  "bg-sky-300",
  grounding:"bg-stone-400",
  neutral:  "bg-stone-300",
};

const ENERGY_ARC_LABELS: Record<EnergyQuality, string> = {
  heating:  "Heating",
  warming:  "Warming",
  cooling:  "Cooling",
  grounding:"Grounding",
  neutral:  "Neutral",
};

export function EnergyArc({ sections }: { sections: Section[] }) {
  const blocks = sections
    .map((s) => {
      const minutes = s.poses.reduce((sum, p) => sum + p.minutes, 0) * roundsMultiplier(s);
      const energy = getDominantEnergy(s);
      return { id: s.id, title: s.title, minutes, energy };
    })
    .filter((b) => b.minutes > 0 && b.energy);

  const total = blocks.reduce((sum, b) => sum + b.minutes, 0);
  if (!total || blocks.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 font-display text-sm italic text-stone-400">
        The arc of the class
      </p>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {blocks.map((block) => (
          <div
            key={block.id}
            title={`${block.title} — ${ENERGY_ARC_LABELS[block.energy!]} (${block.minutes} min)`}
            className={`h-full rounded-full transition-all ${ENERGY_ARC_CLASSES[block.energy!]}`}
            style={{ flexGrow: block.minutes / total }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-0.5 overflow-hidden rounded-full">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="overflow-hidden"
            style={{ flexGrow: block.minutes / total }}
          >
            <p className="truncate text-[9px] text-stone-400">{block.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
