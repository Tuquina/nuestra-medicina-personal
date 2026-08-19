import { useCallback, useState } from 'react';
import type { PageContent, PageType } from './types';
import { discardDraft, getPageRecord, isDraftDirty, publishPage, saveDraft } from './contentStore';

/**
 * Drives an admin content editor (Page Builder or the book-page editor):
 * loads the current draft, and exposes save/publish/discard actions that
 * write straight through `contentStore`. Local React state is the working
 * copy while editing; nothing touches the store until an explicit save.
 */
export function useEditablePage(type: PageType, slug: string, seed: () => PageContent) {
  const [content, setContentState] = useState<PageContent>(() => getPageRecord(type, slug, seed).draftContent);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(() => getPageRecord(type, slug, seed).publishedAt);
  const [dirtySincePublish, setDirtySincePublish] = useState(() => isDraftDirty(getPageRecord(type, slug, seed)));

  // Any in-memory edit is optimistically "dirty" — saveDraftNow/publish
  // below correct this against the real stored record right after.
  const setContent = useCallback((next: PageContent) => {
    setContentState(next);
    setDirtySincePublish(true);
  }, []);

  const saveDraftNow = useCallback(
    (next: PageContent) => {
      const record = saveDraft(type, slug, next, seed);
      setContentState(next);
      setSavedAt(record.updatedAt);
      setDirtySincePublish(isDraftDirty(record));
    },
    [type, slug, seed],
  );

  const publish = useCallback(() => {
    // Publish whatever's currently in local state, not just the
    // last-saved draft — "Publicar" implies "save + publish".
    saveDraft(type, slug, content, seed);
    const record = publishPage(type, slug, seed);
    setSavedAt(record.updatedAt);
    setPublishedAt(record.publishedAt);
    setDirtySincePublish(false);
  }, [type, slug, seed, content]);

  const discard = useCallback(() => {
    const record = discardDraft(type, slug, seed);
    setContentState(record.draftContent);
    setDirtySincePublish(false);
  }, [type, slug, seed]);

  return { content, setContent, saveDraftNow, publish, discard, savedAt, publishedAt, dirtySincePublish };
}
