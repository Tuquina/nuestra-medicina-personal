import { NewsletterSignup } from '../../../shared/components/NewsletterSignup/NewsletterSignup';
import type { NewsletterProps } from '../../../shared/cms/homeContent';

export function Newsletter({ title, subtitle, buttonLabel, confirmationText, fineprint }: NewsletterProps) {
  return (
    <NewsletterSignup
      sectionId="novedades"
      title={title}
      subtitle={subtitle}
      buttonLabel={buttonLabel}
      confirmationText={confirmationText}
      fineprint={fineprint}
    />
  );
}
