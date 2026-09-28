# Vibe Casting × AVIBE

This repository brings together the original Vibe Casting character-creation method and AVIBE, a casting and reusable character-asset platform for AI video creators.

## Skills

- [`vibe-casting`](skills/vibe-casting/SKILL.md): the original ten-stage method for creating original, consistent, long-running virtual characters.
- [`avibe-casting`](skills/avibe-casting/SKILL.md): search the AVIBE catalog, inspect rights and versions, and download verified character packages.

Install one skill at a time with the Skills CLI:

```sh
npx -y skills add https://github.com/wuyinhust/vibe-casting --skill vibe-casting
npx -y skills add https://github.com/wuyinhust/vibe-casting --skill avibe-casting
```

## Website and character catalog

The Next.js website and service live in [`apps/avibe-web`](apps/avibe-web/README.md). Run it locally from that directory with Node.js 24 and `npm ci && npm run dev`. The website has a local demo mode; live generation, Supabase, messaging and payments need separately configured services.

The demo catalog is seeded from [`apps/avibe-web/data/demo-characters.json`](apps/avibe-web/data/demo-characters.json) and contains eight fictional example characters. Lin Yue has a sample reference package; its images are licensed for local product evaluation only. All other demo entries are showcase records. Character image rights are independent from either Skill's source-code terms.

Operational prospecting records and source spreadsheets are not part of this public repository. They are not approved public character assets.

## Project plan

See [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md) for product scope, architecture, delivery stages and release gates. Platform implementation notes and deployment requirements remain in [`apps/avibe-web/docs`](apps/avibe-web/docs/IMPLEMENTATION.md).

## License boundaries

This repository combines materials with different rights. The MIT license inside `skills/avibe-casting` applies only to that Skill, client and format documentation. The original `vibe-casting` Skill is preserved as a sub-Skill with its upstream terms; no new license is asserted here for it. AVIBE website and operations code, plans, demo images and character packages do not receive an additional license from this README. Each character package's own license controls its images and usage.
