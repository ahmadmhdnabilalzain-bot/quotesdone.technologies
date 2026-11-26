# Handover

Resume point for any account/session. Update at every milestone; newest checkpoint on top.

## How to resume
1. Read `.claude/skills/session-rules/SKILL.md` (standing rules), this file, `docs/LEDGER.md`.
2. Work on branch `claude/sleepy-newton-64snxe`; push there only.

## Owner's repo map (read-only survey, 2026-11-26)
All under github user `ahmadmhdnabilalzain-bot`.
- `quotesdone` (public): UAE B2B anonymous quotation marketplace; Next.js 16 + Supabase (79 edge functions), Stripe, 3% reveal fee, pre-launch, AI "seats" run the company.
- `ERP` (private): "Manar One" ERP/CRM for UAE scaffolding sales & manufacturing groups; Next.js + Prisma/Postgres; modules sales, stock, production, finance, HR/payroll.
- `djai-engine` (private): "Sonobolt" (code name DJAI) Python engine turning recordings into beat-aligned DJ mixes; FFmpeg, web app via uvicorn.
- `HR-Payroll` (public): HR & payroll product for UAE SMEs; pnpm TypeScript monorepo (engine, WPS SIF, API, contract); web UI paused pending owner's design pick. No README; HANDOVER.md/LEDGER.md instead.
- `quotesdone.technologies` (this repo): currently only the session-rules scaffolding; purpose not yet defined.

## Decision: company hub domain (2026-11-26)
- Goal: all current/future apps live under `quotesdone.technologies` (trade-licence name).
- Domain **not purchased yet** (owner: later). No DNS/hosting changes until it is.
- Owner chose: public company site + app directory at the apex; each app on its own subdomain (separate stacks: Vercel / Render / Docker, so subdomains, not paths).
- Existing apps keep current hosts: quotesdone (Vercel, quotesdone.com/.ae), ERP (Render), HR-Payroll (Render), djai-engine (Docker).
- Next when approved: build hub site in this repo (hosting-agnostic static site), deploy to a temporary Render URL, attach domain + subdomains after purchase. Needs from owner: licence number/emirate/activity, contact details, logo/brand, which apps to list publicly.

## SCOPE (owner, 2026-11-26): this session is for the WEBSITE DESIGN
Stay on the hub website (design, copy, build). Do NOT audit or chase issues in the other apps (QuotesDone, Sonobolt, MubinFlow, ERP); use their public facts only as website content. Known items the owner has seen and parked: `app.sonobolt.com` not resolving; licence-wording mismatch between product sites.

