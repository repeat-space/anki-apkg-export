import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function getReleasePlan({ name, version }, request = fetch) {
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
  return {
    version,
    'release-tag': `v${version}`,
    'dist-tag': version.includes('-') ? 'next' : 'latest',
    publish: !published,
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
