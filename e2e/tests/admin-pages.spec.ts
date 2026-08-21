// Phase 3: the generic CMS page mechanism (pages_handler.go) — save a
// draft, publish, and version/restore. PageBuilderPage,
// MeditacionesEditorPage, HerramientasEditorPage, SobreElProyectoPage, the
// two LegalDocEditorPages (terminos/privacidad) and the three
// AyudaEditorPages (contacto/soporte/preguntas-frecuentes) are all thin UI
// wrappers around this exact same backend mechanism — one thorough test
// here covers what's actually shared among all of them; the per-screen UI
// differences are presentation-only.
//
// Unlike admin-books.spec.ts's landing pages, these editorial page types
// are singletons seeded once by migrations/007 (one HOME, one FAQ, etc. —
// PageHandler.Create would 409 PAGE_ALREADY_EXISTS on a second one) and
// are never created through the real UI either — only edited. So this
// drives the real seeded FAQ page directly, and restores its original
// content in `finally` so the test is non-destructive even against a
// longer-lived stack.
import { test, expect } from '@playwright/test';
import { seedSession, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

const FAQ_SLUG = 'preguntas-frecuentes';

test.describe('administración de páginas (CMS)', () => {
  test('borrador -> publicar -> versionar -> restaurar sobre una página editorial existente', async ({ context }) => {
    const admin = await seedSession('admin');
    let originalDraftContent: unknown;
    try {
      await signInAs(context, admin);

      const before = await (await context.request.get(`/api/v1/admin/pages/${FAQ_SLUG}`)).json();
      const pageId: string = before.id;
      originalDraftContent = before.draftContent;

      const v1 = { schemaVersion: 1, sections: [{ id: 'intro', type: 'text', props: { text: 'v1 e2e' } }] };
      const draftSaved = await context.request.put(`/api/v1/admin/pages/${pageId}/draft`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { content: v1 },
      });
      expect(draftSaved.status()).toBe(200);
      expect((await draftSaved.json()).draftContent).toEqual(v1);

      const publishedV1 = await context.request.post(`/api/v1/admin/pages/${pageId}/publish`, { headers: SAME_ORIGIN_HEADERS });
      expect(publishedV1.status()).toBe(200);

      const publicAfterV1 = await context.request.get(`/api/v1/pages/${FAQ_SLUG}`);
      expect(publicAfterV1.status()).toBe(200);
      expect((await publicAfterV1.json()).content).toEqual(v1);

      // Save and publish a second version, so there's a real prior version
      // (v1's) to restore back to.
      const v2 = { schemaVersion: 1, sections: [{ id: 'intro', type: 'text', props: { text: 'v2 e2e' } }] };
      await context.request.put(`/api/v1/admin/pages/${pageId}/draft`, { headers: SAME_ORIGIN_HEADERS, data: { content: v2 } });
      await context.request.post(`/api/v1/admin/pages/${pageId}/publish`, { headers: SAME_ORIGIN_HEADERS });

      const versions = await context.request.get(`/api/v1/admin/pages/${pageId}/versions`);
      expect(versions.status()).toBe(200);
      const versionList = (await versions.json()).items as Array<{ id: string; content: typeof v1 }>;
      const v1Version = versionList.find((version) => JSON.stringify(version.content) === JSON.stringify(v1));
      expect(v1Version).toBeTruthy();

      // Restore only resets the draft (pages_repository.go's Restore) — the
      // live published page is untouched until explicitly re-published.
      const restored = await context.request.post(`/api/v1/admin/pages/${pageId}/versions/${v1Version!.id}/restore`, { headers: SAME_ORIGIN_HEADERS });
      expect(restored.status()).toBe(200);
      const restoredPage = await restored.json();
      expect(restoredPage.draftContent).toEqual(v1);
      expect(restoredPage.publishedContent).toEqual(v2);

      const publicStillV2 = await context.request.get(`/api/v1/pages/${FAQ_SLUG}`);
      expect((await publicStillV2.json()).content).toEqual(v2);
    } finally {
      const before = await (await context.request.get(`/api/v1/admin/pages/${FAQ_SLUG}`)).json();
      if (originalDraftContent) {
        await context.request.put(`/api/v1/admin/pages/${before.id}/draft`, {
          headers: SAME_ORIGIN_HEADERS,
          data: { content: originalDraftContent },
        });
        await context.request.post(`/api/v1/admin/pages/${before.id}/publish`, { headers: SAME_ORIGIN_HEADERS });
      }
      await cleanup({ userIds: [admin.userId] });
    }
  });
});
