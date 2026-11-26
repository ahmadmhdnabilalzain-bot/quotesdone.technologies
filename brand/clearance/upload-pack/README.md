# Manual logo-similarity check (5 minutes, normal browser)

WIPO's image search refuses scripted sessions (HTTP 401), so it must be run by a person.

1. Open https://branddb.wipo.int/en/similarlogo
2. Upload each PNG in this folder in turn: `1-wordmark-both-lines.png`, `2-wordmark-line1.png`, `3-q-mark.png`.
3. For each, run strategies **Shape** and **Conceptual** (then **Composite**).
4. Run once unfiltered, then filtered to IP office **AE**, then Nice classes **9, 35, 38, 42**.
5. Screenshot the first 15 results for every run into `../wipo-image-search/`.
6. Anything that looks close: note brand, owner, class, status (Registered / Pending / Ended).

Also useful: MoET UAE trademark inquiry (official, paid per search, class-specific) for the formal UAE answer.

## Brief for the IP lawyer
- Mark: stylised word mark QUOTESDONE (+ TECHNOLOGIES line), and a standalone "Q" device. Files: this folder; vectors in `../../concepts/r2-engineered/`.
- Owner: QuotesDone Technologies (Dubai Sole Establishment; DET Dubai Trader Licence on the company's website).
- Classes to consider: 9 (software), 35 (business/marketplace services), 38, 42 (SaaS, platform), possibly 41 (Sonobolt music products; the product has its own brand).
- Name search done by us (WIPO, 90 offices incl. UAE): no exact QUOTESDONE / QUOTES DONE; nearest QUOTEZONE (GB, Seopa Ltd, classes 9/35/36/41, registered to 2036). Owner reports the UAE name search is cleared.
- Specific visual question: stylised geometric wordmarks with cut/shared strokes, e.g. TESLA (wide spaced caps with notched terminals). Our T-E-S strokes merge inside the longer word. See `../tesla-vs-ours.png`.
- Not done: formal image-similarity search; common-law (unregistered) use search; non-UAE offices beyond the WIPO name check.
