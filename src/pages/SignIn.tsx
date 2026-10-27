import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '../components/Icon';
import { useAuth } from '../hooks/useApp';
import { PASSWORD_RULES, validatePassword } from '../context/AuthContext';

/**
 * Sign in and create account, one component in two modes.
 *
 * Email and password only — deliberately no third-party sign-in, so there's
 * nothing to configure and no account data leaving this browser.
 */
export function SignIn({ mode }: { mode: 'signin' | 'signup' }) {
  const creating = mode === 'signup';
  const { signIn, signUp } = useAuth();
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

      setBusy(true);
      try {
        await signUp({ name, email, age: parsedAge, password });
        navigate(state?.from ?? '/', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the account.');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await signIn({ email, password });
      navigate(state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell flex justify-center pt-10 pb-24 md:pt-16">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="glass glass-sheen w-full max-w-md rounded-[var(--radius-xl2)] p-6 md:p-8"
      >
        <span className="from-brand-500 to-mint-500 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-lg">
          <Icon name="tag" className="h-5 w-5 text-white" strokeWidth={2} />
        </span>

        <h1 className="font-display mt-4 text-2xl font-extrabold md:text-3xl">
          {creating ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          {creating
            ? 'Save cards you’re watching and keep your settings across visits.'
            : 'Sign in to pick up where you left off.'}
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3">
          {creating && (
            <>
              <label className="grid gap-1.5">
                <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                  Full name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  placeholder="Satwik Gupta"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                  Age
                </span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  className="field"
                  placeholder="21"
                  inputMode="numeric"
                  required
                />
              </label>
            </>
          )}

          <label className="grid gap-1.5">
            <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
              Password
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pr-20"
                autoComplete={creating ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-faint absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold transition-colors hover:text-[var(--text)]"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {creating && <span className="text-faint text-xs">{PASSWORD_RULES}</span>}
          </label>

          {creating && (
            <label className="grid gap-1.5">
              <span className="text-faint text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                Confirm password
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field"
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#ff9aa8]/35 bg-[#ff9aa8]/10 px-3 py-2 text-xs leading-relaxed text-[#ff9aa8]"
            >
              <Icon name="close" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary mt-1 w-full">
            {busy ? 'One moment…' : creating ? 'Create account' : 'Sign in'}
            {!busy && <Icon name="arrowRight" className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-muted mt-5 text-center text-sm">
          {creating ? 'Already have an account?' : 'New here?'}{' '}
          <Link
            to={creating ? '/signin' : '/signup'}
            className="text-brand-400 font-bold hover:underline"
          >
            {creating ? 'Sign in' : 'Create one'}
          </Link>
        </p>

        {/*
          Said plainly rather than buried: this project has no server, so an
          account is a record in this browser. Anyone told to "use a real
          password" deserves to know where it ends up.
        */}
        <p className="text-faint mt-5 border-t border-[var(--border)] pt-4 text-xs leading-relaxed">
          <Icon name="shield" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          Accounts are stored in this browser only — there's no server behind Vaultly. Your
          password is hashed before it's saved, but please don't reuse a password that protects
          anything real.
        </p>
      </motion.div>
    </div>
  );
}
