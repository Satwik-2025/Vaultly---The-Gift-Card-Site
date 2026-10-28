/**
 * Browsing preferences from Settings → Notifications, kept on this device.
 *
 * Shared rather than private to the Settings page so the pages they control
 * can read them — the auto re-check toggle used to be saved and then ignored.
 */
export const PREFS_KEY = 'vaultly:prefs';

export interface Prefs {
  priceDrops: boolean;
  newCards: boolean;
  weekly: boolean;
  autoRecheck: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  priceDrops: true,
  newCards: true,
  weekly: false,
  autoRecheck: true,
};

export const readPrefs = (): Prefs => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
};
