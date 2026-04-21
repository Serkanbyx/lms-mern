import { Seo } from '../../components/seo/index.js';
import PlaceholderPage from '../_PlaceholderPage.jsx';

export default function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How Lumen LMS collects, uses and protects your personal data — written in plain language."
        url="/privacy"
      />
      <PlaceholderPage name="Privacy Policy" step={26} />
    </>
  );
}
