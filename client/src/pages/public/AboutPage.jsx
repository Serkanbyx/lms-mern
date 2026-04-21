import { Seo } from '../../components/seo/index.js';
import PlaceholderPage from '../_PlaceholderPage.jsx';

export default function AboutPage() {
  return (
    <>
      <Seo
        title="About"
        description="Learn what Lumen LMS is, who builds it, and the mission behind the platform — practical, project-based learning for everyone."
        url="/about"
      />
      <PlaceholderPage name="About Lumen LMS" step={26} />
    </>
  );
}
