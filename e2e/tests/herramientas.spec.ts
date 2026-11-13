// The three interactive Herramientas tools. They need no account and keep
// everything in the browser's localStorage, so these tests drive the real
// UI and check that what the visitor writes survives a reload.
import { test, expect } from '@playwright/test';

test.describe('Herramientas', () => {
  test('the collection page links each card to its tool', async ({ page }) => {
    await page.goto('/herramientas');
    const links = page.getByRole('link', { name: /Abrir herramienta/ });
    await expect(links).toHaveCount(3);

    await page.getByRole('link', { name: /Registro de escritura diaria/ }).click();
    await expect(page).toHaveURL(/\/herramientas\/escritura-diaria$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Registro de escritura diaria' })).toBeVisible();
  });

  test('a daily writing entry is kept after reloading', async ({ page }) => {
    await page.goto('/herramientas/escritura-diaria');
    await page.getByRole('button', { name: 'Calma', exact: true }).click();
    await page.getByLabel('Tu escritura').fill('Hoy escribo para ordenar lo que siento.');
    await expect(page.getByText(/Guardado en este navegador/)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Tu escritura')).toHaveValue('Hoy escribo para ordenar lo que siento.');
    await expect(page.getByRole('button', { name: 'Calma', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 día escrito', { exact: false })).toBeVisible();
  });

  test('a reflection answer is saved with its question', async ({ page }) => {
    await page.goto('/herramientas/preguntas');
    const question = await page.locator('p[aria-live="polite"]').first().textContent();
    await page.getByLabel('Tu respuesta a la pregunta').fill('Me doy cuenta de que necesito descansar.');
    await page.getByRole('button', { name: 'Guardar respuesta' }).click();

    await page.reload();
    const answers = page.getByRole('region', { name: 'Tus respuestas' });
    await expect(answers.getByText('Me doy cuenta de que necesito descansar.')).toBeVisible();
    await expect(answers.getByText(question ?? '')).toBeVisible();
  });

  test('the weekly ritual keeps a saved closure and never stores what was released', async ({ page }) => {
    await page.goto('/herramientas/cierre-semanal');
    await page.getByRole('button', { name: 'Empezar', exact: true }).click(); // → Respirar
    await page.getByRole('button', { name: 'Siguiente' }).click(); // → Mirar la semana
    await page.getByLabel('Momento 1').fill('Una caminata al atardecer');
    await page.getByRole('button', { name: 'Siguiente' }).click(); // → Agradecer
    await page.getByRole('button', { name: 'Siguiente' }).click(); // → Soltar
    await page.getByLabel('Lo que quiero soltar').fill('El apuro de siempre');
    await page.getByRole('button', { name: 'Soltar', exact: true }).click();
    await expect(page.getByText('Lo que soltaste no quedó guardado')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click(); // → Intención
    await page.getByLabel('Mi intención para la próxima semana').fill('Ir más despacio');
    await page.getByRole('button', { name: 'Siguiente' }).click(); // → Cerrar
    await page.getByRole('button', { name: 'Guardar mi cierre' }).click();

    await page.reload();
    const previous = page.getByRole('region', { name: 'Tus cierres anteriores' });
    await expect(previous.locator('summary').getByText('Ir más despacio')).toBeVisible();
    const stored = await page.evaluate(() => window.localStorage.getItem('nmp.herramientas.cierre-semanal.v1') ?? '');
    expect(stored).toContain('Una caminata al atardecer');
    expect(stored).not.toContain('El apuro de siempre');
  });

  test('deleting a weekly closure also deletes its retained draft', async ({ page }) => {
    await page.goto('/herramientas/cierre-semanal');
    await page.getByRole('button', { name: 'Empezar', exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByLabel('Momento 1').fill('Un recuerdo para borrar');
    await page.getByRole('button', { name: /^7\s*Cerrar$/ }).click();
    await page.getByRole('button', { name: 'Guardar mi cierre' }).click();

    const previous = page.getByRole('region', { name: 'Tus cierres anteriores' });
    await previous.locator('summary').first().click();
    await previous.getByRole('button', { name: 'Borrar este cierre' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();

    await page.reload();
    const stored = await page.evaluate(() => window.localStorage.getItem('nmp.herramientas.cierre-semanal.v1') ?? '');
    expect(stored).not.toContain('Un recuerdo para borrar');
    await page.getByRole('button', { name: /^3\s*Mirar la semana$/ }).click();
    await expect(page.getByLabel('Momento 1')).toHaveValue('');
  });

  test('warns instead of confirming a save when the browser blocks storage', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
    });
    await page.goto('/herramientas/escritura-diaria');
    await page.getByLabel('Tu escritura').fill('Esto no se puede guardar.');

    await expect(page.getByRole('alert')).toContainText('no nos deja guardar');
    await expect(page.getByText('Sin guardar: descargalo antes de cerrar la página')).toBeVisible();
    await expect(page.getByText(/Guardado en este navegador/)).toHaveCount(0);
  });

  test('two open tabs do not overwrite each other', async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto('/herramientas/preguntas');
    await second.goto('/herramientas/preguntas');

    await first.getByLabel('Tu respuesta a la pregunta').fill('Respuesta de la primera pestaña');
    await first.getByRole('button', { name: 'Guardar respuesta' }).click();
    // The second tab learns about it through the storage event before saving its own.
    await expect(second.getByText('Respuesta de la primera pestaña')).toBeVisible();
    await second.getByLabel('Tu respuesta a la pregunta').fill('Respuesta de la segunda pestaña');
    await second.getByRole('button', { name: 'Guardar respuesta' }).click();

    await first.reload();
    await expect(first.getByText('Respuesta de la primera pestaña')).toBeVisible();
    await expect(first.getByText('Respuesta de la segunda pestaña')).toBeVisible();
  });
});
