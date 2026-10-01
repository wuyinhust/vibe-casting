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
records, credentials, DNS configuration or a copy of the active Cloudflare
deployment. The old Cloudflare Worker and its active version were preserved
during cutover, as recorded below.
The local `/Users/vuyin/Documents/avibe` checkout is older than this archive;
its untracked editor files were not published.

## Replacement runtime

The new source baseline is `50fdc8e53907b39a99b4ec659596b3044f260779` in
`wuyinhust/vibe-casting`. The application is in `apps/avibe-web`.

The old project's Wrangler configuration serves static `dist` files. The full
new website requires a Node.js server for `/api/v1`, private downloads,
authentication and image processing, plus a separate generation worker when
generation is enabled. Uploading a static build to a Worker does not deploy
those services. The repository provides a Node.js 24 Dockerfile.

For the initial domain cutover, `apps/avibe-web/public-preview` supplies a
static public preview based on the new site's visual language. It intentionally
has no account, catalog API, character downloads, generation or payment flow.
It excludes the local-evaluation-only character images. This is an interim
public page, not the full Next.js casting platform.

Use a dedicated Supabase project and execute migrations `001_core.sql`,
`002_access.sql`, `003_talent_leads.sql` and `004_asset_passports.sql` in order.
Configure the website and worker through deployment secrets. For the final
origin use `AVIBE_MODE=live` and `APP_ORIGIN=https://avibe.net`. Public deployment
must not enable local demo accounts or demo credits.

The eight demo characters and Lin Yue example package currently permit local
evaluation only. Do not seed them into the production catalog. Any public
example presentation needs a separately confirmed display license; that does
not grant commercial downloads.

## Full-platform release path

1. Deploy the full replacement to an isolated address and configure its dedicated
   database, private asset storage and authentication. Keep generation and
   payment unavailable until their providers and release checks pass.
2. Verify public discovery, account isolation and authorized downloads against
   the actual deployed service. Verify only the features intended for this
   release; unfinished actions must visibly remain unavailable.
3. Replace the interim public-preview Worker on `avibe.net` and `www.avibe.net`
   with the verified full service. Check the domain's HTTPS response, website
   and API. Preserve the prior Cloudflare deployments until stable.
4. If release verification fails, restore the prior domain/route bindings. Do
   not roll back by overwriting either project's database.

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

## Public-preview cutover on 2026-10-01

The public domain **has been switched to the static AVIBE casting preview**.
This is a limited release, not a claim that the full Next.js platform is live.
The preview source is commit `333e389` in `wuyinhust/vibe-casting`; its Worker
is `avibe-casting-preview`, with active version
`d221a4f8-1a94-4916-88cf-ea576e90a269`. The old `avibe` Worker still runs
version `9df84988-06d9-4e87-ad15-b65a1d5cd8dc` at 100% of its traffic.

| Hostname | Worker | Observed HTTPS behavior |
| --- | --- | --- |
| `avibe.net` | `avibe-casting-preview` | 200, new casting preview |
| `www.avibe.net` | `avibe-casting-preview` | 301 to `avibe.net`, then 200 new preview |
| `a.avibe.net` | `avibe` | 200, original vibe-coding site |
| `preview.avibe.net` | `avibe-casting-preview` | 200, independent verification address |

The old `*.avibe.net/*` route still points at `avibe`. More-specific routes
for `a.avibe.net/*`, `preview.avibe.net/*`, `avibe.net/*` and
`www.avibe.net/*` ensure the specified hostnames reach their intended Workers.
Do not remove or reassign the wildcard route without checking any other
subdomains that depend on it. Cloudflare custom-domain bindings agree with the
table above.

Live HTTP checks compared the root and www HTML, and the root CSS and
JavaScript, by SHA-256 with the committed preview build; all matched.
`/api/v1/health` and
`/images/cast-editorial.png` returned 404 as intended for this limited
release. The old site remained accessible at `a.avibe.net`. Browser visual QA
was not completed through the available UI harness.

To restore the old site to the primary domain, point the two exact routes
`avibe.net/*` and `www.avibe.net/*` back to `avibe`, then move the two custom
domain bindings back to `avibe`. Verify root, www and `a.avibe.net` over HTTPS.
The old Worker version above and the archived GitHub source were retained.
Do not touch the old database during a route rollback.

The full Node.js runtime, a dedicated production Supabase project, authorized
public character assets and provider verification remain future release work.
