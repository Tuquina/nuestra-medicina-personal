import type { PageContent } from './types';

/**
 * Content of one meditation page (`/meditaciones/:slug`, page type
 * `MEDITACION`). A single `meditation` block; mirrors `MeditationProps` in
 * backend/internal/domain/page/meditation.go, which validates it.
 */
export const MEDITATION_BLOCK_TYPE = 'meditation';

export interface MeditationVideo {
  provider: 'youtube';
  /** Bare 11-character YouTube id — never a URL or embed HTML. */
  videoId: string;
}

export interface MeditationProps {
  title: string;
  description: string;
  imageId: string | null;
  imageAlt: string;
  video: MeditationVideo | null;
  durationMinutes: number | null;
  /** Plain text; a blank line separates paragraphs. */
  guidance: string;
}

/** A published meditation as listed by `GET /api/v1/meditations`. */
export interface MeditationSummary {
  slug: string;
  title: string;
  description: string;
  imageId: string | null;
  imageAlt: string;
  durationMinutes: number | null;
  hasVideo: boolean;
}

export function buildMeditationSeedContent(title: string): PageContent {
  return {
    schemaVersion: 1,
    sections: [
      {
        id: 'meditation',
        type: MEDITATION_BLOCK_TYPE,
        props: {
          title,
          description: 'Una práctica breve para volver a la respiración.',
          imageId: null,
          imageAlt: '',
          video: null,
          durationMinutes: null,
          guidance: '',
        } satisfies MeditationProps as unknown as Record<string, unknown>,
      },
    ],
  };
}

export function readMeditationProps(content: PageContent): MeditationProps | null {
  const block = content.sections.find((section) => section.type === MEDITATION_BLOCK_TYPE && !section.hidden);
  return block ? (block.props as unknown as MeditationProps) : null;
}

/** Replaces the meditation block's props, keeping the rest of the page. */
export function withMeditationProps(content: PageContent, props: MeditationProps): PageContent {
  const next = props as unknown as Record<string, unknown>;
  const hasBlock = content.sections.some((section) => section.type === MEDITATION_BLOCK_TYPE);
  return {
    ...content,
    sections: hasBlock
      ? content.sections.map((section) => (section.type === MEDITATION_BLOCK_TYPE ? { ...section, props: next } : section))
      : [...content.sections, { id: 'meditation', type: MEDITATION_BLOCK_TYPE, props: next }],
  };
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video id from anything an editor might paste: a watch URL
 * (`youtube.com/watch?v=…`), a short link (`youtu.be/…`), an embed or
 * shorts URL, or the bare id. Returns null for anything else.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = url.pathname.split('/');
    candidate = first === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(first) ? second : null;
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/** Privacy-enhanced embed (no tracking cookies until the visitor presses play). */
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** "Respirar y empezar" → "respirar-y-empezar" (the page's URL slug). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function durationLabel(minutes: number | null): string | null {
  return minutes ? `${minutes} min` : null;
}

/** Splits guidance text into paragraphs (blank lines separate them). */
export function guidanceParagraphs(guidance: string): string[] {
  return guidance
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
