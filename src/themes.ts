/**
 * The appearance registry.
 *
 * A theme is an id plus a mode. The id goes on `<html data-theme>` and selects
 * a palette in index.css; the mode decides whether the `light` class is also
 * applied, which is what every existing `.light …` rule keys off. That split
 * means a new palette is a block of CSS variables and one entry here — no
 * component needs to know a theme exists.
 */
export type ThemeMode = 'dark' | 'light';
export type ThemeId = (typeof THEMES)[number]['id'];

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  /** The browser chrome colour, and the swatch shown in the picker. */
  bg: string;
  accent: string;
}

export const THEMES = [
  { id: 'midnight', name: 'Midnight', mode: 'dark', bg: '#06060c', accent: '#6d5efc' },
  { id: 'daylight', name: 'Daylight', mode: 'light', bg: '#f2f3f9', accent: '#5b46e5' },
  { id: 'ocean', name: 'Ocean', mode: 'dark', bg: '#03121a', accent: '#1fb6d6' },
  { id: 'ember', name: 'Ember', mode: 'dark', bg: '#140705', accent: '#ff7a3d' },
  { id: 'forest', name: 'Forest', mode: 'dark', bg: '#04120c', accent: '#35c77a' },
  { id: 'grape', name: 'Grape', mode: 'dark', bg: '#120418', accent: '#c45cff' },
  { id: 'linen', name: 'Linen', mode: 'light', bg: '#f6f2ea', accent: '#b2542f' },
  { id: 'mono', name: 'Mono', mode: 'light', bg: '#f4f4f5', accent: '#3f3f46' },
] as const satisfies readonly Theme[];

export const DEFAULT_THEME: ThemeId = 'midnight';

export const getTheme = (id: string): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];

export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === 'string' && THEMES.some((t) => t.id === v);
