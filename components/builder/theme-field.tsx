"use client";

import type { ThemeType } from "@/lib/sequences";
import {
  CHAKRA_OPTIONS,
  MERIDIAN_OPTIONS,
  SEASONS_AYURVEDIC,
  SEASONS_TRADITIONAL,
} from "@/lib/themes";

const CHIP_LABELS: Record<ThemeType, string> = {
  season: 'Season',
  chakra: 'Chakra',
  meridian: 'Meridian',
  custom: 'Custom',
};
const CHIP_ORDER: ThemeType[] = ['season', 'chakra', 'meridian', 'custom'];

const SEASON_KEYWORDS = ['spring', 'summer', 'fall', 'winter', 'autumn', 'vata', 'kapha', 'pitta', 'season', 'solstice', 'equinox'];
const CHAKRA_KEYWORDS = ['chakra', 'muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha', 'ajna', 'sahasrara', 'root', 'sacral', 'solar plexus', 'third eye', 'crown'];
const MERIDIAN_KEYWORDS = ['meridian', 'liver', 'kidney', 'bladder', 'spleen', 'gallbladder', 'pericardium', 'triple warmer'];

function suggestThemeType(text: string): ThemeType | null {
  const lower = text.toLowerCase();
  if (SEASON_KEYWORDS.some((k) => lower.includes(k))) return 'season';
  if (CHAKRA_KEYWORDS.some((k) => lower.includes(k))) return 'chakra';
  if (MERIDIAN_KEYWORDS.some((k) => lower.includes(k))) return 'meridian';
  return null;
}

export function ThemeIntentionField({
  theme, onThemeChange,
  themeType, onThemeTypeChange,
  themeSub, onThemeSubChange,
}: {
  theme: string;
  onThemeChange: (v: string) => void;
  themeType: ThemeType | undefined;
  onThemeTypeChange: (v: ThemeType | undefined) => void;
  themeSub: string | undefined;
  onThemeSubChange: (v: string | undefined) => void;
}) {
  const suggestion = !themeType && theme.trim() ? suggestThemeType(theme) : null;

  const toggleChip = (chip: ThemeType) => {
    onThemeTypeChange(chip === themeType ? undefined : chip);
  };

  return (
    <div className="mb-4">
      <input
        type="text"
        value={theme}
        onChange={(e) => onThemeChange(e.target.value)}
        placeholder="Theme or intention…"
        className="w-full bg-transparent font-display text-2xl font-light italic text-stone-700 placeholder:text-stone-300 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CHIP_ORDER.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => toggleChip(chip)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              chip === themeType
                ? 'border-violet-300 bg-violet-100 text-violet-700'
                : suggestion === chip && !themeType
                  ? 'border-violet-200 bg-violet-50 text-violet-500'
                  : 'border-stone-200 bg-stone-50/60 text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {CHIP_LABELS[chip]}
          </button>
        ))}
      </div>
      {suggestion && (
        <p className="mt-1.5 text-xs italic text-stone-400">
          Looks like:{' '}
          <button
            type="button"
            onClick={() => onThemeTypeChange(suggestion)}
            className="underline hover:text-stone-600"
          >
            {CHIP_LABELS[suggestion]}
          </button>
        </p>
      )}
      {themeType && themeType !== 'custom' && (
        <div className="mt-2.5 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
          {themeType === 'season' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-violet-400">Season</label>
              <select
                value={themeSub ?? ''}
                onChange={(e) => onThemeSubChange(e.target.value || undefined)}
                className="w-full rounded-lg border border-violet-200/60 bg-white px-3 py-2 text-sm text-stone-700 focus:border-violet-300 focus:outline-none"
              >
                <option value="">Select a season…</option>
                <optgroup label="Traditional">
                  {SEASONS_TRADITIONAL.map((s) => <option key={s}>{s}</option>)}
                </optgroup>
                <optgroup label="Ayurvedic">
                  {SEASONS_AYURVEDIC.map((s) => <option key={s}>{s}</option>)}
                </optgroup>
              </select>
            </div>
          )}
          {themeType === 'chakra' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-violet-400">Chakra</label>
              <select
                value={themeSub ?? ''}
                onChange={(e) => onThemeSubChange(e.target.value || undefined)}
                className="w-full rounded-lg border border-violet-200/60 bg-white px-3 py-2 text-sm text-stone-700 focus:border-violet-300 focus:outline-none"
              >
                <option value="">Select a chakra…</option>
                {CHAKRA_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          {themeType === 'meridian' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-violet-400">Meridian</label>
              <select
                value={themeSub ?? ''}
                onChange={(e) => onThemeSubChange(e.target.value || undefined)}
                className="w-full rounded-lg border border-violet-200/60 bg-white px-3 py-2 text-sm text-stone-700 focus:border-violet-300 focus:outline-none"
              >
                <option value="">Select a meridian…</option>
                {MERIDIAN_OPTIONS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
