import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs();

test('downloads a deck with Unicode, tags and File media using WASM', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Tags').fill('Japanese geography');
  await page.getByLabel('Images & audio').setInputFiles('test/fixtures/anki.png');
  await expect(page.getByLabel('Front', { exact: true })).toHaveValue(/<img src="anki.png">/);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .apkg' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('Japanese essentials.apkg');
  const archive = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(JSON.parse(await archive.file('media')!.async('string'))).toEqual({ 0: 'anki.png' });
  expect(Buffer.from(await archive.file('0')!.async('uint8array'))).toEqual(
    await readFile('test/fixtures/anki.png'),
  );
  const db = new SQL.Database(await archive.file('collection.anki2')!.async('uint8array'));
  try {
    const fields = db.exec('SELECT flds, tags FROM notes')[0]!.values[0]!;
    expect(fields[0]).toContain('東京');
    expect(fields[1]).toBe(' Japanese geography ');
  } finally {
    db.close();
  }
  await expect(page.getByRole('status')).toHaveText('Downloaded. Open the file in Anki.');
  expect(errors).toEqual([]);
});

test('exports cloze ordinals and recovers after invalid input', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Card type').selectOption('cloze');
  await page.getByLabel('Text', { exact: true }).fill('No cloze deletion');
  await page.getByRole('button', { name: 'Download .apkg' }).click();
  await expect(page.getByRole('status')).toContainText('does not generate');
  await expect(page.getByRole('button', { name: 'Download .apkg' })).toBeEnabled();
  await page.getByLabel('Text', { exact: true }).fill('{{c1::Tokyo}} is in {{c3::Japan}}');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .apkg' }).click();
  const archive = await JSZip.loadAsync(await readFile((await (await downloaded).path())!));
  const db = new SQL.Database(await archive.file('collection.anki2')!.async('uint8array'));
  try {
    expect(db.exec('SELECT ord FROM cards ORDER BY ord')[0]!.values).toEqual([[0], [2]]);
  } finally {
    db.close();
  }
});

test('adds and removes rows on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.locator('.card-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove' }).last().click();
  await expect(page.locator('.card-row')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
