import { Seo } from '../../components/seo/index.js';
import PlaceholderPage from '../_PlaceholderPage.jsx';

export default function BecomeInstructorPage() {
  return (
    <>
      <Seo
        title="Teach on Lumen LMS"
        description="Share your expertise, reach motivated learners worldwide and earn from your courses. Join the Lumen LMS instructor program."
        url="/teach"
      />
      <PlaceholderPage
        name="Become an Instructor"
        step={26}
        description="Marketing pitch for instructors — value prop, payouts, support. Ships alongside the landing page."
      />
    </>
  );
}
