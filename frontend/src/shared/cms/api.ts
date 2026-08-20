import { apiRequest } from '../api/client';
import {
  ADMIN_PAGES_URL,
  adminPageDraftUrl,
  adminPagePublishUrl,
  adminPageRestoreUrl,
  adminPageUrl,
  adminPageVersionsUrl,
  pageUrl,
} from '../config/api';
import type { PageContent, PageCreateInput, PageRecord, PageVersionList, PublishedPage } from './types';

export function getPublishedPage(slug: string, signal?: AbortSignal): Promise<PublishedPage> {
  return apiRequest<PublishedPage>(pageUrl(slug), { signal });
}

export function getAdminPage(identifier: string, signal?: AbortSignal): Promise<PageRecord> {
  return apiRequest<PageRecord>(adminPageUrl(identifier), { signal });
}

export function createPage(input: PageCreateInput, signal?: AbortSignal): Promise<PageRecord> {
  return apiRequest<PageRecord>(ADMIN_PAGES_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function savePageDraft(identifier: string, content: PageContent): Promise<PageRecord> {
  return apiRequest<PageRecord>(adminPageDraftUrl(identifier), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export function publishPage(identifier: string): Promise<PageRecord> {
  return apiRequest<PageRecord>(adminPagePublishUrl(identifier), { method: 'POST' });
}

export function getPageVersions(identifier: string): Promise<PageVersionList> {
  return apiRequest<PageVersionList>(adminPageVersionsUrl(identifier));
}

export function restorePageVersion(identifier: string, versionId: string): Promise<PageRecord> {
  return apiRequest<PageRecord>(adminPageRestoreUrl(identifier, versionId), { method: 'POST' });
}
