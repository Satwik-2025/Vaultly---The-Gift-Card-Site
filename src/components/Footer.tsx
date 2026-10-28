import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { generatedAt, listPlatforms } from '../services/catalog';

/**
 * Where to reach the person behind Vaultly. LinkedIn is shown once its
 * profile address is filled in.
 */
const CONTACT = {
  email: 'satwikgupta2005@gmail.com',
  github: 'https://github.com/Satwik-2025',
  linkedin: 'https://www.linkedin.com/in/satwikgupta2005/',
};

/** The GitHub and LinkedIn marks, filled, at text size. */
const BRAND_PATHS = {
  github:
    'M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z',
  linkedin:
    'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z',
};

function ContactLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="text-muted inline-flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--text)]"
    >
      {icon}
      {label}
    </a>
  );
}

export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-24 pt-20 pb-10">
      <div className="shell">
        <div className="glass glass-sheen overflow-hidden rounded-[var(--radius-xl2)]">
          <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_1fr_1fr] md:p-9">
            <div>
              <div className="flex items-center gap-2.5">
                <Logo showTagline size={30} />
              </div>
              <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
                We compare gift card prices and put the terms that actually matter — stacking,
                clubbing, validity and leftover balance — right next to the price.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {listPlatforms().map((p) => (
                  <span key={p.id} className="chip !text-[0.65rem]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-faint text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                Explore
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/search" className="text-muted transition-colors hover:text-[var(--text)]">
                    All gift cards
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-faint text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                Contact
              </h4>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <ContactLink
                  href={`mailto:${CONTACT.email}`}
                  label="contact"
                  icon={
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
                    </svg>
                  }
                />
                <ContactLink
                  href={CONTACT.github}
                  label="github"
                  icon={
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d={BRAND_PATHS.github} />
                    </svg>
                  }
                />
                {CONTACT.linkedin && (
                  <ContactLink
                    href={CONTACT.linkedin}
                    label="linkedin"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                        <path d={BRAND_PATHS.linkedin} />
                      </svg>
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <div className="text-faint flex flex-col gap-2 border-t border-[var(--border)] px-6 py-4 text-xs md:flex-row md:items-center md:justify-between md:px-9">
            <p>
              © {new Date().getFullYear()} Vaultly · prices read from sellers on{' '}
              {new Date(generatedAt()).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p>Always confirm the final price and terms on the seller's own page before buying.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
