/**
 * The Vaultly lockup.
 *
 * The supplied artwork is one wide PNG with an opaque dark-navy background, so
 * it can't be dropped straight onto a light theme without reading as a pasted
 * rectangle.
 *
 * So the lockup is rebuilt: the V is cropped square from the original (a region
 * crop, so its gradient background stays continuous) and set in a rounded tile,
 * and the wordmark beside it is live text. That way it takes the theme's own
 * ink, stays crisp at any size, and the tagline can be shown or hidden per
 * placement. The "ly" keeps the artwork's cyan (#18cce0, sampled from the PNG)
 * so the text and the mark still read as one piece.
 *
 * The artwork as supplied lives at docs/vaultly-logo.png for the README.
 */
const TAGLINE = 'Unlock more value';

export function Logo({
  className = '',
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  const base = `${import.meta.env.BASE_URL}brand`;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={`${base}/vaultly-mark.png`}
        alt=""
        width={263}
        height={263}
        className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-lg"
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-display text-lg font-extrabold tracking-tight">
          Vault<span style={{ color: '#18cce0' }}>ly</span>
        </span>
        {showTagline && (
          <span className="text-faint mt-1 text-[0.58rem] font-semibold tracking-[0.18em] uppercase">
            {TAGLINE}
          </span>
        )}
      </span>
    </span>
  );
}
