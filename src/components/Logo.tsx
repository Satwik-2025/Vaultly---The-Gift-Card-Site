/**
 * The Vaultly lockup, built to match the supplied artwork.
 *
 * The artwork itself is one wide PNG with an opaque dark-navy background, so it
 * can't sit on the light themes without reading as a pasted rectangle. The V is
 * cropped square from it (a region crop, so its gradient background stays
 * continuous) and the wordmark is live text — it takes each theme's ink and
 * stays sharp at any size.
 *
 * Layout follows the artwork: the tagline runs under the wordmark, justified
 * to exactly the width of "Vaultl", and the "y" sits outside that column so its
 * descender drops down beside "VALUE" rather than over it. Everything is sized
 * in em off one font size (`size`), so those proportions hold wherever the
 * lockup is placed.
 *
 * The "ly" keeps the artwork's cyan (#18cce0, sampled from the PNG). The
 * original lives at docs/vaultly-logo.png for the README.
 */
const TAGLINE = 'UNLOCK MORE VALUE';
const CYAN = '#18cce0';

export function Logo({
  className = '',
  showTagline = false,
  size = 24,
}: {
  className?: string;
  showTagline?: boolean;
  /** Wordmark size in px; the mark and tagline scale with it. */
  size?: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[0.34em] leading-none ${className}`}
      style={{ fontSize: size }}
    >
      <img
        src={`${import.meta.env.BASE_URL}brand/vaultly-mark.png`}
        alt=""
        width={263}
        height={263}
        className="h-[1.5em] w-[1.5em] shrink-0 rounded-[0.32em] object-cover shadow-lg"
      />

      <span className="font-display inline-flex items-start font-extrabold tracking-tight">
        {/* This column's width is the width of "Vaultl" — the tagline below
            stretches to exactly that. */}
        <span className="inline-flex flex-col">
          <span>
            Vault<span style={{ color: CYAN }}>l</span>
          </span>
          {showTagline && (
            <>
              {/* Pulled up into the descender zone, level with the y's tail. */}
              <span
                aria-hidden
                className="flex w-full justify-between font-sans font-semibold tracking-normal text-[var(--muted)]"
                style={{ fontSize: '0.235em', marginTop: '0.12em' }}
              >
                {/*
                  Letters spread edge to edge rather than tracked by a fixed
                  amount, so the line always ends exactly under the last letter
                  of "Vaultl" — whatever font the browser falls back to.
                */}
                {[...TAGLINE].map((ch, i) =>
                  ch === ' ' ? (
                    <span key={i} className="w-[0.5em]" />
                  ) : (
                    <span key={i}>{ch}</span>
                  ),
                )}
              </span>
              <span className="sr-only">Unlock more value</span>
            </>
          )}
        </span>
        <span style={{ color: CYAN }}>y</span>
      </span>
    </span>
  );
}
