import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { useTheme } from '../hooks/useApp';
import type { Theme } from '../themes';

/**
 * The theme control: hovering reveals the palette list, clicking opens and
 * closes it.
 *
 * Clicking used to flip dark/light, which fought the hover menu — you reached
 * for a palette, clicked, and the theme changed under you instead of the panel
 * closing. Picking a palette is the only thing that changes the theme now.
 *
 * Hover alone would strand keyboard and touch users, so the same panel opens on
 * focus and on tap.
 */

/** A miniature of the page: background, aurora wash, and a pill of accent. */
function Swatch({ theme, active }: { theme: Theme; active: boolean }) {
  return (
    <span
      className="relative grid h-7 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border"
      style={{
        background: theme.bg,
        borderColor: active ? theme.accent : 'var(--border)',
        boxShadow: active ? `0 0 0 1.5px ${theme.accent}` : undefined,
      }}
    >
      <span
        aria-hidden
        className="absolute -top-2 -left-2 h-6 w-6 rounded-full blur-[6px]"
        style={{ background: theme.accent, opacity: 0.75 }}
      />
      <span
        className="relative h-1.5 w-4 rounded-full"
        style={{ background: theme.accent }}
      />
    </span>
  );
}

export function ThemeMenu() {
  const { theme, themes, select } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  // A small grace period: the pointer has to cross a gap between the button
  // and the panel, and closing instantly makes the menu feel broken.
  const openNow = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onClick);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Theme: ${theme.name}. ${open ? 'Hide themes' : 'Show themes'}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn-glass h-10 w-10 !p-0"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme.id}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.22 }}
            className="grid place-items-center"
          >
            <Icon
              name={theme.mode === 'dark' ? 'moon' : 'sun'}
              className="h-[18px] w-[18px]"
            />
          </motion.span>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Appearance"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            /* Sits under the button with a small bridge of padding so the
               pointer can travel without crossing dead space. */
            className="popover absolute top-full right-0 z-50 mt-2 w-56 rounded-2xl p-2"
          >
            <p className="text-faint px-2 pt-1 pb-2 text-[0.6rem] font-bold tracking-[0.16em] uppercase">
              Appearance
            </p>
            <div className="grid gap-0.5">
              {themes.map((t) => {
                const active = t.id === theme.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      select(t.id);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm font-semibold transition-colors ${
                      active ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface)]'
                    }`}
                  >
                    <Swatch theme={t} active={active} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="text-faint text-[0.6rem] font-bold uppercase">
                      {t.mode}
                    </span>
                    {active && <Icon name="check" className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
