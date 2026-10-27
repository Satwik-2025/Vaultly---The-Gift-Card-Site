/**
 * A brand colour made safe to use as *text* on any theme.
 *
 * Seller accents are picked to be recognisable, not readable: Woohoo's purple
 * sat on Ocean's blue wash and on Grape's purple almost invisibly — "-99%"
 * simply disappeared into the card. Blending the accent with the theme's own
 * text colour keeps the hue but pulls it toward whatever reads on that
 * background: lighter on the dark themes, darker on the light ones. No theme
 * needs to know which sellers exist.
 *
 * Use it for text and icons. Fills, dots and borders can keep the raw accent.
 */
export const ink = (accent: string, share = 55) =>
  `color-mix(in oklab, ${accent} ${share}%, var(--text))`;
