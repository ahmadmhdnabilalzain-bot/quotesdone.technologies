# QuotesDone Technologies: official logo (CONFIRMED 2026-11-26)

Owner-confirmed: concept "Engineered". All files in `final/` are the master assets; never redraw by hand.

- **Regenerate / adjust:** `source/build.py` (every value is a named parameter). Do not edit the SVGs directly.
- **Palette:** Carbon #0E1013 (logo), Alloy #ECEAE4 (light ground / reversed logo), Rhodamine #E3185B (accent for app tiles and highlights only, never inside the wordmark), Graphite #5E636B (secondary text).
- **Use:** `wordmark-light.svg` on light, `wordmark-dark.svg` on dark, `wordmark-onecolour.svg` for single-colour print, `wordmark-compact.svg` (gaps closed) when the wordmark is under about 480px wide, `mark*.svg` for icons (`mark-small.svg` at 32px and below), `lockup-*.svg` for the mark + wordmark combinations.
- **Animation:** `strokes.json` holds 43 separate stroke parts (draw order, centre-line path, outline, bounding box). Five parts (Q, both N diagonals, C, G) should be revealed with a mask, not stroked. Use it for the website's logo reveal.
- **Legal form:** the company is a Sole Establishment (DET Dubai Trader Licence). Never print "L.L.C.".
- **Known limits (accepted by owner):** gaps blur at small sizes (use compact/small cuts); N diagonal tips need a small flat for fabricated signage; the wide shape (about 10.7:1) is awkward in square formats, so use the mark there.
- **Clearance:** UAE name trademark reported cleared by owner. Visual (logo) similarity check NOT completed: see `../clearance/upload-pack/README.md`.
- **Rejected / history:** `../concepts/` (round 1 symbol-led, Monolith, Refined) kept for reference only.

## Vector storage (verified 2026-11-26)
- **Masters:** `final/*.svg`: 13 files, paths only; no embedded raster, no live text, no fonts, no external references (checked by script).
- **Print / signage vendors:** `exports/pdf/*.pdf`: vector PDFs, one page each, 0 embedded images, 0 fonts (checked with `pdfimages` / `pdffonts`). Scale freely.
- **Raster copies (convenience only, never masters):** `exports/png/`, transparent: wordmarks 600 to 2400 px wide, marks 512/1024, favicons 16/32/48/180/192 from `mark-small`.
- **Regenerate everything:** `python3 brand/logo/source/build.py` (masters), then `python3 brand/logo/source/export_assets.py` (PDF + PNG), then `for f in brand/logo/exports/pdf/*.pdf; do pdftocairo -eps "$f" "brand/logo/exports/eps/$(basename "${f%.pdf}").eps"; done`. Set `LOGO_EXPORT_VERBOSE=1` for logging.
- **EPS:** `exports/eps/*.eps` (13 files, made from the PDFs with `pdftocairo -eps`; vector paths, no embedded images or fonts). Not tested in Adobe/Corel here, so have the vendor open one first.
- **Not included:** native `.ai` (no Adobe tools here). A vendor that needs AI can open the PDF or EPS in Illustrator and save as AI; give them the PDF/EPS, never the PNG.
- **Backup:** the repo on GitHub is the system of record; also keep a copy of `brand/logo/` in the owner's own cloud storage.
