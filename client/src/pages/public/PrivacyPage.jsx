/**
 * `PrivacyPage` — `/privacy`.
 *
 * Static, plain-language Privacy Policy. Mirrors the structure of the
 * Terms page so users can navigate both with the same muscle memory.
 * Copy is intentionally specific about the categories of data we collect
 * and the third-party processors involved (none beyond hosting today).
 */

import { Seo } from '../../components/seo/index.js';
import LegalPage from './_LegalPage.jsx';

const PRIVACY_SECTIONS = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: 'Lumen LMS is the controller of personal data processed via the platform at lumen.lms (the "Service"). Throughout this policy, "we", "us" and "our" refer to the Lumen LMS team. You can reach us at hello@lumen.lms for any privacy-related question or to exercise your data-subject rights.',
  },
  {
    id: 'data-we-collect',
    title: 'Personal data we collect',
    body: [
      'Account data — your name, email address, hashed password, optional avatar URL and the role assigned to your account (learner, instructor, admin).',
      'Learning activity — courses you enrol in, lessons you mark as complete, quiz attempts, certificate IDs and the timestamps of these events. We use this data to render your dashboard, calculate progress and issue certificates.',
      'Technical data — IP address, browser user-agent and device type, captured in standard server logs and used to debug issues, prevent abuse and produce aggregate usage analytics.',
      'Communication data — messages you send to support and the content of any reviews or discussion posts you publish.',
    ],
  },
  {
    id: 'how-we-use',
    title: 'How we use your data',
    body: [
      'To operate the Service — authenticate you, deliver course content, persist your progress and issue completion certificates.',
      'To communicate with you — send transactional emails (verification, password reset, certificate ready, billing receipts) and, where you opt in, occasional product updates. You can opt out of marketing emails at any time from Settings → Notifications.',
      'To keep the platform safe — detect fraudulent sign-ups, enforce rate limits and respond to security incidents.',
      'To improve the product — analyse aggregate, anonymised usage patterns to prioritise features and fix UX paper-cuts.',
    ],
  },
  {
    id: 'legal-bases',
    title: 'Legal bases for processing',
    body: 'We process personal data on the legal bases set out in the GDPR and equivalent regulations: performance of the contract you enter into when you create an account; our legitimate interest in operating, securing and improving the Service; your explicit consent for optional features (e.g. marketing emails); and compliance with our legal obligations (e.g. tax records on paid courses).',
  },
  {
    id: 'cookies',
    title: 'Cookies and similar technologies',
    body: [
      'We use a small number of strictly-necessary cookies and `localStorage` entries to keep you signed in and remember your preferences (theme, font size, accessibility toggles). These do not require consent because the Service cannot function without them.',
      'We do not run third-party advertising trackers, analytics scripts or fingerprinting libraries. If we add an analytics provider in the future, you will see a consent banner before any optional cookies are set.',
    ],
  },
  {
    id: 'sharing',
    title: 'Who we share data with',
    body: [
      'Hosting & infrastructure — our application code runs on Render and the database on MongoDB Atlas. Static assets are served by Netlify\u2019s edge network. These providers process data only to deliver the infrastructure service we contract with them for.',
      'Email delivery — transactional emails are dispatched via a third-party email provider that processes the recipient address solely to deliver the message.',
      'Legal disclosures — we may disclose data when compelled by a valid legal request, or to defend our rights and the safety of our users.',
      'We do not sell personal data and we do not share it with third parties for their own marketing purposes.',
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep your data',
    body: 'Account data is retained for as long as your account is active and for up to 30 days after deletion to allow recovery in case of accidental closure. Learning history attached to issued certificates is retained for 5 years so the certificates remain verifiable. Server logs are retained for 90 days. Backups follow a rolling 30-day window.',
  },
  {
    id: 'security',
    title: 'How we protect your data',
    body: 'Passwords are stored using a strong, modern hashing algorithm (bcrypt with a per-password salt). All traffic is encrypted in transit with TLS. Refresh tokens are stored in HTTP-only, Secure, SameSite cookies. Access to production systems is limited, audited and protected by multi-factor authentication. We follow a documented incident-response process and will notify affected users and competent authorities within the timeframes required by law.',
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: [
      'You have the right to access the personal data we hold about you, to correct it, to request its deletion, to restrict or object to certain processing, and to receive a portable copy of your data. You can also withdraw any consent you previously gave at any time without affecting the lawfulness of prior processing.',
      'Most rights can be exercised directly from Settings — Profile (correction), Account (deletion) and Notifications (consent). For any request that cannot be self-served, email hello@lumen.lms and we will respond within 30 days.',
      'If you believe your data is being mishandled, you have the right to lodge a complaint with your national data-protection authority.',
    ],
  },
  {
    id: 'transfers',
    title: 'International data transfers',
    body: 'Some of our processors are located outside your country of residence. When personal data is transferred to a country that does not provide an adequate level of protection, we rely on the European Commission\u2019s Standard Contractual Clauses (or the equivalent mechanism in your jurisdiction) to safeguard the transfer.',
  },
  {
    id: 'children',
    title: 'Children\u2019s data',
    body: 'Lumen LMS is not directed at children under 13 (or the higher minimum digital-consent age set by your jurisdiction). We do not knowingly collect personal data from children. If you become aware that a child has signed up without verifiable parental consent, please contact us so we can remove the account.',
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: 'We will update this Privacy Policy as the platform evolves. Material changes are announced via in-app notice and, where required by law, by email at least 14 days before they take effect. The "Last updated" date at the top of this page always reflects the current version.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How Lumen LMS collects, uses and protects your personal data — written in plain language."
        url="/privacy"
      />
      <LegalPage
        title="Privacy Policy"
        subtitle="What we collect, why we collect it and the controls you have over your data on Lumen LMS."
        effectiveDate="2026-04-01"
        intro={
          'We treat your data the way we\u2019d want ours treated: collected only when there\u2019s a clear reason, kept only as long as needed, and never sold to anyone. This page explains the specifics.'
        }
        sections={PRIVACY_SECTIONS}
      />
    </>
  );
}
