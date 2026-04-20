/**
 * `LandingPage` — public marketing entry point at `/`.
 *
 * Purely a section orchestrator: every visual block is its own component
 * under `components/landing/*`, so adding a band, swapping copy or
 * reordering the funnel only touches one file at a time.
 *
 * SEO — sets per-page meta via `react-helmet-async` (the provider is
 * mounted at the app root in `main.jsx`). Canonical URL is built from
 * `window.location.origin` at render time so the same code ships clean
 * across local, staging and production hosts.
 *
 * Performance — see STEP 26 ("Above the fold loads in < 2.5s on a fast
 * 3G connection"): the hero is fully static so it paints with the JS
 * bundle, and `FeaturedCourses` is the only section that talks to the
 * API. Below-fold imagery on the catalog cards uses native `loading="lazy"`.
 */

import { Helmet } from 'react-helmet-async';

import {
  CategoryGrid,
  FaqAccordion,
  FeatureGrid,
  FeaturedCourses,
  FinalCta,
  HeroSection,
  HowItWorks,
  InstructorCTA,
  TestimonialGrid,
} from '../../components/landing/index.js';

const SEO = {
  title: 'Lumen LMS — Master new skills online',
  description:
    'Project-based courses in programming, design, business and more. Learn at your pace with HD video, quizzes, progress tracking and verifiable certificates.',
  ogImage: '/og-default.png',
};

export default function LandingPage() {
  const canonical =
    typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

  return (
    <>
      <Helmet>
        <title>{SEO.title}</title>
        <meta name="description" content={SEO.description} />
        <link rel="canonical" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={SEO.title} />
        <meta property="og:description" content={SEO.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={SEO.ogImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO.title} />
        <meta name="twitter:description" content={SEO.description} />
        <meta name="twitter:image" content={SEO.ogImage} />
      </Helmet>

      <HeroSection />
      <CategoryGrid />
      <FeaturedCourses />
      <HowItWorks />
      <FeatureGrid />
      <InstructorCTA />
      <TestimonialGrid />
      <FaqAccordion />
      <FinalCta />
    </>
  );
}
