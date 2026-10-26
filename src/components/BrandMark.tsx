import { useState } from 'react';
import type { Brand } from '../types';

interface BrandMarkProps {
  brand: Brand;
  className?: string;
  /** Tailwind text size for the initials fallback */
  textClassName?: string;
}

/**
 * The seller's own brand logo, falling back to a gradient monogram when the
 * image is missing or fails to load (CDN URLs do rot between scrapes).
 */
export function BrandMark({ brand, className = 'h-12 w-12', textClassName = 'text-sm' }: BrandMarkProps) {
  const [failed, setFailed] = useState(false);
  const showImage = brand.logo && !failed;

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl shadow-lg ${className}`}
      style={{
        background: showImage
          ? '#fff'
          : `linear-gradient(135deg, ${brand.gradient[0]}, ${brand.gradient[1]})`,
      }}
    >
      {showImage ? (
        <img
          src={brand.logo!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className={`font-extrabold text-white ${textClassName}`}>{brand.initials}</span>
      )}
    </span>
  );
}
