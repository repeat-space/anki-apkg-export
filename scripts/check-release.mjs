import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import semver from 'semver';
import { Bumper } from 'conventional-recommended-bump';

export async function recommendVersion(cwd = process.cwd()) {
  const { version } = JSON.parse(readFileSync(`${cwd}/package.json`, 'utf8'));
  const tag = `v${version}`;
  execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { cwd, stdio: 'pipe' });
  const config = JSON.parse(readFileSync(new URL('../.release-it.json', import.meta.url), 'utf8'));
  const bumper = new Bumper(cwd);
  bumper.loadPreset(config.plugins['@release-it/conventional-changelog'].preset);
  bumper.tag(tag);
  const { releaseType } = await bumper.bump();
  return releaseType ? semver.inc(version, releaseType) : '';
}

export async function getReleasePlan(
  { name, version },
  request = fetch,
  recommend = recommendVersion,
) {
  const response = await request(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
  );
  let published;
  if (response.status === 404) published = false;
  else if (response.ok) {
    const metadata = await response.json();
    if (metadata.name !== name || metadata.version !== version) {
      throw new Error('npm returned unexpected package metadata');
    }
    published = true;
  } else throw new Error(`npm version check failed: HTTP ${response.status}`);
  let nextVersion = version;
  if (published) {
    const recommended = await recommend();
    if (!recommended) return { version, publish: false };
    if (!semver.valid(recommended) || !semver.gt(recommended, version)) {
      throw new Error(`Invalid recommended version: ${recommended}`);
    }
    nextVersion = recommended;
    const nextResponse = await request(
      `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(nextVersion)}`,
    );
    if (nextResponse.status === 200) throw new Error(`${nextVersion} is already published`);
    if (nextResponse.status !== 404)
      throw new Error(`npm version check failed: HTTP ${nextResponse.status}`);
  }
  return {
    version: nextVersion,
    'release-tag': `v${nextVersion}`,
    'dist-tag': nextVersion.includes('-') ? 'next' : 'latest',
    publish: true,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = await getReleasePlan(JSON.parse(readFileSync('package.json', 'utf8')));
  const output = Object.entries(plan)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
  console.log(
    plan.publish ? `Publish ${plan.version}` : `${plan.version} is already published; skip`,
  );
}
