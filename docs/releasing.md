# Releasing

Releases start from a clean, up-to-date `master`. Release-it updates the package
version, commits it, and pushes an annotated tag. GitHub Actions verifies the
tag and runs the package, browser and Anki tests before publishing the tarball.
It creates a GitHub release after npm publication succeeds.

## One-time npm setup

In the `anki-apkg-export` package settings on npm, add a GitHub Actions trusted
publisher with these values:

- Organization: `repeat-space`
- Repository: `anki-apkg-export`
- Workflow filename: `release.yml`
- Environment: leave empty

No `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret is needed. See
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Commands

```sh
pnpm release 5.0.0 --dry-run
pnpm release 5.0.0
```

For later releases, use `pnpm release patch`, `minor`, or an explicit version.
Release-it prompts before committing, tagging and pushing. A dry run does not
publish or push; it prints the planned release operations.

To publish a preview, use an explicit version such as `5.1.0-beta.1`. Versions
with a prerelease suffix publish under `next`; stable versions use `latest`.
The workflow accepts only tags matching the package version and commits
reachable from `master`. Publishing happens once the tag is pushed.

If npm publication succeeds but GitHub release creation fails, create the
GitHub release manually for the existing tag; do not republish the npm version.
