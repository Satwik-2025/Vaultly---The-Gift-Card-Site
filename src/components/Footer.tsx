import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { generatedAt, listPlatforms } from '../services/catalog';

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
                <li>
                  <a href="#contact" className="text-muted transition-colors hover:text-[var(--text)]">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-faint text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                Contact
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:hello@vaultly.in"
                    className="text-muted transition-colors hover:text-[var(--text)]"
                  >
                    hello@vaultly.in
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+911800000000"
                    className="text-muted transition-colors hover:text-[var(--text)]"
                  >
                    1800 000 000
                  </a>
                </li>
                <li className="text-muted">Mon–Sat, 10:00–19:00 IST</li>
              </ul>
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
