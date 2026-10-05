# Releasing

Every push to `master`, including a merged PR, checks the version in
`package.json` against npm. If that version is already published, the workflow
skips it. Otherwise it runs the package, browser and Anki tests, publishes the
verified tarball, and creates a GitHub release and tag for the merged commit.

Stable versions publish under `latest`; prereleases publish under `next`.
Registry errors fail the check rather than triggering publication.

## One-time npm setup

In the `anki-apkg-export` package settings on npm, add a GitHub Actions trusted
publisher with these values:

- Organization: `repeat-space`
- Repository: `anki-apkg-export`
- Workflow filename: `release.yml`
- Environment: leave empty

Allow `npm publish`. The separate `npm dist-tag` permission is not required.
No `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret is needed. See
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Preparing a release

In the PR branch, prepare the next version:

```sh
pnpm release patch --dry-run
pnpm release patch
```

Use `minor`, `major`, or an explicit version such as `5.1.0-beta.1` as needed.
Release-it checks the package, updates the version and lockfile, and creates a
local commit. It does not push, tag or publish. Push the branch and merge the
PR to publish. No version bump is needed when the version in `package.json`
has not been published yet.

To retry a failed publication, run **Publish npm package** manually on `master`
from GitHub Actions. If npm publication succeeded but GitHub release creation
failed, create the GitHub release manually for that commit: retries skip
versions already present in npm.
