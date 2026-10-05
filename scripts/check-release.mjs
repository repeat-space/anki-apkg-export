import { readFileSync, appendFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = process.env.RELEASE_TAG;
if (tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match package version v${version}`);
}
const distTag = version.includes('-') ? 'next' : 'latest';
const output = `version=${version}\ndist-tag=${distTag}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(output);
