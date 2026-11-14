// The admin sidebar groups pages by intent (content, site pages, store,
// read-only reports, settings), each book's sales page opens from the books
// list, and Configuración actually changes the public site.
import { test, expect } from '@playwright/test';
import { cleanup, seedBook, seedSession } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('navegación del admin', () => {
  test('the sidebar separates editing sections from read-only reports', async ({ context }) => {
    const admin = await seedSession('admin');
    try {
      await signInAs(context, admin);
      const page = await context.newPage();
      await page.goto('/admin/ventas');

      const nav = page.getByRole('navigation', { name: 'Admin' });
      for (const label of ['Contenido', 'Páginas del sitio', 'Ayuda y legales', 'Tienda', 'Informes', 'Ajustes']) {
        await expect(nav.getByText(new RegExp(`^${label}( solo lectura)?$`))).toBeVisible();
      }
      // The old duplicate entry that pointed at the books list is gone.
      await expect(nav.getByRole('link', { name: 'Páginas de libros' })).toHaveCount(0);
      // Report pages say they only show data, and are the active entry.
      await expect(page.getByText('Solo lectura', { exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Ventas' })).toHaveClass(/navLinkActive/);

      // Editors keep their section highlighted.
      await page.goto('/admin/meditaciones/nueva');
      await expect(nav.getByRole('link', { name: 'Meditaciones', exact: true })).toHaveClass(/navLinkActive/);
    } finally {
      await cleanup({ userIds: [admin.userId] });
    }
  });

  test("a book's sales page opens from the books list", async ({ context }) => {
    const admin = await seedSession('admin');
    const book = await seedBook({ slug: `e2e-pagina-venta-${Date.now()}`, title: 'E2E Página de venta' });
    try {
      await signInAs(context, admin);
      const page = await context.newPage();
      await page.goto('/admin/libros');
      const row = page.getByRole('row', { name: /E2E Página de venta/ });
      await row.getByRole('link', { name: 'Página de venta' }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/libros/${book.slug}/editar\\?tab=page$`));
      await expect(page.getByRole('tab', { name: 'Página de venta' })).toHaveAttribute('aria-selected', 'true');
    } finally {
      await cleanup({ userIds: [admin.userId], bookIds: [book.id] });
    }
  });

  test('Configuración changes the public footer and search-engine indexing', async ({ browser }) => {
    const admin = await seedSession('admin');
    const adminContext = await browser.newContext();
    await signInAs(adminContext, admin);
    const original = await (await adminContext.request.get('/api/v1/admin/settings')).json();
    const editable = {
      siteName: original.siteName,
      siteDescription: original.siteDescription,
      supportEmail: original.supportEmail,
      newsletterEmail: original.newsletterEmail,
      senderName: original.senderName,
      seoTitle: original.seoTitle,
      seoDescription: original.seoDescription,
      seoIndexable: original.seoIndexable,
    };
    try {
      const page = await adminContext.newPage();
      await page.goto('/admin/configuracion');
      // The duplicate "Contacto" tab (it repeated the support email) is gone.
      await expect(page.getByRole('button', { name: 'Contacto' })).toHaveCount(0);
      await page.getByLabel('Correo de soporte').fill('ayuda-e2e@example.com');
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByText('Cambios guardados.')).toBeVisible();
      await page.getByRole('button', { name: 'SEO' }).click();
      await page.getByLabel('Permitir indexación general del sitio').uncheck();
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByText('Cambios guardados.')).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto('/meditaciones');
      await expect(visitor.getByRole('link', { name: 'ayuda-e2e@example.com' })).toBeVisible();
      await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
      await visitor.close();
    } finally {
      await adminContext.request.put('/api/v1/admin/settings', { headers: SAME_ORIGIN_HEADERS, data: editable });
      await adminContext.close();
      await cleanup({ userIds: [admin.userId] });
    }
  });
});
