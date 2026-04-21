/**
 * `FinalCta` — closing brand-gradient banner.
 *
 * Last conversion attempt before the footer. The gradient uses the
 * primary token plus a complementary info-blue so it always rebrands
 * cleanly with the rest of the palette. Two CTAs (one primary "start
 * learning", one ghost "talk to teaching team") let visitors with both
 * intents pick a path without scrolling back up.
 */

import { Link } from 'react-router-dom';

import { Button, Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { ROUTES } from '../../utils/constants.js';

export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="mx-auto max-w-7xl px-6 pb-20"
    >
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl
          bg-linear-to-br from-primary via-primary to-info
          px-8 py-14 sm:px-14 sm:py-16 text-primary-fg shadow-lg">

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20
              bg-[radial-gradient(circle_at_top_right,white,transparent_55%),radial-gradient(circle_at_bottom_left,white,transparent_55%)]"
          />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2
                id="final-cta-heading"
                className="text-3xl sm:text-4xl font-semibold tracking-tight"
              >
                Start learning today.
              </h2>
              <p className="mt-3 text-primary-fg/85 max-w-lg">
                Create a free account in under a minute. Browse the full
                catalog, save courses for later, and pick up exactly where
                you left off — on any device.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button
                as={Link}
                to={ROUTES.register}
                size="lg"
                className="bg-bg text-primary hover:bg-bg-subtle hover:text-primary-hover
                  shadow-md"
                rightIcon={<Icon name="ArrowRight" size={18} />}
              >
                Create free account
              </Button>
              <Button
                as={Link}
                to={ROUTES.catalog}
                size="lg"
                variant="ghost"
                className="text-primary-fg hover:bg-white/10"
              >
                Browse catalog
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default FinalCta;
