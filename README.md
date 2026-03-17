# Changelog Generator Action

Generate a Markdown changelog for a GitHub repository using prebuilt [`chlogr`](https://github.com/christianhelle/chlogr) binaries.

## Usage

### Generate `CHANGELOG.md` for the current repository

```yaml
name: Changelog

on:
  workflow_dispatch:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: read
  issues: read

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Generate changelog
        id: changelog
        uses: christianhelle/changelog-generator-action@v1
        with:
          output: CHANGELOG.md

      - name: Commit changelog
        if: steps.changelog.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add CHANGELOG.md
          git commit -m "Update changelog [skip ci]"
          git push
```

### Generate a changelog for a different repository

```yaml
- name: Generate changelog for Refitter
  uses: christianhelle/changelog-generator-action@v1
  with:
    repo: christianhelle/refitter
    output: artifacts/REFITTER_CHANGELOG.md
```

### Pin the `chlogr` version and filter the release range

```yaml
- name: Generate changelog for a specific release window
  uses: christianhelle/changelog-generator-action@v1
  with:
    chlogr-version: 0.1.2
    since-tag: 1.10.0
    until-tag: 1.11.0
    exclude-labels: duplicate,wontfix
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `repo` | No | `${{ github.repository }}` | GitHub repository to generate the changelog for, in `owner/repo` format. |
| `github-token` | No | `${{ github.token }}` | Token used for GitHub API calls and release resolution. Pass a PAT if you need access beyond the default workflow token. |
| `output` | No | `CHANGELOG.md` | Output file path. Relative paths are resolved from `GITHUB_WORKSPACE`. |
| `since-tag` | No | - | Only include changes after this tag. |
| `until-tag` | No | - | Only include changes up to this tag. |
| `exclude-labels` | No | - | Comma-separated labels to exclude from the changelog. |
| `chlogr-version` | No | `latest` | `chlogr` release tag to use. |

## Outputs

| Output | Description |
| --- | --- |
| `changelog-path` | Absolute path to the generated changelog file. |
| `changed` | `true` when the generated content differs from the previous file contents. |
| `chlogr-version` | The resolved `chlogr` release tag used by the action. |

## Permissions

To generate a changelog for the current repository, the default workflow token should have:

- `contents: read`
- `pull-requests: read`
- `issues: read`

If you also commit the generated changelog back to the repository, add:

- `contents: write`

If you generate a changelog for another private repository, pass a PAT through `github-token` with the appropriate scopes for that repository.

## Supported runners

This action currently expects `chlogr` release assets for:

- Linux `x64`
- Linux `arm64`
- macOS `x64`
- macOS `arm64`
- Windows `x64`

If a matching release asset is not available, the action fails with a clear error.

## Notes

- Pin the action by version, for example `@v1`.
- Pin `chlogr-version` if you want deterministic CLI behavior across runs.
- `actions/checkout` is only required if you want to keep or commit the generated file in the workspace.
- The action wraps `chlogr`; it does not commit, publish, or release anything by itself.
