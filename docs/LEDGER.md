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
