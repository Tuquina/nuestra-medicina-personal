import { useState } from 'react';
import styles from './FaqAccordion.module.css';

interface FaqAccordionProps {
  faqs: { q: string; a: string }[];
  /** Omit when the surrounding page already has its own heading (e.g. a
   * hero title) — a book landing page still wants its own. */
  heading?: string;
}

/** "Preguntas frecuentes" — a single-open accordion (matches the mockup). */
export function FaqAccordion({ faqs, heading = 'Preguntas frecuentes' }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className={styles.section}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      <div className={styles.list}>
        {faqs.map((faq, index) => {
          const open = openIndex === index;
          const answerId = `faq-answer-${index}`;
          return (
            <div key={faq.q} className={styles.item}>
              <button
                type="button"
                className={styles.question}
                aria-expanded={open}
                aria-controls={answerId}
                onClick={() => setOpenIndex(open ? -1 : index)}
              >
                <span className={styles.questionText}>{faq.q}</span>
                <span className={styles.sign} aria-hidden="true">
                  {open ? '–' : '+'}
                </span>
              </button>
              {open && (
                <p id={answerId} className={styles.answer}>
                  {faq.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
