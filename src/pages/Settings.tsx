import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './../components/Icon';
import { useAuth, useTheme } from '../hooks/useApp';
import type { Theme } from '../themes';

/**
 * Settings, with Appearance first because it's the one people actually come
 * here to change. Each section carries an id so the account menu can deep-link
 * straight to it.
 */

const PREFS_KEY = 'vaultly:prefs';

interface Prefs {
  priceDrops: boolean;
  newCards: boolean;
  weekly: boolean;
  autoRecheck: boolean;
}

const DEFAULT_PREFS: Prefs = {
  priceDrops: true,
  newCards: true,
  weekly: false,
  autoRecheck: true,
};

const readPrefs = (): Prefs => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
};

function Section({
  id,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="glass scroll-mt-28 rounded-[var(--radius-xl2)] p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="bg-brand-500/15 text-brand-400 grid h-9 w-9 shrink-0 place-items-center rounded-xl">
          <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <p className="text-muted mt-0.5 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A labelled switch. Reads as a checkbox to assistive tech. */
function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl px-1 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted block text-xs leading-relaxed">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked
            ? 'bg-brand-500 border-transparent'
            : 'border-[var(--border-strong)] bg-[var(--surface)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[1.4rem]' : 'left-0.5'
          }`}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </span>
    </label>
  );
}

function ThemeCard({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="group relative overflow-hidden rounded-2xl border text-left transition-all"
      style={{
        borderColor: active ? theme.accent : 'var(--border)',
        boxShadow: active ? `0 0 0 1.5px ${theme.accent}` : undefined,
      }}
    >
      {/* A miniature of the page rendered in that theme's own colours. */}
      <span className="block h-20 w-full p-2.5" style={{ background: theme.bg }}>
        <span
          aria-hidden
          className="pointer-events-none absolute -top-5 -left-5 h-16 w-16 rounded-full blur-xl"
          style={{ background: theme.accent, opacity: 0.6 }}
        />
        <span className="relative flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md" style={{ background: theme.accent }} />
          <span
            className="h-2 w-10 rounded-full"
            style={{ background: theme.mode === 'dark' ? '#ffffff30' : '#0f122030' }}
          />
        </span>
        <span className="relative mt-2 block space-y-1">
          <span
            className="block h-1.5 w-20 rounded-full"
            style={{ background: theme.mode === 'dark' ? '#ffffff22' : '#0f122018' }}
          />
          <span
            className="block h-1.5 w-14 rounded-full"
            style={{ background: theme.mode === 'dark' ? '#ffffff16' : '#0f122012' }}
          />
          <span
            className="mt-1.5 block h-3 w-12 rounded-md"
            style={{ background: theme.accent, opacity: 0.85 }}
          />
        </span>
      </span>

      <span className="flex items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2">
        <span className="text-sm font-bold">{theme.name}</span>
        {active ? (
          <Icon name="check" className="h-4 w-4 shrink-0" />
        ) : (
          <span className="text-faint text-[0.6rem] font-bold uppercase">{theme.mode}</span>
        )}
      </span>
    </button>
  );
}

export function Settings() {
  const { theme, themes, select } = useTheme();
  const { user, updateProfile } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(String(user?.age ?? ''));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // A blocked store just means preferences don't persist.
    }
  }, [prefs]);

  useEffect(() => {
    setName(user?.name ?? '');
    setAge(String(user?.age ?? ''));
  }, [user]);

  const setPref = (key: keyof Prefs) => (v: boolean) => setPrefs((p) => ({ ...p, [key]: v }));

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(age);
    updateProfile({
      name: name.trim() || user!.name,
      age: Number.isFinite(parsed) && parsed > 0 ? parsed : user!.age,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="shell pt-8 pb-20 md:pt-12">
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">Settings</h1>
        <p className="text-muted mt-1.5 text-sm md:text-base">
          Appearance, your account, and what Vaultly tells you about.
        </p>
      </motion.header>

      <div className="mt-6 grid gap-4">
        {/* ------------------------------- Appearance ------------------------ */}
        <Section
          id="appearance"
          icon="spark"
          title="Appearance"
          description={`${themes.length} themes. The change sweeps in diagonally unless you've asked your system for reduced motion.`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {themes.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                active={t.id === theme.id}
                onSelect={() => select(t.id)}
              />
            ))}
          </div>
          <p className="text-faint mt-3 text-xs">
            Hover the theme button in the header to switch without coming here.
          </p>
        </Section>

        {/* -------------------------------- Account -------------------------- */}
        <Section
          id="account"
          icon="user"
          title="Account"
          description={user ? 'Your details, kept on this device.' : 'Not signed in.'}
        >
          {user ? (
            <form onSubmit={saveProfile} className="grid gap-3 sm:max-w-md">
              <label className="grid gap-1.5">
                <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  autoComplete="name"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                  Age
                </span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  className="field"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                  Email
                </span>
                <input value={user.email} readOnly className="field opacity-60" />
              </label>
              <div className="mt-1 flex items-center gap-3">
                <button type="submit" className="btn btn-primary !px-5">
                  Save changes
                </button>
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6ee7b7]">
                    <Icon name="check" className="h-3.5 w-3.5" />
                    Saved
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link to="/signin" className="btn btn-primary !px-5">
                Sign in
              </Link>
              <Link to="/signup" className="btn btn-glass !px-5">
                Create an account
              </Link>
            </div>
          )}
        </Section>

        {/* ----------------------------- Notifications ----------------------- */}
        <Section
          id="notifications"
          icon="shield"
          title="Notifications"
          description="What Vaultly surfaces while you browse. Stored on this device."
        >
          <div className="divide-y divide-[var(--border)]">
            <Toggle
              checked={prefs.priceDrops}
              onChange={setPref('priceDrops')}
              label="Price drops"
              hint="Tell me when a card I viewed gets cheaper."
            />
            <Toggle
              checked={prefs.newCards}
              onChange={setPref('newCards')}
              label="Newly listed cards"
              hint="The banner that names cards sellers have just added."
            />
            <Toggle
              checked={prefs.weekly}
              onChange={setPref('weekly')}
              label="Weekly best deals"
              hint="A summary of the biggest discounts across all sellers."
            />
            <Toggle
              checked={prefs.autoRecheck}
              onChange={setPref('autoRecheck')}
              label="Re-check prices automatically"
              hint="Re-read a brand's live prices when you open its page."
            />
          </div>
        </Section>

        {/* -------------------------------- Saved ---------------------------- */}
        <Section
          id="saved"
          icon="tag"
          title="Saved cards"
          description="Cards you've bookmarked to watch."
        >
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
            <p className="text-muted text-sm">Nothing saved yet.</p>
            <Link to="/search" className="btn btn-glass mt-3 !px-4 !text-xs">
              Browse gift cards
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>

        {/* ------------------------------- Messages -------------------------- */}
        <Section
          id="messages"
          icon="merge"
          title="Messages"
          description="Replies from support and alerts you've asked for."
        >
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
            <p className="text-muted text-sm">No messages.</p>
          </div>
        </Section>

        {/* -------------------------------- Support -------------------------- */}
        <Section
          id="support"
          icon="spark"
          title="Customer care"
          description="Questions about a card you bought go to the seller — they hold the order."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <a href="#contact" className="glass rounded-2xl p-4 transition-colors hover:bg-[var(--surface-hover)]">
              <p className="text-sm font-bold">Contact us</p>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                Something wrong with a price or a listing on Vaultly.
              </p>
            </a>
            <div className="glass rounded-2xl p-4">
              <p className="text-sm font-bold">Order problems</p>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                Vaultly compares prices but never sells the card — refunds and delivery are
                handled by GyFTR, Woohoo or Amazon directly.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
