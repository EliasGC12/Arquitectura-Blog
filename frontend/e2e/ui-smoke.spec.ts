import { expect, test } from '@playwright/test';

const themes = [
  { value: 'morado', bar: 'rgb(91, 33, 182)' },
  { value: 'rojo', bar: 'rgb(159, 18, 57)' },
  { value: 'oscuro', bar: 'rgb(24, 24, 27)' },
  { value: 'azul', bar: 'rgb(27, 79, 156)' },
];

test('el selector de tema cambia la barra sin errores de página', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/posts');
  const select = page.getByLabel('Tema visual');
  await expect(select).toBeVisible();

  for (const theme of themes) {
    await select.selectOption(theme.value);
    await expect(page.locator('app-navbar header')).toHaveCSS('background-color', theme.bar);
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

  await page.getByRole('button', { name: /Escribir algo/ }).click();
  const font = page.getByRole('toolbar', { name: 'Formato del texto' }).getByLabel('Fuente');
  await font.selectOption('Georgia');
  const area = page.getByPlaceholder('Escribir algo...');
  await area.fill('Prueba de fuente');
  await expect(area).toHaveCSS('font-family', /Georgia/);

  expect(errors).toEqual([]);
});
