import type { ThemeType } from "./sequences";

/**
 * The theme taxonomy (season / chakra / meridian options) and the color
 * language for theme tags and peak-pose highlights, shared by the library
 * cards and the builder's theme picker.
 */

export const SEASONS_TRADITIONAL = ['Spring', 'Summer', 'Fall', 'Winter'];
export const SEASONS_AYURVEDIC = ['Vata', 'Kapha', 'Pitta'];

export const CHAKRA_OPTIONS = [
  '1 · Muladhara (root)',
  '2 · Svadhisthana (sacral)',
  '3 · Manipura (solar plexus)',
  '4 · Anahata (heart)',
  '5 · Vishuddha (throat)',
  '6 · Ajna (third eye)',
  '7 · Sahasrara (crown)',
];

export const MERIDIAN_OPTIONS = [
  'Lung', 'Large Intestine', 'Stomach', 'Spleen', 'Heart',
  'Small Intestine', 'Bladder', 'Kidney', 'Pericardium',
  'Triple Warmer', 'Gallbladder', 'Liver',
];

// ─── Colors ──────────────────────────────────────────────────────────────────

export type ColorStyle = { bg: string; text: string; border: string };

const CHAKRA_COLORS: ColorStyle[] = [
  { bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }, // 1 Muladhara
  { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' }, // 2 Svadhisthana
  { bg: '#FAEEDA', text: '#BA7517', border: '#EF9F27' }, // 3 Manipura
  { bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }, // 4 Anahata
  { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' }, // 5 Vishuddha
  { bg: '#EEEDFE', text: '#534AB7', border: '#AFA9EC' }, // 6 Ajna
  { bg: '#FBEAF0', text: '#993556', border: '#F4C0D1' }, // 7 Sahasrara
];

const SEASON_GREEN: ColorStyle = { bg: '#E1F5EE', text: '#0F6E56', border: '#9FE1CB' };
const SEASON_AMBER: ColorStyle = { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' };
const SEASON_BLUE: ColorStyle  = { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' };

function chakraColor(themeSub: string): ColorStyle | null {
  const n = parseInt(themeSub[0]);
  if (isNaN(n) || n < 1 || n > 7) return null;
  return CHAKRA_COLORS[n - 1];
}

function seasonPoseColor(themeSub: string): ColorStyle {
  if (themeSub === 'Pitta' || themeSub === 'Summer' || themeSub === 'Fall') return SEASON_AMBER;
  if (themeSub === 'Vata' || themeSub === 'Winter') return SEASON_BLUE;
  return SEASON_GREEN; // Kapha, Spring
}

/** Color for the small theme tag under a class title. */
export function themeTagStyle(themeType: ThemeType | undefined, themeSub: string | undefined): ColorStyle | null {
  if (!themeType || !themeSub || themeType === 'custom') return null;
  if (themeType === 'season') return SEASON_GREEN;
  if (themeType === 'meridian') return SEASON_GREEN;
  if (themeType === 'chakra') return chakraColor(themeSub);
  return null;
}

/** Color for the peak-pose highlight block — season-aware, unlike the tag. */
export function themePoseStyle(themeType: ThemeType | undefined, themeSub: string | undefined): ColorStyle | null {
  if (!themeType || !themeSub || themeType === 'custom') return null;
  if (themeType === 'season') return seasonPoseColor(themeSub);
  if (themeType === 'meridian') return SEASON_GREEN;
  if (themeType === 'chakra') return chakraColor(themeSub);
  return null;
}

function formatThemeSubLabel(themeType: ThemeType, themeSub: string): string {
  if (themeType === 'season') {
    return SEASONS_AYURVEDIC.includes(themeSub) ? `${themeSub} season` : themeSub;
  }
  if (themeType === 'meridian') return `${themeSub} meridian`;
  return themeSub;
}

export function themeTagLabel(themeType: ThemeType, themeSub: string): string {
  if (themeType === 'season') return formatThemeSubLabel(themeType, themeSub);
  if (themeType === 'meridian') return themeSub;
  if (themeType === 'chakra') {
    // "1 · Muladhara (root)" → "Muladhara · chakra"
    const name = themeSub.split('·')[1]?.split('(')[0]?.trim() ?? themeSub;
    return `${name} · chakra`;
  }
  return themeSub;
}
