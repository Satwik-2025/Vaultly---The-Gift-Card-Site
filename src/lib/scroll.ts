/**
 * Scroll an element into view, smoothly where that's supported.
 *
 * `scrollIntoView({ behavior: 'smooth' })` is silently a no-op in some embedded
 * browsers — the call returns, nothing moves, and the page looks broken. So
 * this asks for the smooth scroll, then checks whether anything actually
 * happened and falls back to an instant jump if not. Arriving abruptly is worse
 * than arriving gracefully; not arriving at all is worse than both.
 *
 * Position is computed rather than delegated so the fallback can honour the
 * element's `scroll-margin-top`, which `window.scrollTo` ignores and which is
 * what stops the sticky navbar covering the heading we just scrolled to.
 */
export function scrollToElement(target: Element | null) {
  if (!target) return;

  const marginTop = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - marginTop);

  // Already there — don't fight a scroll the user is in the middle of.
  if (Math.abs(window.scrollY - top) < 2) return;

  const before = window.scrollY;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    window.scrollTo({ top });
    return;
  }

  window.scrollTo({ top, behavior: 'smooth' });

  // Two frames plus a beat: enough for a real smooth scroll to have started,
  // short enough that the fallback doesn't read as a second jump.
  window.setTimeout(() => {
    if (Math.abs(window.scrollY - before) < 2 && Math.abs(window.scrollY - top) > 2) {
      window.scrollTo({ top });
    }
  }, 120);
}

/** Convenience for the `#id` form used by in-page links. */
export const scrollToId = (id: string) => scrollToElement(document.getElementById(id));
