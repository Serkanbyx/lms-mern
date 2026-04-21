/**
 * `TermsPage` — `/terms`.
 *
 * Static, plain-language Terms of Service. Copy is maintained directly in
 * this file (no CMS) so policy changes go through code review and ship
 * with the rest of the app. The shared `LegalPage` shell handles the
 * surrounding chrome (table of contents, last-updated stamp, contact
 * footer) — keep new sections in the order they should appear.
 */

import { Seo } from '../../components/seo/index.js';
import LegalPage from './_LegalPage.jsx';

const TERMS_SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: [
      'By creating an account, enrolling in a course or otherwise using Lumen LMS (the "Service"), you agree to be bound by these Terms of Service and by our Privacy Policy. If you do not agree, please do not use the Service.',
      'These terms apply to learners, instructors and any visitor browsing public pages. You confirm that you are at least 13 years old, or the minimum digital-consent age in your jurisdiction, whichever is higher.',
    ],
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: [
      'You are responsible for keeping your login credentials confidential and for all activity under your account. Notify us immediately at hello@lumen.lms if you suspect unauthorised access.',
      'We may suspend or terminate accounts that breach these terms, infringe other users\u2019 rights or expose the Service to legal or security risk.',
    ],
  },
  {
    id: 'content',
    title: 'Course content & licensing',
    body: [
      'Instructors retain ownership of the original course materials they upload. By publishing on Lumen LMS, instructors grant us a worldwide, non-exclusive licence to host, stream and display that content for the purpose of operating the Service.',
      'Learners receive a personal, non-transferable, non-commercial licence to view enrolled content. Downloading, redistributing or reselling course materials without written permission from the instructor is prohibited.',
      'You retain ownership of any feedback, reviews and discussion posts you submit, and grant us the right to display them within the Service in association with the relevant course.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: [
      'Do not upload or share content that is illegal, defamatory, harassing, hateful, sexually exploitative, plagiarised or that infringes intellectual-property rights. Do not attempt to disrupt the Service, probe for vulnerabilities outside our published security policy, or scrape data at scale.',
      'We rely on community reports plus automated checks to enforce these rules. Repeated violations will result in account termination without refund.',
    ],
  },
  {
    id: 'payments',
    title: 'Payments, refunds & taxes',
    body: [
      'Where paid courses are offered, the price shown at checkout is the price you pay. Local taxes, where applicable, are added at the final step.',
      'Learners may request a refund within 14 days of enrolment, provided they have completed less than 30% of the course. Refunds are returned to the original payment method.',
      'Instructors are paid out via the payout method configured in their account settings. We deduct a platform fee disclosed in the instructor agreement before transferring earnings.',
    ],
  },
  {
    id: 'certificates',
    title: 'Certificates of completion',
    body: 'Certificates issued by Lumen LMS confirm that a learner finished a specific course on a specific date. They are not formal academic qualifications and are not accredited by any government or university unless explicitly stated on the certificate itself.',
  },
  {
    id: 'availability',
    title: 'Availability & changes to the Service',
    body: [
      'We work hard to keep Lumen LMS available 24/7, but we do not guarantee uninterrupted access. Planned maintenance windows are communicated in advance whenever possible.',
      'We may add, modify or remove features at any time. We will not retroactively remove access to a course you have paid for; if a course is removed by an instructor, learners who already enrolled keep access for at least 12 months.',
    ],
  },
  {
    id: 'liability',
    title: 'Disclaimers & limitation of liability',
    body: [
      'The Service and the course content are provided "as is" without warranties of any kind, whether express or implied. We do not warrant that the content is accurate, complete or fit for a particular purpose.',
      'To the maximum extent permitted by law, our total liability arising from your use of the Service is limited to the greater of (a) the amount you paid us in the previous 12 months or (b) USD 100. We are not liable for indirect, incidental or consequential damages.',
    ],
  },
  {
    id: 'termination',
    title: 'Termination',
    body: 'You may close your account at any time from Settings → Account. We may suspend or terminate access if you breach these terms, if continued access exposes the platform to legal risk, or as required by law. Sections that by their nature should survive termination — such as content licences for previously published material, payment obligations and limitation of liability — will continue to apply.',
  },
  {
    id: 'governing-law',
    title: 'Governing law & disputes',
    body: 'These terms are governed by the laws of the jurisdiction in which Lumen LMS is registered, without regard to its conflict-of-laws rules. Any dispute will first be addressed through good-faith negotiation; if unresolved, it will be settled by the competent courts of that jurisdiction.',
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: 'We may update these Terms of Service from time to time. Material changes are announced via in-app notice and email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the revised terms.',
  },
];

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="The rules that govern your use of Lumen LMS — accounts, content, payments and platform policies."
        url="/terms"
      />
      <LegalPage
        title="Terms of Service"
        subtitle="The agreement between you and Lumen LMS when you create an account, enrol in a course or publish content on the platform."
        effectiveDate="2026-04-01"
        intro="This is the plain-English version of our terms. We try to keep it short, specific and free of legalese — but where a section uses a defined word like “Service”, the meaning carries through the whole document."
        sections={TERMS_SECTIONS}
      />
    </>
  );
}
