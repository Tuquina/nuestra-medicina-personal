import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  createPage,
  getAdminPage,
  getPageVersions,
  publishPage,
  restorePageVersion,
  savePageDraft,
} from './api';
import type { PageContent, PageRecord, PageType, PageVersion } from './types';

interface EditablePageOptions {
  type: PageType;
  slug: string;
  title: string;
  seed: () => PageContent;
  bookId?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';
type ActionStatus = 'saving' | 'publishing' | 'restoring' | null;

interface EditorState {
  identity: string;
  loadStatus: LoadStatus;
  record: PageRecord | null;
  content: PageContent;
}

function contentMatches(left: PageContent, right: PageContent | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mutationErrorMessage(error: unknown, action: 'save' | 'publish'): string {
  if (error instanceof ApiError && error.status === 422) {
    return 'El contenido no cumple el esquema de esta página. Revisá los campos e intentá nuevamente.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Alcanzaste el límite de operaciones. Esperá un minuto y reintentá.';
  }
  return action === 'save'
    ? 'No pudimos guardar el borrador. Intentá nuevamente.'
    : 'No pudimos publicar la página. Intentá nuevamente.';
}

export function useEditablePage({ type, slug, title, seed, bookId }: EditablePageOptions) {
  const identity = `${type}:${slug}:${bookId ?? ''}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<EditorState>(() => ({
    identity,
    loadStatus: 'loading',
    record: null,
    content: seed(),
  }));
  const [actionStatus, setActionStatus] = useState<ActionStatus>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [versionsStatus, setVersionsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  if (state.identity !== identity) {
    setState({ identity, loadStatus: 'loading', record: null, content: seed() });
    setMessage(null);
    setVersions([]);
    setVersionsStatus('idle');
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      try {
        let record: PageRecord;
        try {
          record = await getAdminPage(slug, controller.signal);
        } catch (error: unknown) {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
          if (type === 'BOOK' && !bookId) throw new Error('A book UUID is required to create its page');
          try {
            record = await createPage({
              type,
              slug,
              title,
              bookId: type === 'BOOK' ? bookId ?? null : null,
              content: seed(),
            }, controller.signal);
          } catch (createError: unknown) {
            if (!(createError instanceof ApiError) || createError.status !== 409) throw createError;
            record = await getAdminPage(slug, controller.signal);
          }
        }
        if (record.type !== type) throw new Error('The requested page has an unexpected type');
        if (!active) return;
        setState((current) => current.identity === identity
          ? { identity, loadStatus: 'ready', record, content: record.draftContent }
          : current);
      } catch (error: unknown) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setState((current) => current.identity === identity ? { ...current, loadStatus: 'error' } : current);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, bookId, identity, seed, slug, title, type]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, loadStatus: 'loading' }));
    setAttempt((value) => value + 1);
  }, []);

  const setContent = useCallback((content: PageContent) => {
    setMessage(null);
    setState((current) => ({ ...current, content }));
  }, []);

  const saveDraftNow = useCallback(async (next?: PageContent): Promise<boolean> => {
    if (state.loadStatus !== 'ready' || !state.record) return false;
    const submitted = next ?? state.content;
    setActionStatus('saving');
    setMessage(null);
    try {
      const record = await savePageDraft(state.record.id, submitted);
      setState((current) => current.identity === identity ? {
        ...current,
        record,
        content: current.content === submitted ? record.draftContent : current.content,
      } : current);
      setMessage('Borrador guardado.');
      return true;
    } catch (error: unknown) {
      setMessage(mutationErrorMessage(error, 'save'));
      return false;
    } finally {
      setActionStatus(null);
    }
  }, [identity, state]);

  const publish = useCallback(async (): Promise<boolean> => {
    if (state.loadStatus !== 'ready' || !state.record) return false;
    const submitted = state.content;
    setActionStatus('publishing');
    setMessage(null);
    try {
      const saved = await savePageDraft(state.record.id, submitted);
      const record = await publishPage(saved.id);
      setState((current) => current.identity === identity ? {
        ...current,
        record,
        content: current.content === submitted ? record.draftContent : current.content,
      } : current);
      setMessage('Página publicada.');
      setVersionsStatus('idle');
      return true;
    } catch (error: unknown) {
      setMessage(mutationErrorMessage(error, 'publish'));
      return false;
    } finally {
      setActionStatus(null);
    }
  }, [identity, state]);

  const discard = useCallback(async (): Promise<boolean> => {
    if (state.loadStatus !== 'ready' || !state.record?.publishedContent) return false;
    return saveDraftNow(state.record.publishedContent);
  }, [saveDraftNow, state]);

  const loadVersions = useCallback(async () => {
    if (state.loadStatus !== 'ready' || !state.record) return;
    setVersionsStatus('loading');
    try {
      const response = await getPageVersions(state.record.id);
      setVersions(response.items);
      setVersionsStatus('ready');
    } catch {
      setVersionsStatus('error');
    }
  }, [state]);

  const restoreVersion = useCallback(async (versionId: string): Promise<boolean> => {
    if (state.loadStatus !== 'ready' || !state.record) return false;
    setActionStatus('restoring');
    setMessage(null);
    try {
      const record = await restorePageVersion(state.record.id, versionId);
      setState((current) => current.identity === identity ? { ...current, record, content: record.draftContent } : current);
      setMessage('Versión restaurada como borrador. Publicala cuando esté lista.');
      return true;
    } catch {
      setMessage('No pudimos restaurar esa versión.');
      return false;
    } finally {
      setActionStatus(null);
    }
  }, [identity, state]);

  return {
    content: state.content,
    setContent,
    saveDraftNow,
    publish,
    discard,
    loadStatus: state.loadStatus,
    retry,
    actionStatus,
    message,
    record: state.record,
    dirtySincePublish: !state.record || !contentMatches(state.content, state.record.publishedContent),
    savedAt: state.record?.updatedAt ?? null,
    publishedAt: state.record?.publishedAt ?? null,
    versions,
    versionsStatus,
    loadVersions,
    restoreVersion,
  };
}

export type EditablePageController = ReturnType<typeof useEditablePage>;
