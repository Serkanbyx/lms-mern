import { Seo } from '../../components/seo/index.js';
import PlaceholderPage from '../_PlaceholderPage.jsx';

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="The rules that govern your use of Lumen LMS — accounts, content, payments and platform policies."
        url="/terms"
      />
      <PlaceholderPage name="Terms of Service" />
    </>
  );
}
