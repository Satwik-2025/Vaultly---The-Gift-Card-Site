import { useState } from 'react';
import type { Platform } from '../types';

interface PlatformMarkProps {
  platform: Platform;
  /** Tile height. Width is derived from the logo's own shape. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TILE = {
  sm: { box: 'h-8 min-w-8 rounded-lg px-1.5', img: 'max-w-[4.5rem]', text: 'text-[0.62rem]' },
  md: { box: 'h-10 min-w-10 rounded-xl px-2', img: 'max-w-[5.5rem]', text: 'text-xs' },
  lg: { box: 'h-11 min-w-11 rounded-2xl px-2', img: 'max-w-[6.5rem]', text: 'text-xs' },
} as const;

/**
 * The seller's own logo — GyFTR, Woohoo, Amazon — instead of a two-letter
 * monogram.
 *
 * The tile is **height-fixed and width-auto**, because these marks are not the
 * same shape: Woohoo publishes a square roundel, while GyFTR and Amazon only
 * publish wide wordmarks. Forcing all three into a square box scaled the
 * wordmarks down to an illegible smudge, so the box now grows sideways to fit
 * whatever shape the logo actually is. Every tile still shares one height, so
 * the row stays visually even.
 *
 * White background: these are full-colour marks drawn for light backgrounds and
 * would otherwise disappear against the dark theme. Falls back to the
 * accent-coloured monogram if the file is missing or fails to load.
 */
export function PlatformMark({ platform, size = 'md', className = '' }: PlatformMarkProps) {
  const [failed, setFailed] = useState(false);
  const tile = TILE[size];
  const src = platform.logo ? `${import.meta.env.BASE_URL}${platform.logo}` : null;
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden shadow-lg ${tile.box} ${className}`}
      style={{
        background: showImage
          ? '#fff'
          : `linear-gradient(135deg, ${platform.accent}, ${platform.accent}99)`,
      }}
    >
      {showImage ? (
        <img
          src={src!}
          alt={platform.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-auto object-contain py-1.5 ${tile.img}`}
        />
      ) : (
        <span className={`font-extrabold text-white ${tile.text}`}>{platform.initials}</span>
      )}
    </span>
  );
}
