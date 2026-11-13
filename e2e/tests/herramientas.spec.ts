// The three interactive Herramientas tools. Without a session they keep
// everything in the browser's localStorage; signed in, they save to the
// account, encrypted (ADR 0006). These tests drive the real UI and check
// that what the person writes survives a reload, in both modes.
import { test, expect } from '@playwright/test';
import { cleanup, seedSession, storedToolEntries } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';

test.describe('Herramientas in the account (signed in)', () => {
  test('a journal entry is saved encrypted in the account and only its owner sees it', async ({ browser }) => {
    const owner = await seedSession('user');
    const stranger = await seedSession('user');
    const ownerContext = await browser.newContext();
    const strangerContext = await browser.newContext();
    try {
      await signInAs(ownerContext, owner);
      const page = await ownerContext.newPage();
      await page.goto('/herramientas/escritura-diaria');
      await expect(page.getByText(/se guarda cifrado en tu cuenta/)).toBeVisible();

      await page.getByRole('button', { name: 'Gratitud', exact: true }).click();
      await page.getByLabel('Tu escritura').fill('Algo muy íntimo que sólo yo debería leer.');
      await expect(page.getByText(/Guardado en tu cuenta/)).toBeVisible();

      // Nothing personal is cached in the browser, and Postgres only holds ciphertext.
      const local = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
      expect(local).not.toContain('íntimo');
      const stored = await storedToolEntries(owner.userId);
      expect(stored).toHaveLength(1);
      expect(stored[0].ciphertext.toString('latin1')).not.toContain('ntimo');

      // A fresh browser of the same person sees it again, from the account.
      const elsewhere = await ownerContext.newPage();
      await elsewhere.goto('/herramientas/escritura-diaria');
      await expect(elsewhere.getByLabel('Tu escritura')).toHaveValue('Algo muy íntimo que sólo yo debería leer.');
      await expect(elsewhere.getByRole('button', { name: 'Gratitud', exact: true })).toHaveAttribute('aria-pressed', 'true');

      // Another account sees nothing.
      await signInAs(strangerContext, stranger);
      const strangerPage = await strangerContext.newPage();
      await strangerPage.goto('/herramientas/escritura-diaria');
      await expect(strangerPage.getByText(/se guarda cifrado en tu cuenta/)).toBeVisible();
      await expect(strangerPage.getByLabel('Tu escritura')).toHaveValue('');
      await expect(strangerPage.getByText('Cuando escribas, tus registros van a aparecer acá.')).toBeVisible();
    } finally {
      await ownerContext.close();
      await strangerContext.close();
      await cleanup({ userIds: [owner.userId, stranger.userId] });
    }
  });

  test('answers and the weekly ritual are kept in the account across reloads', async ({ browser }) => {
    const session = await seedSession('user');
    const context = await browser.newContext();
    try {
      await signInAs(context, session);
      const page = await context.newPage();

      await page.goto('/herramientas/preguntas');
      await page.getByLabel('Tu respuesta a la pregunta').fill('Necesito más silencio.');
      await page.getByRole('button', { name: 'Guardar respuesta' }).click();
      await expect(page.getByText('Guardada en tus respuestas, en tu cuenta.')).toBeVisible();

      await page.goto('/herramientas/cierre-semanal');
      await page.getByRole('button', { name: 'Empezar', exact: true }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.getByLabel('Momento 1').fill('Un almuerzo largo con amigas');
      await page.getByRole('button', { name: /^7\s*Cerrar$/ }).click();
      await page.getByRole('button', { name: 'Guardar mi cierre' }).click();
      await expect(page.getByText(/Guardado en tu cuenta ·/)).toBeVisible();

      await page.reload();
      await expect(page.getByRole('region', { name: 'Tus cierres anteriores' }).locator('summary')).toHaveCount(1);
      await page.goto('/herramientas/preguntas');
      await expect(page.getByRole('region', { name: 'Tus respuestas' }).getByText('Necesito más silencio.')).toBeVisible();

      const stored = await storedToolEntries(session.userId);
      expect(stored.map((row) => `${row.tool}/${row.kind}`)).toEqual(['cierre-semanal/closure', 'preguntas/answer']);
    } finally {
      await context.close();
      await cleanup({ userIds: [session.userId] });
    }
  });

  test('entries written before signing in can be moved into the account', async ({ browser }) => {
    const session = await seedSession('user');
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/herramientas/escritura-diaria');
      await page.getByLabel('Tu escritura').fill('Escrito antes de iniciar sesión.');
      await expect(page.getByText(/Guardado en este navegador/)).toBeVisible();

      await signInAs(context, session);
      await page.reload();
      await page.getByRole('button', { name: 'Pasar a mi cuenta' }).click();
      await expect(page.getByRole('button', { name: 'Pasar a mi cuenta' })).toHaveCount(0);
      await expect(page.getByLabel('Tu escritura')).toHaveValue('Escrito antes de iniciar sesión.');

      const local = await page.evaluate(() => window.localStorage.getItem('nmp.herramientas.escritura-diaria.v2') ?? '');
      expect(local).not.toContain('Escrito antes');
      expect(await storedToolEntries(session.userId)).toHaveLength(1);
    } finally {
      await context.close();
      await cleanup({ userIds: [session.userId] });
    }
  });
});

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
    const stored = await page.evaluate(() => window.localStorage.getItem('nmp.herramientas.cierre-semanal.v2') ?? '');
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
    const stored = await page.evaluate(() => window.localStorage.getItem('nmp.herramientas.cierre-semanal.v2') ?? '');
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
