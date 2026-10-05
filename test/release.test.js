import { expect, it, vi } from 'vitest';
import { getReleasePlan } from '../scripts/check-release.mjs';

const pkg = { name: 'anki-apkg-export', version: '5.0.0' };

it('publishes a new stable version under latest', async () => {
  const request = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
  expect(await getReleasePlan(pkg, request)).toEqual({
    version: '5.0.0',
    'release-tag': 'v5.0.0',
    'dist-tag': 'latest',
    publish: true,
  });
  expect(request).toHaveBeenCalledWith('https://registry.npmjs.org/anki-apkg-export/5.0.0');
});

it('skips an already published version', async () => {
  const request = vi.fn().mockResolvedValue(Response.json(pkg));
  expect((await getReleasePlan(pkg, request)).publish).toBe(false);
});

it('publishes prereleases under next', async () => {
  const request = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
  expect((await getReleasePlan({ ...pkg, version: '5.1.0-beta.1' }, request))['dist-tag']).toBe(
    'next',
  );
});

it('fails on registry errors instead of treating them as an unpublished version', async () => {
  const request = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
  await expect(getReleasePlan(pkg, request)).rejects.toThrow('HTTP 503');
});

it('rejects unexpected registry metadata', async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ ...pkg, version: '4.0.3' }));
  await expect(getReleasePlan(pkg, request)).rejects.toThrow('unexpected package metadata');
});
