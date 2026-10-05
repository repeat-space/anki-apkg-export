# Releasing

Every push to `master`, including a merged PR, starts the release workflow.
The first release publishes the unpublished version in `package.json`.
Subsequent releases use Conventional Commits since the previous release tag:

- `fix:` increases the patch version.
- `feat:` increases the minor version.
- `!` or a `BREAKING CHANGE:` footer increases the major version.
- Documentation and maintenance commits alone do not trigger a release.

Keep these prefixes when merging or squashing PRs. Release-it chooses the
highest required bump. No manual version edit is needed.

The workflow runs the package, browser and Anki tests, records the verified
version in `package.json` on `master`, publishes the tarball, and creates the
GitHub release and tag. The repository must allow GitHub Actions to push
version commits to `master`. If another commit reaches `master` during testing,
the older run stops before publication; run the workflow on current `master`.

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

## Previewing the next version

In a PR branch, preview the recommendation:

```sh
node scripts/check-release.mjs
```

An explicit version in `package.json` that is not yet published takes
precedence over the recommendation. This allows deliberate major releases or
previews such as `5.1.0-beta.1`.

To retry a failed publication, run **Publish npm package** manually on `master`
from GitHub Actions. If npm publication succeeded but GitHub release creation
failed, create the GitHub release and tag manually for the recorded version
commit before another release. The tag marks which commits have been released.
