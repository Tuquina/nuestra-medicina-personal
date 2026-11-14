import { useEffect, useState } from 'react';
import { apiRequest } from '../../shared/api/client';
import { MEDITATIONS_URL } from '../../shared/config/api';
import type { MeditationSummary } from '../../shared/cms/meditationContent';

export type MeditationsState =
  | { status: 'loading'; items: MeditationSummary[] }
  | { status: 'ready'; items: MeditationSummary[] }
  | { status: 'error'; items: MeditationSummary[] };

/** Published meditations (`GET /api/v1/meditations`), oldest first. */
export function useMeditations(): MeditationsState {
  const [state, setState] = useState<MeditationsState>({ status: 'loading', items: [] });

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: MeditationSummary[] }>(MEDITATIONS_URL, { signal: controller.signal })
      .then((response) => setState({ status: 'ready', items: response.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', items: [] });
      });
    return () => controller.abort();
  }, []);

  return state;
}
