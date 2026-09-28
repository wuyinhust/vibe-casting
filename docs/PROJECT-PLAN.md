# AVIBE project plan

## Product goal

AVIBE helps AI video and short-drama creators find suitable characters, bring versioned character assets into production, and connect digital talents with brand opportunities. The end-to-end path is: discover → cast to a project → download a fixed character package → create or restyle → make content → request a brand collaboration.

## Product boundaries

- The two skills serve different jobs: `vibe-casting` creates a stable original character; `avibe-casting` finds, inspects and downloads already registered assets.
- A digital talent identity is distinct from its looks, showcase cards, role assignments and downloadable character packages. The same talent can play a lead, supporting role or extra in different projects.
- Public characters require approved display and distribution terms. Commercial use and brand-collaboration rights are separately recorded per character and version.
- User-created work remains private by default. A creator submission enters the public catalog only after review.
- Public browsing and search are available without login; download, casting boards, creation, restyling and business messaging require an account.
- Platform registration and evidence records support provenance review; they do not represent government copyright registration or legal proof of ownership.

## Initial user journeys

### Discover and cast

A Pinterest-style, bilingual catalog supports structured hard filters and natural-language preferences. Hard requirements such as age range, intended license, visibility and required assets must not be overridden by similarity ranking. Users can like and save talents to project casting boards, assign script roles, compare candidates and export selected package versions with a casting list.

### Create a digital talent

Creation proceeds through a brief, face candidates, identity confirmation, editable persona, multi-view references and a showcase card. A quick-character path serves supporting roles and extras; a full-talent path adds long-term persona, wardrobe and world details. Each stage saves progress and supports targeted rework.

### Restyle

Creators select a character version, upload garment references, choose the replacement scope, approve a front preview, then complete other views. Identity anchors, old looks and garment inputs remain separately versioned. A missing back reference must be labeled as inferred. Image consistency remains a human review gate.

### Collaborate

A talent's collaboration action opens a business conversation with AVIBE staff and includes the chosen talent/look. The first release supports persistent text and image messages, offline inquiries, staff assignment and private notes. It is not a user-to-user social network.

## Architecture

- TypeScript and Next.js web and API service.
- Supabase for hosted PostgreSQL, email OTP, private storage and authorized realtime broadcasts.
- An independent Node.js image-generation worker with PostgreSQL-backed jobs.
- OpenAI image and text services are called server-side; credentials are never bundled into browser code or the skills.
- Character identity versions, look versions, packages, rights claims, evidence, casting boards, jobs, credit ledger and business conversations are separate records.
- Download authorization is enforced server-side; package manifests pin identity/look versions and hash every included file.

## Delivery stages

1. **Character assets and casting:** package format, reviewed demo/imported characters, bilingual discovery, search, rights, casting boards and the download Skill.
2. **Creation and restyling:** staged generation workflows, private drafts, identity/version management, OpenAI integration and submission review.
3. **Billing and business operations:** credit ledger, configured WeChat/Alipay payment integrations, persistent business chat and staff console.
4. **Release acceptance:** desktop/mobile visual review, authorized source-material verification, payment and privacy tests, real model cost measurements, backups and pre-production sign-off.

The code currently provides a local demo and service adapters. A passing local build does not mean OpenAI, hosted Supabase, payment merchants or the production domain have been connected or accepted. Do not enable live top-ups before configuring prices from measured costs and completing merchant tests.

## Success measures

The lead indicator is the share of users who download a character after finding it and reuse that character in a later project. Also track generation cost and time, restyling acceptance rate, complete-package rate, and qualified brand inquiries. Distinguish showcase views from licensed downloads and successful reuse.

## Release gates

- English and Chinese queries obey identical hard constraints; no silent fallback when there is no exact result.
- The website and Skill return the same pinned character/look/package versions and hashes.
- Private assets never appear in public search; identity edits do not mutate reviewed historical packages.
- Failed image jobs do not publish partial packages and release reserved credits exactly once.
- Restricted package downloads cannot be bypassed with guessed asset URLs.
- Payment callbacks are signed, amount-checked and idempotent; uncertain transactions can be reconciled.
- Conversation history is durable; messages and attachments are inaccessible to unrelated accounts.
- Phone and desktop can complete discovery, casting, download, restyling preview and business inquiry.
- Sample and public catalog assets have explicit rights metadata. Third-party creator prospecting records stay in private operations storage until separately approved for public release.

## Current public catalog and privacy

The repository includes eight fictional demo character records in the website seed. Their showcase images and the Lin Yue sample package are explicitly restricted to local product evaluation. They are examples, not production marketplace listings. The previously imported creator-account research and its raw notes are operational lead data, not downloadable character assets, so they are excluded from this public repository.

## Commercial direction

Initial revenue paths are separately priced generation/restyling credits, talent brand collaborations, custom character creation and branded content. Clothing-company catalog services, clothing transactions, creator revenue sharing, video generation and voice libraries remain follow-up products. Price and unit economics must be configured only after real provider usage is measured.
