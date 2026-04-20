/**
 * `FaqAccordion` — six common questions wrapped in the shared `Accordion`
 * primitive. Doubles as SEO surface (each answer is plain text in the
 * DOM even when the panel is collapsed, since `Accordion` mounts the
 * panel content lazily — but the section is structured so a future
 * static-render step can swap in a JSON-LD FAQPage block effortlessly).
 */

import { Accordion } from '../ui/index.js';
import { Reveal } from '../layout/index.js';

const FAQS = [
  {
    id: 'free',
    title: 'Are there free courses?',
    content:
      'Yes — every category has a curated set of free courses, and many paid courses include a free preview lesson so you can try the instructor before you commit.',
  },
  {
    id: 'access',
    title: 'How long do I have access after enrolling?',
    content:
      'Once you enroll in a course, you get lifetime access. You can revisit any lesson, download your certificate again, or pick up where you left off — at any time, on any device.',
  },
  {
    id: 'certificates',
    title: 'Do certificates actually mean something?',
    content:
      'Each certificate includes a unique verification ID and links to your public profile, so anyone can confirm it. Many of our learners use them as portfolio pieces or in performance reviews.',
  },
  {
    id: 'devices',
    title: 'Can I learn on my phone?',
    content:
      'Lumen is a fully responsive web app — lessons, quizzes and progress all sync across desktop, tablet and mobile. A dedicated mobile app is on the roadmap.',
  },
  {
    id: 'instructors',
    title: 'Who teaches the courses?',
    content:
      'Instructors are vetted working professionals — engineers, designers, marketers, data scientists. We approve every course manually before it goes live to keep quality consistent.',
  },
  {
    id: 'refunds',
    title: 'What if a course is not for me?',
    content:
      'Every paid course is covered by a 30-day no-questions-asked refund window. If it does not click, contact support and we will refund you in full.',
  },
];

export function FaqAccordion() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="mx-auto max-w-3xl px-6 py-16 lg:py-20"
    >
      <Reveal className="text-center mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Questions, answered
        </p>
        <h2
          id="faq-heading"
          className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-text"
        >
          Frequently asked questions
        </h2>
      </Reveal>

      <Reveal>
        <Accordion items={FAQS} type="single" />
      </Reveal>
    </section>
  );
}

export default FaqAccordion;
