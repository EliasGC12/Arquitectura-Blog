import { expect, test } from '@playwright/test';

const accents = ['Morado', 'Rojo', 'Verde', 'Esmeralda', 'Naranja', 'Azul'];

test('el modo y el color de acento cambian sin errores de página', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/posts');
  const mode = page.getByRole('button', { name: /modo/i });
  await expect(mode).toBeVisible();

  await mode.click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'oscuro');
  await mode.click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'claro');

  for (const name of accents) {
    await page.getByRole('radio', { name, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', name.toLowerCase());
  }

  expect(errors).toEqual([]);
});

test('el selector de fuentes del compositor responde', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/auth');
  await page.getByLabel('Usuario').fill('seed_autor_ana');
  await page.getByLabel('Contraseña').fill(process.env['E2E_PASSWORD'] ?? 'SeedPass123!');
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/posts/);

  await page.getByRole('button', { name: /Qué está pasando en el campus/ }).click();
  const font = page.getByRole('toolbar', { name: 'Formato del texto' }).getByLabel('Fuente');
  await font.selectOption('Georgia');
  const area = page.getByPlaceholder('¿Qué está pasando en el campus?');
  await area.fill('Prueba de fuente');
  await expect(area).toHaveCSS('font-family', /Georgia/);

  expect(errors).toEqual([]);
});
