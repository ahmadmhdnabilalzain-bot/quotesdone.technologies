# Instruction Ledger

Append-only log of the owner's instructions. Newest at the bottom.
Status: `standing` (always applies) | `open` | `done`.

| # | Date | Instruction | Status | Outcome / where |
|---|------|-------------|--------|-----------------|
| 1 | 2026-11-26 | Preference: always use top engineering standards; code organized, easily debugged and troubleshot. | standing | `.claude/skills/session-rules/SKILL.md` |
| 2 | 2026-11-26 | Preference: always use agents in parallel to speed up work; assign model by task complexity. | standing | session-rules rule 6 |
| 3 | 2026-11-26 | Rule 1: always use installed skills/plugins when needed to improve output. | standing | session-rules rule 1 |
| 4 | 2026-11-26 | Rule 2: Claude is technical expert; owner gives business direction; Claude delivers what is needed. | standing | session-rules rule 2 |
| 5 | 2026-11-26 | Rule 3: never give a reply Claude is not confident about. | standing | session-rules rule 3 |
| 6 | 2026-11-26 | Rule 4: save checkpoints in a handover on the repo so another account can resume without repeating. | standing | `docs/HANDOVER.md` |
| 7 | 2026-11-26 | Rule 5: owner instructions are always saved in a ledger. | standing | this file |
| 8 | 2026-11-26 | Rule 6: always use more than one agent in parallel when possible. | standing | session-rules rule 6 |
| 9 | 2026-11-26 | Save these rules as a skill and apply always (must persist through context compression). | done | skill + CLAUDE.md imports |
| 10 | 2026-11-26 | Rules skill must be available on every project (global install). | done | `~/.claude/skills/session-rules` (this container, ephemeral) + copy in `global/` with install steps |
| 11 | 2026-11-26 | Read (read-only) the descriptions of repos quotesdone / ERP / DJ AI / HR and say what each is. | done | Mapped to `quotesdone`, `ERP`, `djai-engine`, `HR-Payroll`; summary in HANDOVER |
| 12 | 2026-11-26 | All current and future apps must be hosted on a website matching the trade license name "quotesdone technologies" (domain quotesdone.technologies). | open | Domain NOT yet bought (owner: "later"). Owner chose: public company site + app directory at apex, apps on subdomains. Hosting/DNS work deferred until domain purchased |
| 13 | 2026-11-26 | First create a logo for QuotesDone Technologies (before the hub site). | open | Existing product brand found (teal Q-ring + gold check, navy ground, Inter-style bold). Concepts in progress under `brand/` |
| 14 | 2026-11-26 | Logo need not look like the QuotesDone app; the app is one product under QuotesDone Technologies (the parent/master brand). | standing | Logo brief reset: master brand, free palette, must host many products |
| 15 | 2026-11-26 | Purpose of sharing the repos: so Claude understands each app and can include them in the company profile on the website. | standing | Repo map in HANDOVER |
| 16 | 2026-11-26 | Website expectation: extremely advanced 3D + animation + motion graphics, futuristic, must NOT look AI-made, must feel like a very big tech company (owner will dominate the market, many apps coming). Owner will share a video of reference websites. | open | Website starts after logo approval and reference video |
| 17 | 2026-11-26 | Logo: text/lettering-led like Emaar / Damac (bespoke logotype). A small companion mark is fine but must not take focus. Must be purely ours (original, not borrowed). Must NOT reflect the QuotesDone app (separate product). Claude may use Canva if helpful. | open | Round 2 in progress: `brand/concepts/r2-*`; round 1 symbol-led concepts archived in `brand/concepts/round1-archive/` |
| 18 | 2026-11-26 | Product portfolio for the company profile: DJ AI = "sunobolt.com"; QuotesDone = quotesdone.com; HR = "MubinFlow" (no website yet; its logo is in the HR-Payroll repo); same applies to the rest. ERP ("Manar One") is NOT to be included for now, its name will change later. | standing | Portfolio table in HANDOVER. Spelling resolved (#19) |
| 19 | 2026-11-26 | Confirmed the DJ AI product name is "Sonobolt" (sonobolt.com). | done | HANDOVER portfolio table updated |
| 20 | 2026-11-26 | Owner: Sonobolt already has a live website, "you can even check it". | done | Verified live (sonobolt.com, plus quotesdone.com); HANDOVER corrected |
| 21 | 2026-11-26 | Shared 99designs 3D-websites gallery as website inspiration. | done | Analysed: mood-only reference, concepts not live sites; notes in `docs/references/website-inspiration.md` |
| 22 | 2026-11-26 | The 99designs gallery designs show the MINIMUM level of 3D/motion advancement the website must reach. Copywriting must be "Apple" quality (and Apple-type content quality overall). | standing | Quality bar recorded in HANDOVER; every claim on the site must still be true and sourced |
| 23 | 2026-11-26 | Logo decision: concept 2 (Refined) REJECTED. Concept 1 (Monolith) "fine somehow" = candidate. Wait for concept 3 (Engineered), then owner decides between 1 and 3. | open | Refined moved to `brand/concepts/rejected/`; Monolith being refined; Engineered in progress |
| 24 | 2026-11-26 | Logo finalists: Monolith (v2 refined) vs Engineered (complete). Owner to choose; Claude recommends Engineered with one refinement round (TES cluster legibility, small sizes, distance from Tesla-like associations). | open | Side-by-side: `brand/concepts/compare-monolith-vs-engineered.png` |
