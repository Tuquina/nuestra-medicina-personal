import type { ReactNode } from 'react';
import { GradientTopBar } from '../GradientTopBar/GradientTopBar';
import { SiteHeader } from '../SiteHeader/SiteHeader';
import { SiteFooter } from '../SiteFooter/SiteFooter';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import styles from './LegalPage.module.css';

export interface LegalSectionDef {
  id: string;
  title: string;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  updatedLabel: string;
  sections: LegalSectionDef[];
  children: ReactNode;
  /** True when rendering an admin's "Vista previa" of unpublished changes. */
  preview?: boolean;
}

/**
 * Shared layout for `/terminos` and `/privacidad` — a hero (eyebrow +
 * title + "last updated" line), a two-column table of contents linking
 * to each section's anchor, and a prose body. No `.dc.html` mockup
 * exists for these (they weren't part of the original handoff bundle),
 * so this follows the site's existing typographic conventions (serif
 * headings, the same Eyebrow/GradientTopBar/SiteHeader/SiteFooter used
 * everywhere else) rather than a specific source design.
 */
export function LegalPage({ eyebrow, title, updatedLabel, sections, children, preview = false }: LegalPageProps) {
  return (
    <div className={styles.page}>
      {preview && (
        <div className={styles.previewBanner} role="status">
          Vista previa — estás viendo cambios sin publicar.
        </div>
      )}
      <GradientTopBar />
      <SiteHeader />

      <div className={styles.hero}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.updated}>{updatedLabel}</p>
      </div>

      <div className={styles.body}>
        <nav className={styles.toc} aria-label="Contenido">
          <p className={styles.tocTitle}>Contenido</p>
          <ol className={styles.tocList}>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        {children}
      </div>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className={styles.paragraph}>{children}</p>;
}

/** `items` are plain strings (rendered as-is) — keyed by their own text,
 * which is fine since this is always static, never-reordered content. */
export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** A highlighted callout — used for the placeholder legal-identity fields
 * and other "fill this in" notes so they're visually distinct from the
 * actual policy text. */
export function LegalNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

/** A `mailto:`/external link styled to match the prose (an inline
 * `<a>` with a raw class name string won't pick up the CSS module's
 * hashed class, hence this wrapper). */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={styles.contactLink} href={href}>
      {children}
    </a>
  );
}
