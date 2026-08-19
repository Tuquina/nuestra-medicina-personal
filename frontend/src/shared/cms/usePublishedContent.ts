import { useEffect, useState } from 'react';
import type { PageContent, PageType } from './types';
import { getDraftContent, getPublishedContent, subscribeToContentStore } from './contentStore';

/** Module-level (not recreated per render) so it's never flagged as an
 * unstable hook dependency — only the real params (type/slug/seed/preview)
 * matter for `useEffect`'s dependency array below. */
function readContent(type: PageType, slug: string, seed: () => PageContent, preview: boolean): PageContent {
  return preview ? getDraftContent(type, slug, seed) : getPublishedContent(type, slug, seed);
}

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
 * `seed` can be a fresh inline arrow every render (e.g. `() =>
 * buildBookLandingSeedContent(slug)`, needed for per-book pages) — the
 * "did the page change" check below compares a plain string key, not a
 * memoized reader function's identity, so an unstable `seed` can't turn
 * into a render loop.
 */
export function usePublishedContent(type: PageType, slug: string, seed: () => PageContent, preview = false): PageContent {
  const identity = `${type}:${slug}:${preview ? 'draft' : 'published'}`;

  // Re-read when the page identity changes, without a redundant extra
  // effect-driven render on first mount (the "adjusting state during
  // rendering" pattern — https://react.dev/learn/you-might-not-need-an-effect).
  const [loadedFor, setLoadedFor] = useState(identity);
  const [content, setContent] = useState<PageContent>(() => readContent(type, slug, seed, preview));
  if (loadedFor !== identity) {
    setLoadedFor(identity);
    setContent(readContent(type, slug, seed, preview));
  }

  useEffect(
    () => subscribeToContentStore(() => setContent(readContent(type, slug, seed, preview))),
    [type, slug, seed, preview],
  );

  return content;
}
