# Configuration

This generator is designed to run without manual README edits after setup.

## Required

`GH_TOKEN`

GitHub token used by the REST and GraphQL APIs. Keep it in `.env` locally or in the repository secret `GH_TOKEN` for GitHub Actions.

`GITHUB_USERNAME`

Profile username to generate. Defaults to `WolfamIT26`.

## Optional

`LATEST_PROJECT_LIMIT`

Number of newest repositories to render after merge, dedupe, and `pushed_at` sorting. Defaults to `8`.

`INCLUDE_PRIVATE_REPOS`

Set to `1` to include private repositories visible to `GH_TOKEN`. Set to `0` to exclude private repositories from README output.

`GITHUB_CACHE`

Set to `1` to enable local JSON API caching. Set to `0` to disable it.

`GITHUB_CACHE_TTL_MS`

Cache TTL in milliseconds. Defaults to six hours.

## Security

Private repository names, descriptions, topics, languages, and metrics can appear in `README.md` when `INCLUDE_PRIVATE_REPOS=1`. Use `INCLUDE_PRIVATE_REPOS=0` if the generated README is public and private metadata should stay private.

Never commit `.env`. If a token is pasted into chat, logs, or a public repository, revoke it and create a new one.
