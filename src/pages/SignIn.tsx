import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../components/Icon';
import { useAuth } from '../hooks/useApp';
import { PASSWORD_RULES, validatePassword } from '../context/AuthContext';

/**
 * Sign in and create account, as one card with a switch between them.
 *
 * Both routes render this same component at the same place in the tree, so
 * React keeps the instance when you flip between /signin and /signup — that's
 * what lets the switch's pill slide across and the extra sign-up fields
 * expand in, rather than the whole card being torn down and rebuilt.
 *
 * Switching has to feel like one form changing shape, not two pages. So
 * nothing on the card is allowed to snap: the headings are stacked in one cell
 * (it's always as tall as the taller one) and cross-fade, and everything that
 * comes and goes — name and age, the password rules, confirm, the error —
 * folds its spacing into the part that animates. A grid `gap` doesn't work
 * here: it stays at full size while a row shrinks to nothing, then vanishes
 * all at once, and the fields below jump up to close it.
 *
 * Email and password only — deliberately no third-party sign-in.
 */

const TABS = [
  { mode: 'signin', label: 'Sign in', to: '/signin' },
  { mode: 'signup', label: 'Create account', to: '/signup' },
] as const;

const HEADINGS = {
  signup: {
    title: 'Create your account',
    blurb: 'Save the cards you’re watching and keep your settings.',
  },
  signin: { title: 'Welcome back', blurb: 'Sign in to pick up where you left off.' },
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;
/*
  Even in, even out. The snappy ease-out used elsewhere front-loads the
  movement — most of a 100px collapse happened in the first few frames — which
  reads as a jump. This spreads it out so the fields below glide into place.
*/
const GLIDE = [0.45, 0, 0.25, 1] as const;

/**
 * Opens to its natural height and folds back to nothing. Spacing belongs
 * inside `children` (or as padding here), never as a margin outside it.
 */
function Reveal({
  show,
  className = '',
  children,
}: {
  show: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="reveal"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.36, ease: GLIDE }}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/*
  Fields reveal with a 4px pad (and a matching negative margin) so the input's
  focus ring isn't clipped by the overflow. Collapsed, the box is exactly that
  pad tall and the margin cancels it, so it takes no room at all.
*/
const RING_ROOM_TOP = '-mx-1 -mt-1 px-1 pt-1';
const RING_ROOM_BOTTOM = '-mx-1 -mb-1 px-1 pb-1';

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col ${className}`}>
      <span className="mb-2 text-sm font-semibold">{label}</span>
      {children}
      <Reveal show={Boolean(hint)}>
        <span className="text-faint block pt-2 text-xs">{hint}</span>
      </Reveal>
    </label>
  );
}

export function SignIn({ mode }: { mode: 'signin' | 'signup' }) {
  const creating = mode === 'signup';
  const { signIn, signUp, cloud } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { from?: string } };

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An error from one form means nothing on the other.
  useEffect(() => setError(null), [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (creating) {
      const parsedAge = Number(age);
      if (!name.trim()) return setError('Please enter your name.');
      if (!Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 120) {
        return setError('Please enter an age between 13 and 120.');
      }
      const badPassword = validatePassword(password);
      if (badPassword) return setError(badPassword);
      if (password !== confirm) return setError("Those passwords don't match.");
    }

    setBusy(true);
    try {
      if (creating) await signUp({ name, email, age: Number(age), password });
      else await signIn({ email, password });
      navigate(state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell flex justify-center pt-8 pb-24 md:pt-14">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="glass w-full max-w-[28rem] rounded-[1.75rem] p-6 sm:p-9"
      >
        <img
          src={`${import.meta.env.BASE_URL}brand/vaultly-mark.png`}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-[22%] shadow-lg"
        />

        {/*
          Both headings are always here, stacked in one grid cell, so the cell
          is as tall as the longer one and switching never moves the card.
        */}
        <div className="mt-5 grid">
          {(Object.keys(HEADINGS) as (keyof typeof HEADINGS)[]).map((key) => {
            const active = key === mode;
            const Heading = active ? 'h1' : 'p';
            return (
              <div
                key={key}
                aria-hidden={!active}
                className={`[grid-area:1/1] transition-opacity duration-300 ${
                  active ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                <Heading className="font-display text-[1.75rem] leading-tight font-extrabold sm:text-3xl">
                  {HEADINGS[key].title}
                </Heading>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">{HEADINGS[key].blurb}</p>
              </div>
            );
          })}
        </div>

        {/* The two forms side by side, as a switch. */}
        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="relative mt-6 grid grid-cols-2 rounded-full border border-[var(--border)] bg-[var(--input-bg)] p-1.5"
        >
          {TABS.map((tab) => {
            const active = tab.mode === mode;
            return (
              <Link
                key={tab.mode}
                to={tab.to}
                replace
                state={state}
                role="tab"
                aria-selected={active}
                className={`relative z-10 rounded-full py-2.5 text-center text-sm font-bold transition-colors ${
                  active ? 'text-white' : 'text-muted hover:text-[var(--text)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="auth-tab"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="from-brand-500 to-brand-600 absolute inset-0 -z-10 rounded-full bg-gradient-to-b shadow-lg"
                  />
                )}
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form onSubmit={submit} className="mt-7 flex flex-col" noValidate>
          <Reveal show={creating} className={RING_ROOM_TOP}>
            {/* Name gets the room; age only ever needs three digits. */}
            <div className="grid grid-cols-[1fr_6.5rem] gap-3 pb-5">
              <Field label="Full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </Field>
              <Field label="Age">
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  className="input"
                  placeholder="e.g. 24"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </Reveal>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <Field label="Password" hint={creating ? PASSWORD_RULES : undefined} className="mt-5">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-12"
                placeholder={creating ? 'Create a password' : 'Your password'}
                autoComplete={creating ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-faint absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-[18px] w-[18px]" />
              </button>
            </div>
          </Field>

          <Reveal show={creating} className={RING_ROOM_BOTTOM}>
            <Field label="Confirm password" className="pt-5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="Type it again"
                autoComplete="new-password"
              />
            </Field>
          </Reveal>

          <Reveal show={Boolean(error)}>
            <div className="pt-5">
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[var(--bad)]/35 bg-[var(--bad)]/10 px-3.5 py-2.5 text-sm leading-relaxed text-[var(--bad)]"
              >
                <Icon name="close" className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            </div>
          </Reveal>

          <button type="submit" disabled={busy} className="btn btn-primary mt-6 h-12 w-full">
            {busy ? 'One moment…' : creating ? 'Create account' : 'Sign in'}
            {!busy && <Icon name="arrowRight" className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-muted mt-5 text-center text-sm">
          or{' '}
          <Link to="/" className="font-bold text-[var(--text)] hover:underline">
            keep browsing as a guest
          </Link>
        </p>

        <p className="text-faint mt-6 flex gap-2 border-t border-[var(--border)] pt-4 text-xs leading-relaxed">
          <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {cloud ? (
            <span>
              Sign in on any device to see the same account and saved cards. Your password is
              hashed on our server and never stored as you typed it.
            </span>
          ) : (
            // Said plainly rather than buried: there's no accounts server here.
            <span>
              Accounts are stored in this browser only. Your password is hashed before it’s saved,
              but please don’t reuse one that protects anything important.
            </span>
          )}
        </p>
      </motion.div>
    </div>
  );
}
