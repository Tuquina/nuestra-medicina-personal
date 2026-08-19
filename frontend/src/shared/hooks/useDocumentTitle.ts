import { useEffect } from 'react';

/**
 * Sets `document.title` for the lifetime of the calling component.
 *
 * The app is a plain Vite SPA (no SSR yet — see architecture.md §29), so
 * per-route titles are set client-side rather than via a `<Helmet>`-style
 * head manager.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
