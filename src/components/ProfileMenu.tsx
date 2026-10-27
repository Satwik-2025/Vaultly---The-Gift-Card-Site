import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { useAuth } from '../hooks/useApp';

/**
 * The account menu behind the avatar.
 *
 * Signed out it offers the two ways in; signed in it shows who you are and the
 * usual account links. The name is truncated rather than wrapped — a long one
 * would otherwise push the navbar buttons around on narrow screens.
 */

const NAME_LIMIT = 15;
const truncate = (name: string, limit = NAME_LIMIT) =>
  name.length <= limit ? name : `${name.slice(0, limit - 1).trimEnd()}…`;

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2);
  return s.toUpperCase();
};

interface Item {
  label: string;
  icon: IconName;
  to?: string;
  note?: string;
}

const LINKS: Item[] = [
  { label: 'Settings', icon: 'filter', to: '/settings' },
  { label: 'Saved cards', icon: 'tag', to: '/settings#saved' },
  { label: 'Messages', icon: 'merge', to: '/settings#messages' },
  { label: 'Customer care', icon: 'shield', to: '/settings#support' },
  { label: 'Help & FAQ', icon: 'spark', to: '/settings#support' },
];

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const initials = user ? initialsOf(user.name) : null;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={user ? `Account menu for ${user.name}` : 'Sign in'}
        title={user?.name ?? 'Sign in'}
        className="btn btn-glass gap-2 !px-2 md:!px-3"
      >
        {user ? (
          <span className="from-brand-400 to-mint-400 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white">
            {initials}
          </span>
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border-strong)]">
            <Icon name="user" className="h-4 w-4" />
          </span>
        )}
        <span className="hidden max-w-[9.5rem] truncate lg:inline">
          {user ? truncate(user.name) : 'Sign in'}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="popover absolute top-full right-0 z-50 mt-2 w-60 rounded-2xl p-2"
          >
            {user ? (
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-2 pt-1 pb-2.5">
                <span className="from-brand-400 to-mint-400 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{user.name}</span>
                  <span className="text-faint block truncate text-xs">{user.email}</span>
                </span>
              </div>
            ) : (
              <div className="border-b border-[var(--border)] px-2 pt-1 pb-2.5">
                <p className="text-sm font-bold">You're not signed in</p>
                <p className="text-muted mt-0.5 text-xs leading-relaxed">
                  Create an account to save cards and keep your settings.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Link
                    to="/signin"
                    onClick={() => setOpen(false)}
                    className="btn btn-primary !px-2 !text-xs"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="btn btn-glass !px-2 !text-xs"
                  >
                    Create
                  </Link>
                </div>
              </div>
            )}

            <div className="grid gap-0.5 pt-1.5">
              {LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.to ?? '/settings'}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Icon name={item.icon} className="text-muted h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}

              {user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                    navigate('/');
                  }}
                  className="mt-0.5 flex items-center gap-2.5 rounded-xl border-t border-[var(--border)] px-2 py-2 pt-2.5 text-left text-sm font-semibold text-[var(--bad)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Icon name="close" className="h-4 w-4 shrink-0" />
                  Sign out
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
