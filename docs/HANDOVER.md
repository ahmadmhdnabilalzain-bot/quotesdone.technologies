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

## Checkpoint 1 — 2026-11-26
**Done**
- Repo was empty. Added standing rules skill, `CLAUDE.md` (imports rules/handover/ledger so they reload after compaction), `docs/LEDGER.md`, this handover.

**Global install:** copy of the skill is in `global/session-rules/`; container's `~/.claude` is ephemeral, so re-install on the owner's machine/account per `global/README.md`.

**In progress:** nothing.

**Next:** await owner's business direction for the product (no product scope defined yet).

**Decisions:** rules live in-repo (skill + CLAUDE.md) so they apply across accounts.

**Stack / how to run:** not yet defined.

**Gotchas:** none yet.
