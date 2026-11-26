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
1. **Logo (in progress).** Direction = bespoke text logotype in the manner of Emaar/Damac, all-caps QUOTESDONE + TECHNOLOGIES, small companion mark secondary; fully original; no resemblance to the QuotesDone app (no teal/gold/navy, no ring+check). Round 1 (symbol-led) archived at `brand/concepts/round1-archive/`. Round 2 = three lettering directions at `brand/concepts/r2-*` (build scripts included). **Status:** Refined REJECTED by owner (in `brand/concepts/rejected/`); Monolith = candidate (being refined: Q mark, TECHNOLOGIES weight, spacing); Engineered pending; owner decides Monolith vs Engineered next. Before final use: trademark clearance by a UAE IP lawyer (not done; we cannot certify uniqueness ourselves).
2. **Website (not started; references logged in `docs/references/website-inspiration.md`).** Waits for logo approval and the owner's reference video. Bar: extremely advanced 3D/motion, futuristic, big-tech, must not look AI-generated. Must present each product from the repos above in the company profile.

## Website quality bar (owner, 2026-11-26)
- 3D/motion: the 99designs 3D gallery is the MINIMUM; aim above it with real-time 3D and scroll-driven choreography, and avoid the generic crypto/AI tropes logged in `docs/references/website-inspiration.md`.
- Copy: Apple-grade: short, concrete, declarative, product-first; no filler or hype words. Every factual claim must be true and checkable (e.g. do not claim market dominance, user numbers or awards we cannot prove); product facts come from the live sites/repos.

## Checkpoint 1 — 2026-11-26
**Done**
- Repo was empty. Added standing rules skill, `CLAUDE.md` (imports rules/handover/ledger so they reload after compaction), `docs/LEDGER.md`, this handover.

**Global install:** copy of the skill is in `global/session-rules/`; container's `~/.claude` is ephemeral, so re-install on the owner's machine/account per `global/README.md`.

**In progress:** nothing.

**Next:** await owner's business direction for the product (no product scope defined yet).

**Decisions:** rules live in-repo (skill + CLAUDE.md) so they apply across accounts.

**Stack / how to run:** not yet defined.

**Gotchas:** none yet.