## Website plan (decided by Claude as technical lead, 2026-11-26; details in `docs/website/structure-v1.md` and `copy-v1.md`)
- Stack: Astro 7 static, plain three.js (WebGL2), GSAP; Lenis on desktop only. Hosting: Cloudflare Pages (reuses Sonobolt's deploy workflow), Render as fallback. Supersedes the earlier "temporary Render URL" idea.
- Logo opens the site: drawn from the 43 stroke parts, then a 3D exploded view, then docks into the header (compact cut below 480px).
- One visual idea: the "datum line"; each product is an object on a rail (QuotesDone = sealed plates, Sonobolt = waveform coil, MubinFlow = CAD linework because in development).
- **Owner override (ledger #36): build the COMPLETE site desktop-first with full-quality 3D; phone adaptation (iPhone 13+) comes after.** Still: all words in HTML; no-JS/reduced-motion/no-WebGL fall back to stills; Arabic RTL prepared from day one.
- First milestone is now the FULL HOME PAGE (all 8 scenes) plus inner pages, desktop-first; phone tuning after.
- Hub subdomains for QuotesDone/Sonobolt only redirect; those products keep their own domains (supersedes ledger #12 wording).
- Owner-gated: reference video, 3D-artist budget, final contact/legal details before launch.

## WEBSITE STATUS (2026-11-26, end of build day 1)
- Full home page + 8 inner/utility pages built, desktop-first, in `site/` (Astro 7, three.js r187, GSAP). Gate: lint 0, 187 unit tests, build 18 pages, content+budget checks ok, e2e 101 pass (desktop + iPhone-13 emulation). Run: `cd site && npm ci && npm run dev` (see `site/README.md`).
- PREVIEW (owner approved): https://qdt-hub-preview.onrender.com (Render static site `qdt-hub-preview`, autoDeploy OFF: redeploy via Render MCP `trigger_deploy` or dashboard). Hidden from search (noindex).
- Docs: `site/docs/{integration-notes,polish-notes,typography}.md`, `site/src/three/runtime/README.md`, each scene's README.
- Not awe-level yet (honest): materials/lighting art direction per scene, owner's reference video not received, stills are placeholders, phone phase not done, real-GPU and real-iPhone check not done (all timings were SwiftShader/emulation).
- Open owner items: reference video; font/Arabic timing; 3D-artist budget; copy-deck [OWNER TO CONFIRM] items (email, phone, address, founder line, licence wording); domain purchase; logo-similarity check/lawyer; Sonobolt app link (parked).

## Product portfolio for the company website (owner-confirmed 2026-11-26)
| Product | Public name / domain | Repo | Brand assets | Status |
|---|---|---|---|---|
| Quotation marketplace | QuotesDone, quotesdone.com (+ .ae) | `quotesdone` | `public/brand/`, `/brand` page | **LIVE** at quotesdone.com (English + Arabic); pre-launch commercially, sample data shown |
| AI DJ-mix engine | Sonobolt, sonobolt.com (spelling confirmed by owner 2026-11-26) | `djai-engine` | `docs/brand/kit/` (app icons, BRAND-GUIDE.pdf) | **LIVE** at sonobolt.com (app at app.sonobolt.com). Sonobolt Mix available (AED 99/hour); Sonobolt Studio and Sonobolt Visuals announced "coming soon" |
| HR & payroll | MubinFlow (written "MubinFlow"; domain typed "Mubinflow"), no website yet | `HR-Payroll` | `docs/brand/logo/final/` (typographic wordmark + monogram, SVG/PNG) | engine+API built, web UI paused |
| ERP | "Manar One" — **EXCLUDE from website for now** (name will change) | `ERP` | n/a | in use with a customer |
Verified live 2026-11-26 by fetching both sites. Both already name the company as "QuotesDone Technologies" (QuotesDone states it is licensed by the Dubai Department of Economy and Tourism; Sonobolt's contact block lists the company's Dubai address) — reuse that exact wording on the hub site after checking it against the trade licence. Sonobolt's live site is dark, photographic and editorial: study it as a reference for the hub's tone.
Each product keeps its own brand; the parent logo must not imitate any of them. Future products get added here.

## Workstream: logo then website (2026-11-26)
1. **Logo (CONFIRMED 2026-11-26: Engineered; master assets in `brand/logo/final/`, usage in `brand/logo/README.md`).** Earlier notes follow: Direction = bespoke text logotype in the manner of Emaar/Damac, all-caps QUOTESDONE + TECHNOLOGIES, small companion mark secondary; fully original; no resemblance to the QuotesDone app (no teal/gold/navy, no ring+check). Round 1 (symbol-led) archived at `brand/concepts/round1-archive/`. Round 2 = three lettering directions at `brand/concepts/r2-*` (build scripts included). **Status:** Refined REJECTED by owner (in `brand/concepts/rejected/`); Monolith = candidate, refined v2 done (Q now a stadium bowl with a flat 'Sill' tail; T-E share a 'Lintel' beam; palette Oxblood #6E2230 / Basalt #1D1C1A / Limestone #ECE8E0; 12 SVGs + app icon + build.py; honest weakness: wide flat caps are an established genre, only Sill+Lintel make it ownable, tail descends ~10% below baseline); Engineered COMPLETE (43 animation-ready stroke parts in `strokes.json`; Carbon #0E1013 / Alloy #ECEAE4 / Rhodamine #E3185B accent; weaknesses: stencil-like gaps, TES cluster resembles Tesla/Avant-Garde, small sizes need the compact cut). **Owner chose ENGINEERED (2026-11-26)**; owner says UAE name trademark is cleared; logo-design similarity check in progress (`brand/clearance/`). Legal form of the company is Sole Establishment (not L.L.C.): never print "L.L.C.". Finalists were Monolith vs Engineered; comparison image in `brand/concepts/`; owner decides next. Whichever wins: run trademark clearance and a refinement round before final. Before final use: trademark clearance by a UAE IP lawyer (not done; we cannot certify uniqueness ourselves).
2. **Website (NEXT; waiting for the owner's reference-site video; not started; references logged in `docs/references/website-inspiration.md`).** Waits for logo approval and the owner's reference video. Bar: extremely advanced 3D/motion, futuristic, big-tech, must not look AI-generated. Must present each product from the repos above in the company profile.

## Website quality bar (owner, 2026-11-26)
- 3D/motion: the 99designs 3D gallery is the MINIMUM; aim above it with real-time 3D and scroll-driven choreography, and avoid the generic crypto/AI tropes logged in `docs/references/website-inspiration.md`.
- Copy: Apple-grade: short, concrete, declarative, product-first; no filler or hype words. Every factual claim must be true and checkable (e.g. do not claim market dominance, user numbers or awards we cannot prove); product facts come from the live sites/repos.

## Skills to apply in the website phase (installed; the logo phase used custom agents and did not invoke them: be sure to use these next)
- Copy: `copywriting-kit:brand-voice`, `landing-page-copy`, `copy-edit`, `copy-proof-check`; `anti-ai-writing` / `humanizer` / `unslop` to strip AI-sounding text; `marketing:brand-review`.
- Design/build: `frontend-design:frontend-design`, `superdesign`, `design-superpowers:*` (creative, design-review), `audit-suite:web-animation-design`, `audit-suite:emil-design-engineering`, `audit-suite:vercel-react-best-practices`, `modern-web-guidance`, `ui-consistency:*`, `vectorlab-ux-skills:*` (motion, reduced-motion, viewports), `tweenkit:animation-html`, `remotion:*` (video), `design:accessibility-review`.
- Assets/brand: `zizi-skills:design-assets` (logos, favicons, raster-to-vector), `aitopia:aitopia-brand-kit` (second-opinion brand kit), Canva connector (`canva:*`) for decks and social templates.
- Audit before release: `audit-suite:full-audit`, `engineering:code-review`, `supermatt:code-review`, `zizi-skills:security-and-hardening`.

## Checkpoint 1 — 2026-11-26
**Done**
- Repo was empty. Added standing rules skill, `CLAUDE.md` (imports rules/handover/ledger so they reload after compaction), `docs/LEDGER.md`, this handover.

**Global install:** copy of the skill is in `global/session-rules/`; container's `~/.claude` is ephemeral, so re-install on the owner's machine/account per `global/README.md`.

**In progress:** nothing.

**Next:** await owner's business direction for the product (no product scope defined yet).

**Decisions:** rules live in-repo (skill + CLAUDE.md) so they apply across accounts.

**Stack / how to run:** not yet defined.

**Gotchas:** none yet.
