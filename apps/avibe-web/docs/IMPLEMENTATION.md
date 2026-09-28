# avibe implementation

Two distribution boundaries: the website and operations source is included here without an additional license grant; `open-source/avibe-casting` is a self-contained MIT-licensed skill and format client. The upstream method is https://github.com/wuyinhust/vibe-casting, maintained by the requester. The avibe implementation maps identity, wardrobe and reference-card stages into durable jobs; it does not pretend the upstream project supplies a network API.

## Runtime modes

`npm run dev` defaults to local demo mode, serving only loopback. An embedded PGlite database persists in `.data/db`; assets live outside public web paths in `.data/assets`. Each explicit demo login creates its own isolated user. Only the editorial contact sheet is public. No uploaded source attachment was copied from the user's reference images.

Live mode uses the dedicated Supabase PostgreSQL connection, Supabase OTP and private storage, plus the independent pg-boss worker. Set AVIBE_MODE=live explicitly. Demo users and demo credits have no production meaning. Pricing and top-up plans are absent/inactive in live mode until configured by an administrator.

## Assets and jobs

Characters have persistent IDs. Looks are independently owned and private by default, even when based on a public character. Packages bind identity/appearance versions and snapshot persona and license documents. Required references are identity, full front and back. A package is created only after explicit review; image generation alone cannot publish it.

Creating or restyling calls OpenAI from server-side code only. The prompt records identity anchors, character data, source appearance and uploaded garment references. Every image is stored with role, SHA-256, dimensions and provider/job metadata. A standalone deterministic compositor creates the final character sheet from individual accepted views.

The public API uses service-side authorization as well as restricted database/storage policies. Anonymous access is limited to public catalog/showcases. Personal tokens are hashed, scoped and revocable. Package ZIPs are constructed only after purpose-specific authorization and checksum checks. Export blocks atomically if any board member is unavailable.

## Money and delivery

Quotes are versioned. Wallet reservations and job inserts share a database transaction. A delivery settles once; provider failure releases its reservation. An uncertain provider timeout is not blindly reissued. Pending/running work never creates a public package. Current jobs charge at the entire stage level: candidates, reference views, front try-on, back/side completion, a revised view, or a showcase.

Payment orders snapshot CNY amount and credit quantity. Provider callbacks require signatures, merchant checks, matching amounts and idempotent settlement. Unconfigured services fail closed. No demo or frontend endpoint can mark a payment successful or grant itself credits.

## Realtime

Business messages are written to the messages table, then a private Supabase broadcast wakes readers. Browser reads are subject to RLS. Internal notes never broadcast to the customer channel. A polling recovery path reloads persisted history after missed notifications and is used for local demos. Offline messages remain in the database; no fake salesperson replies or online status are generated.

## Visual assets

Original generated editorial contact sheet: `public/images/cast-editorial.png`.
Original generated four-view character reference: `assets/demo/lin-yue-card.png`.
Both were created with the built-in image generation tool. The reference card is split into explicitly reviewed panel bounds by the demo importer. The contact sheet is rendered with CSS background positions; it is not a substitute for production reference views.

Prompts: editorial 4×2 contact sheet of eight fictional adults with diverse ages, personalities and outfits, soft studio editorial lighting; follow-up identity-preserving portrait/front/back/side card for the top-left fictional 26-year-old woman in ivory knitwear and beige trousers. Full prompt details are in `docs/image-prompts.md`.
