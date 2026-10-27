interface IconProps {
  name: keyof typeof PATHS;
  className?: string;
  strokeWidth?: number;
  /** Closed-path icons (the bookmark) use this to show an active state. */
  fill?: string;
}

/** Single-source inline icon set — keeps the bundle asset-free and themeable. */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  sun: 'M12 4V2M12 22v-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M4 12H2M22 12h-2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  check: 'M4 12.5 9 17.5 20 6.5',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6',
  // Key-fact icons
  stack: 'M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17',
  merge: 'M4 4h3l5 6v10M20 4h-3l-3 3.6M14 16h6M17 13l3 3-3 3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5.2l3.4 2',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1M3 7.5V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2.5M3 7.5h15M21 10.5h-4a2 2 0 0 0 0 4h4v-4Z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  chevronDown: 'M6 9.5 12 15.5 18 9.5',
  spark: 'M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6L12 3Z',
  tag: 'M3 12.5V5a2 2 0 0 1 2-2h7.5L21 11.5 12.5 20 3 12.5ZM8 8h.01',
  shield: 'M12 3l7.5 3v5.5c0 4.4-3.1 8-7.5 9.5-4.4-1.5-7.5-5.1-7.5-9.5V6L12 3Z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  refresh: 'M20 11a8 8 0 1 0-.6 4M20 5v6h-6',
  // Drawn as a closed path so it can be filled to mark a saved card.
  bookmark: 'M6 4.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V5.5a1 1 0 0 1 1-1Z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  eyeOff:
    'M3.5 3.5l17 17M10.4 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.5 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
} as const;

export function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.7, fill = 'none' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type IconName = keyof typeof PATHS;
