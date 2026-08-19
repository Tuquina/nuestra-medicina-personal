import { useCallback, useEffect, useState } from 'react';
import type { PageContent, PageType } from './types';
import { getDraftContent, getPublishedContent, subscribeToContentStore } from './contentStore';

/**
 * Reads a page's live content for public rendering (Home / a book landing
 * page). Subscribes to the store so an admin publishing in another tab (or
 * the same tab, via "Vista previa") updates the page without a reload.
 *
 * `preview: true` reads the draft instead of the published content — used
 * only by the admin's own "Vista previa" link (a `?preview=1` query param),
 * never by default. This keeps unpublished edits invisible to real
 * visitors (docs/architecture.md §15) while still letting admins see what
 * they're about to publish.
 *
 * `seed` must be a stable function reference (a module-level export, not
 * an inline arrow) — it's only invoked the very first time a page has no
 * stored record yet.
 */
export function usePublishedContent(type: PageType, slug: string, seed: () => PageContent, preview = false): PageContent {
  const read = useCallback(
    () => (preview ? getDraftContent(type, slug, seed) : getPublishedContent(type, slug, seed)),
    [type, slug, seed, preview],
  );

  // Re-read when the page identity changes, without a redundant extra
  // effect-driven render on first mount (the "adjusting state during
  // rendering" pattern — https://react.dev/learn/you-might-not-need-an-effect).
  const [loadedRead, setLoadedRead] = useState(() => read);
  const [content, setContent] = useState<PageContent>(read);
  if (loadedRead !== read) {
    setLoadedRead(() => read);
    setContent(read());
  }

  useEffect(() => subscribeToContentStore(() => setContent(read())), [read]);

  return content;
}
