# AVIBE public preview

This is the bounded public-facing version of the AVIBE casting website for the
`avibe.net` cutover. It uses the main application's visual language and points
to the Skills in this repository. It is static by design: no sign-in, catalog
API, generation, character downloads, payments or local demo accounts are
served. The local-evaluation-only character images are excluded.

The full Next.js platform remains in `apps/avibe-web`. It needs a dedicated
production database, private storage, authentication and a Node.js service
before those features can be made public. Do not present this preview as a
production-ready platform.

To update the preview assets:

```sh
sh build.sh
npx wrangler deploy --config wrangler.jsonc
```

The Worker is named `avibe-casting-preview`. `dist/` is generated and ignored
by Git. Cloudflare domain bindings and the zone's more-specific Worker routes
are managed separately; the existing `*.avibe.net/*` route points to the
legacy `avibe` Worker and otherwise intercepts subdomains.
