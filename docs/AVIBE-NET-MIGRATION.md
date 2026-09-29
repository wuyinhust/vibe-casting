# avibe.net replacement

## Requested change

Replace the original vibe-coding project-discovery website at `avibe.net` with
the AVIBE digital-talent casting website in this repository. The two products
remain separate projects. Do not merge their databases or reuse the old site's
Supabase credentials for the new schema.

## Legacy source archive

Archived on 2026-09-29:

- Private repository: <https://github.com/wuyinhust/avibe>
- Fixed source commit: `ceea3fe075646e7b579aa1f4992c15909c10e50b`
- Annotated tag: `archive-avibe-net-2026-09-29`
- Downloadable source release:
  <https://github.com/wuyinhust/avibe/releases/tag/archive-avibe-net-2026-09-29>
- GitHub repository is archived; the existing Git history remains available.

This is a source archive. It does not contain production databases, account
records, credentials, DNS configuration or a verified copy of the active
Cloudflare deployment. Preserve those separately before changing the route.
The local `/Users/vuyin/Documents/avibe` checkout is older than this archive;
its untracked editor files were not published.

## Replacement runtime

The new source baseline is `50fdc8e53907b39a99b4ec659596b3044f260779` in
`wuyinhust/vibe-casting`. The application is in `apps/avibe-web`.

The old project's Wrangler configuration serves static `dist` files. The new
website requires a Node.js server for `/api/v1`, private downloads, authentication
and image processing, plus a separate generation worker when generation is
enabled. Uploading a static build to the old Worker does not deploy those
services. The repository provides a Node.js 24 Dockerfile.

Use a dedicated Supabase project and execute migrations `001_core.sql`,
`002_access.sql`, `003_talent_leads.sql` and `004_asset_passports.sql` in order.
Configure the website and worker through deployment secrets. For the final
origin use `AVIBE_MODE=live` and `APP_ORIGIN=https://avibe.net`. Public deployment
must not enable local demo accounts or demo credits.

The eight demo characters and Lin Yue example package currently permit local
evaluation only. Do not seed them into the production catalog. Any public
example presentation needs a separately confirmed display license; that does
not grant commercial downloads.

## Cutover order

1. Read the Cloudflare account, active Worker/Pages deployment and custom-domain
   route. Record the deployment version and configuration needed for rollback.
2. Deploy the replacement to an isolated address and configure its dedicated
   database, private asset storage and authentication. Keep generation and
   payment unavailable until their providers and release checks pass.
3. Verify public discovery, account isolation and authorized downloads against
   the actual deployed service. Verify only the features intended for this
   release; unfinished actions must visibly remain unavailable.
4. Route `avibe.net` to the verified replacement and check the domain's HTTPS
   response, website and API. Preserve the prior Cloudflare deployment.
5. If cutover verification fails, restore the recorded old route/deployment.
   Do not roll back by overwriting either project's database.

## Current status

The legacy source archive is complete. The replacement has been cloned locally.
Deployment preparation updates Sharp to `0.35.5` and overrides Next.js's PostCSS
dependency with `8.5.28`, retaining Next.js 15. The HTTP smoke test preserves the
standard library's case-insensitive response headers instead of converting them
to a case-sensitive dictionary.

The prepared source passed these checks on 2026-09-29:

- TypeScript checking and Next.js production build.
- 36 domain tests and 9 Python download-client tests.
- 5 existing desktop/mobile browser tests.
- Local HTTP integration acceptance, including actual image upload, account and
  attachment isolation, website/Skill package equality, token revocation and
  disabled real payments.
- Dependency audit: zero reported vulnerabilities after the dependency update.
- Git diff whitespace validation.

These checks used macOS and Node.js `26.0.0`. The Node.js 24 Docker runtime and
real hosted Supabase, model and payment providers still need deployment checks.

The public domain has not been switched. Cloudflare management access, the
replacement runtime/database and the intended initial release scope still need
to be supplied or confirmed. Local checks do not establish production readiness.
