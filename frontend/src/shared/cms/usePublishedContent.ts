import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getAdminPage, getPublishedPage } from './api';
import type { PageContent, PageType } from './types';

export type PublishedContentState =
  | { status: 'loading'; content: null; retry: () => void }
  | { status: 'ready'; content: PageContent; retry: () => void }
  | { status: 'not-found'; content: null; retry: () => void }
  | { status: 'error'; content: null; retry: () => void };

export function usePublishedContent(type: PageType, slug: string, preview = false): PublishedContentState {
  const identity = `${type}:${slug}:${preview ? 'draft' : 'published'}`;
  const [loadedFor, setLoadedFor] = useState(identity);
  const [status, setStatus] = useState<PublishedContentState['status']>('loading');
  const [content, setContent] = useState<PageContent | null>(null);
  const [attempt, setAttempt] = useState(0);

  if (loadedFor !== identity) {
    setLoadedFor(identity);
    setStatus('loading');
    setContent(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const request = preview ? getAdminPage(slug, controller.signal) : getPublishedPage(slug, controller.signal);
    request
      .then((page) => {
        if (!active) return;
        if (page.type !== type) throw new Error('The requested page has an unexpected type');
        setContent('draftContent' in page ? page.draftContent : page.content);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setContent(null);
        setStatus(error instanceof ApiError && error.status === 404 ? 'not-found' : 'error');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, identity, preview, slug, type]);

  const retry = useCallback(() => {
    setStatus('loading');
    setContent(null);
    setAttempt((value) => value + 1);
  }, []);

  return { status, content, retry } as PublishedContentState;
}
