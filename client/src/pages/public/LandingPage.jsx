/**
 * `LandingPage` — public marketing entry point at `/`.
 *
 * Purely a section orchestrator: every visual block is its own component
 * under `components/landing/*`, so adding a band, swapping copy or
 * reordering the funnel only touches one file at a time.
 *
 * SEO — delegates per-page meta to the shared `<Seo>` component (the
 * `HelmetProvider` is mounted at the app root in `main.jsx`). Canonical
 * URL is derived from `VITE_SITE_URL` so the same code ships clean
 * across local, staging and production hosts.
 *
 * Performance budget — "above the fold loads in < 2.5s on a fast 3G
 * connection". The hero is fully static so it paints with the JS
 * bundle, and `FeaturedCourses` is the only section that talks to the
 * API. Below-fold imagery on the catalog cards uses native `loading="lazy"`.
 */

import { Seo } from '../../components/seo/index.js';
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

export default function LandingPage() {
  return (
    <>
      <Seo
        title="Learn anything online"
        description="Project-based courses in programming, design, business and more. Learn at your pace with HD video, quizzes, progress tracking and verifiable certificates."
        url="/"
      />

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
