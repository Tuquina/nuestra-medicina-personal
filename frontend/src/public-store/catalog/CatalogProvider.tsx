import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../../shared/api/client';
import { BOOKS_URL } from '../../shared/config/api';
import type { Book } from '../data/books';
import { CatalogContext } from './useCatalog';
import type { CatalogBookResponse, CatalogResponse, CatalogState } from './types';

function toBook(value: CatalogBookResponse): Book {
  return {
    id: value.id,
    slug: value.slug,
    title: value.title,
    subtitle: value.subtitle,
    authorName: value.authorName,
    category: value.category,
    variant: value.variant,
    shortDescription: value.shortDescription,
    priceMinorUnits: value.priceMinorUnits,
    currency: value.currency,
    format: value.format,
    isbn: value.isbn,
    publicationDateLabel: value.publicationDateLabel,
    coverMediaId: value.coverMediaId,
    coverCaption: value.coverCaption,
    status: value.status,
    updatedAtISO: value.updatedAt,
    hasCover: value.hasCover,
  };
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; books: Book[] }
    | { status: 'error' }
  >({ status: 'loading' });
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<CatalogResponse>(BOOKS_URL, { signal: controller.signal })
      .then((response) => {
        const books = response.items
          .filter((book) => book.status === 'PUBLISHED')
          .map(toBook);
        setState({ status: 'ready', books });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  const value = useMemo<CatalogState>(() => ({ ...state, retry }), [retry, state]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
