/**
 * Site Footer — three-column link grid plus a brand strip.
 *
 * Anchored at the bottom of `MainLayout`. The top border uses a subtle
 * brand-coloured gradient so the footer feels like a deliberate visual
 * close to the page rather than just "where the content ran out".
 */

import { Link } from 'react-router-dom';

import { Logo } from '../brand/index.js';
import { Icon } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { to: ROUTES.catalog, label: 'Browse courses' },
      { to: ROUTES.teach, label: 'Become an instructor' },
      { to: ROUTES.dashboard, label: 'My learning' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { to: ROUTES.about, label: 'About' },
      { to: ROUTES.teach, label: 'For teaching' },
      { to: 'mailto:hello@lumen.lms', label: 'Contact', external: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: ROUTES.terms, label: 'Terms of Service' },
      { to: ROUTES.privacy, label: 'Privacy Policy' },
    ],
  },
];

const SOCIALS = [
  { href: 'https://github.com', label: 'GitHub', icon: 'Github' },
  { href: 'https://twitter.com', label: 'Twitter', icon: 'Twitter' },
  { href: 'https://www.linkedin.com', label: 'LinkedIn', icon: 'Linkedin' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="border-t border-border bg-bg-subtle mt-16 relative"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-text-muted max-w-xs">
            Learn anything. Teach anyone. A modern home for online courses.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h3 className="text-sm font-semibold text-text mb-3">
              {column.heading}
            </h3>
            <ul className="space-y-2 text-sm">
              {column.links.map((link) =>
                link.external ? (
                  <li key={link.to}>
                    <a
                      href={link.to}
                      className="text-text-muted hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-text-muted hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-subtle">
            © {year} Lumen LMS. All rights reserved.
          </p>
          <ul className="flex items-center gap-3">
            {SOCIALS.map((social) => (
              <li key={social.href}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:text-primary hover:bg-bg-muted transition-colors"
                >
                  <Icon name={social.icon} size={16} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-6 py-3 text-center text-xs text-text-subtle">
          Created by{' '}
          <a
            href="https://serkanbayraktar.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-text-muted hover:text-primary transition-colors"
          >
            Serkanby
          </a>
          {' | '}
          <a
            href="https://github.com/Serkanbyx"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-text-muted hover:text-primary transition-colors"
          >
            Github
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
