import { expect, it, vi } from 'vitest';
import { getReleasePlan } from '../scripts/check-release.mjs';
import { recommendVersion } from '../scripts/check-release.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const pkg = { name: 'anki-apkg-export', version: '5.0.0' };

it('derives patch, minor and major versions from actual commits since the release tag', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'anki-release-commits-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({ ...pkg, packageManager: 'pnpm@11.1.1' }),
  );
  git('init');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release-test@example.com');
  git('add', 'package.json');
  git('commit', '-m', 'chore: initial package');
  git('tag', 'v5.0.0');
  git('commit', '--allow-empty', '-m', 'docs: update usage');
  expect(await recommendVersion(cwd)).toBe('');
  git('commit', '--allow-empty', '-m', 'fix: correct export');
  expect(await recommendVersion(cwd)).toBe('5.0.1');
  git('commit', '--allow-empty', '-m', 'feat: support a new model');
  expect(await recommendVersion(cwd)).toBe('5.1.0');
  git('commit', '--allow-empty', '-m', 'feat!: change the export API');
  expect(await recommendVersion(cwd)).toBe('6.0.0');
}, 15000);

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

it('skips a published version when commits do not warrant a release', async () => {
  const request = vi.fn().mockResolvedValue(Response.json(pkg));
  expect((await getReleasePlan(pkg, request, () => '')).publish).toBe(false);
});

it('uses the recommended version after the current version has been published', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(pkg))
    .mockResolvedValueOnce(new Response('', { status: 404 }));
  expect((await getReleasePlan(pkg, request, () => '5.0.1')).version).toBe('5.0.1');
});

it('does not re-publish an already used recommended version', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(pkg))
    .mockResolvedValueOnce(Response.json({ ...pkg, version: '5.0.1' }));
  await expect(getReleasePlan(pkg, request, () => '5.0.1')).rejects.toThrow('already published');
});

it('rejects a recommendation that does not increase the version', async () => {
  const request = vi.fn().mockResolvedValue(Response.json(pkg));
  await expect(getReleasePlan(pkg, request, () => '4.0.3')).rejects.toThrow('Invalid recommended');
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
