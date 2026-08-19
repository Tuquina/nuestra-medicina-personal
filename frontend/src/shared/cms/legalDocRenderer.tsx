import type { ReactNode } from 'react';
import { LegalSection, LegalParagraph, LegalList, LegalNote, LegalLink } from '../components/LegalPage/LegalPage';
import type { LegalDocProps } from './legalDocContent';

/**
 * Split out from `legalDocContent.ts` (data/seeds) purely so that file
 * can stay JSX-free — mixing component and non-component exports in one
 * `.tsx` file breaks Fast Refresh (oxlint's `react/only-export-components`).
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** Renders inline `**bold**` and auto-links bare email addresses within
 * one line of text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    const emailParts = part.split(EMAIL_RE);
    const emails = part.match(EMAIL_RE) ?? [];
    if (emails.length === 0) return <span key={key}>{part}</span>;
    return (
      <span key={key}>
        {emailParts.map((chunk, j) => (
          <span key={`${key}-${j}`}>
            {chunk}
            {emails[j] && <LegalLink href={`mailto:${emails[j]}`}>{emails[j]}</LegalLink>}
          </span>
        ))}
      </span>
    );
  });
}

/** Parses one `LegalDocSection.body` (see `legalDocContent.ts`'s doc
 * comment for the markdown-lite dialect) into the same
 * `LegalParagraph`/`LegalList`/`LegalNote` components the hand-written
 * legal pages used before this became content-driven. */
function renderBody(body: string): ReactNode {
  const blocks = body.split(/\n\s*\n/).filter((block) => block.trim().length > 0);

  return blocks.map((block, i) => {
    const lines = block.split('\n').map((line) => line.trim());
    const key = `block-${i}`;

    if (lines.every((line) => line.startsWith('- '))) {
      return <LegalList key={key} items={lines.map((line) => line.slice(2))} />;
    }

    if (lines[0].startsWith('> ')) {
      const noteText = [lines[0].slice(2), ...lines.slice(1)].join(' ');
      return <LegalNote key={key}>{renderInline(noteText, key)}</LegalNote>;
    }

    return <LegalParagraph key={key}>{renderInline(lines.join(' '), key)}</LegalParagraph>;
  });
}

/** The full prose body for a legal document — the intro note plus every
 * numbered `LegalSection`, ready to drop inside a `<LegalPage>`. */
export function LegalDocBody({ doc }: { doc: LegalDocProps }) {
  return (
    <>
      <LegalNote>{renderInline(doc.introNote, 'intro')}</LegalNote>
      {doc.sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          {renderBody(section.body)}
        </LegalSection>
      ))}
    </>
  );
}
