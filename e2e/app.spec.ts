import { expect, test } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = () => process.env.MARKITDOWN_DATA_DIR!;
const samplesDir = () => join(dataDir(), 'samples');
const markdownFiles = () => (existsSync(samplesDir()) ? readdirSync(samplesDir()).filter((f) => f.endsWith('.md')) : []);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Bereit · lokal')).toBeVisible();
});

test('converts, previews without saving, then saves next to the originals', async ({ page }) => {
  await page.getByRole('button', { name: 'Mit Beispielen ausprobieren' }).click();
  await expect(page.getByRole('button', { name: 'Umwandeln (8)' })).toBeVisible();

  await page.getByRole('button', { name: 'Umwandeln (8)' }).click();
  await expect(page.getByRole('button', { name: 'Alle speichern (8)' })).toBeVisible();

  // Preview first: nothing is written before the user saves.
  expect(markdownFiles()).toEqual([]);
  await expect(page.locator('.studio-panel .rendered-markdown')).toBeVisible();

  await page.getByRole('button', { name: 'Alle speichern (8)' }).click();
  await expect(page.getByText('8 gespeichert')).toBeVisible();
  expect(markdownFiles()).toHaveLength(8);

  await page.getByRole('button', { name: 'Verlauf' }).click();
  await expect(page.locator('.list-row')).toHaveCount(8);
});

test('a broken document shows a readable error and does not stop the others', async ({ page }) => {
  await page.locator('input[type=file]').first().setInputFiles([
    { name: 'gut.txt', mimeType: 'text/plain', buffer: Buffer.from('Alles in Ordnung\n') },
    { name: 'kaputt.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(40)]) }
  ]);
  await page.getByRole('button', { name: 'Umwandeln (2)' }).click();

  await expect(page.getByText('1 Fehler')).toBeVisible();
  // The good file is converted and waits for the user to save it.
  await expect(page.getByRole('button', { name: 'Alle speichern (1)' })).toBeVisible();
  // The broken one explains itself instead of failing silently.
  await expect(page.locator('.tile-error')).not.toBeEmpty();
});

test('preview strips scripts and event handlers from converted documents', async ({ page }) => {
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'boese.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('# Titel\n\n<img src="x" onerror="window.xssFired=1">\n\n<script>window.xssFired=2</script>\n\n[Link](javascript:window.xssFired=3)\n')
  });
  await page.getByRole('button', { name: 'Umwandeln (1)' }).click();
  const preview = page.locator('.studio-panel .rendered-markdown');
  await expect(preview).toContainText('Titel');

  const html = await preview.innerHTML();
  expect(html).not.toMatch(/onerror|<script|javascript:/i);
  expect(await page.evaluate(() => (window as unknown as { xssFired?: number }).xssFired)).toBeUndefined();
});

test('settings persist and the about page lists the repository once', async ({ page }) => {
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.locator('select').filter({ hasText: 'Dunkel' }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Über MarkItDown' }).click();
  await expect(page.getByText('MHabachia/markitdown-desktop', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Repository öffnen' })).toBeVisible();
});
