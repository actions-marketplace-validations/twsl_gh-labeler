# gh-labeler

[![GitHub Super-Linter](https://github.com/twsl/gh-labeler/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/twsl/gh-labeler/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/twsl/gh-labeler/actions/workflows/check-dist.yml/badge.svg)](https://github.com/twsl/gh-labeler/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/twsl/gh-labeler/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/twsl/gh-labeler/actions/workflows/codeql-analysis.yml)

gh-labeler is a GitHub Action that applies labels and follow-up actions to
issues, pull requests, and discussions based on label events and regex matches
against the title and body.

The action is configuration-driven. You define label rules and regex rules in
`.github/gh-labeler.yaml`, and the action handles the matching GitHub API calls.

## What It Can Do

- Add and remove labels
- Add and remove assignees
- Request and remove pull request reviewers
- Post comments on issues, pull requests, and discussions
- Close issues, pull requests, and discussions
- Lock issues and pull requests
- Pin issues
- Change discussion categories
- Create issues from discussions
- Apply rules when content matches regular expressions

## Inputs

The action accepts the following inputs from [action.yml](./action.yml):

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | No | `${{ github.token }}` | Token used for GitHub API access. |
| `config-path` | No | `.github/gh-labeler.yaml` | Path to the YAML configuration file. |
| `process` | No | `issue`, `pr`, `discussion` | Restricts processing to one or more thread types. |

`process` accepts a comma-separated list or newline-separated list using the
values `issue`, `pr`, and `discussion`.

## Example Workflow

```yaml
name: Label Threads

on:
  issues:
    types: [opened, edited, labeled, unlabeled]
  pull_request_target:
    types: [opened, edited, labeled, unlabeled]
  discussion:
    types: [opened, edited, labeled, unlabeled]

permissions:
  contents: read
  issues: write
  pull-requests: write
  discussions: write

jobs:
  gh-labeler:
    runs-on: ubuntu-latest
    steps:
      - name: Run gh-labeler
        uses: twsl/gh-labeler@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          config-path: .github/gh-labeler.yaml
```

If you only want to process a subset of thread types:

```yaml
      - name: Run gh-labeler for issues only
        uses: twsl/gh-labeler@v1
        with:
          process: issue
```

## Configuration

The default configuration file path is `.github/gh-labeler.yaml`. A complete
example lives in [example/config.yaml](example/config.yaml).

There are two primary rule groups.

### Label Rules

Use `labels.add`, `labels.remove`, and `labels.default` to react to label
changes.

```yaml
labels:
  add:
    bug:
      comments:
        - "Thank you for the report."
      issues:
        assignees:
          add:
            - maintainer
      prs:
        reviewers:
          add:
            - reviewer

  remove:
    wip:
      prs:
        reviewers:
          add:
            - reviewer

  default:
    "*":
      comments:
        - "A matching rule ran for this thread."
```

### Regex Rules

Use `regex` to match the title and body of newly opened or edited threads.
Regex rules can add labels and trigger the same kinds of follow-up actions.

```yaml
regex:
  "\\b(security|vulnerability|CVE)\\b":
    labels:
      add:
        - security
        - needs-triage
    issues:
      assignees:
        add:
          - security-triage
```

By default the action scans both the title and the body. You can control that
globally with the following keys:

```yaml
scanTitle: true
scanBody: true
```

Regex rules are case-insensitive by default. Set `caseSensitive: true` inside a
rule when you need exact casing.

## Supported Action Fields

The configuration schema supports these common action fields:

| Field | Issues | Pull requests | Discussions |
| --- | --- | --- | --- |
| `comments` | Yes | Yes | Yes |
| `labels.add` | Yes | Yes | Yes |
| `labels.remove` | Yes | Yes | Yes |
| `assignees.add` | Yes | Yes | No |
| `assignees.remove` | Yes | Yes | No |
| `reviewers.add` | No | Yes | No |
| `reviewers.remove` | No | Yes | No |
| `close` | Yes | Yes | Yes |
| `close_reason` | Yes | No | Yes |
| `lock` | Yes | Yes | No |
| `pin` | Yes | No | No |
| `category` | No | No | Yes |
| `create_issue` | No | No | Yes |

Some fields present in the example configuration are intentionally future-facing
or partial. The current implementation warns instead of silently pretending to
support unsupported operations such as project management and issue-to-
discussion conversion.

## Development

This repository uses TypeScript, pnpm, Jest, Rollup, and Biome.

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm run format` | Format source and test files with Biome. |
| `pnpm run lint` | Run Biome linting. |
| `pnpm test` | Run the Jest test suite. |
| `pnpm run coverage` | Run tests with coverage reporting. |
| `pnpm run package` | Build the action bundle into `dist/`. |
| `pnpm run all` | Format, lint, test, collect coverage, and package. |

### Local Validation

Use the local action runner when you want to exercise the action without pushing
to GitHub.

```bash
pnpx @github/local-action . src/main.ts .env
```

## Release Process

The repository includes [script/release](script/release), a helper for creating
and pushing semantic version tags.

The script:

1. Finds the latest existing release tag.
2. Prompts for a new semantic version tag in the `vX.Y.Z` format.
3. Creates the version tag and updates the major version tag.
4. Pushes the tags and, for new majors, creates a matching `releases/vX` branch.

Before running it, make sure the bundle in `dist/` is up to date.

## Testing Notes

The action is exercised through unit tests and integration-style fixture tests
under [tests](tests). Sample event payloads used by those tests live under
[data](data).

## Credits

This project builds on ideas from the following repositories:

- [toshimaru/label-actions](https://github.com/toshimaru/label-actions)
- [dessant/label-actions](https://github.com/dessant/label-actions)
