"""Export print-ready vector PDFs and common PNG sizes from the master SVGs.

Run from anywhere:  python3 brand/logo/source/export_assets.py
Reads  brand/logo/final/*.svg  (masters, never edited by hand)
Writes brand/logo/exports/pdf/*.pdf   (vector, for print and signage vendors)
       brand/logo/exports/png/*.png   (raster convenience copies, transparent)
Debug: set LOGO_EXPORT_VERBOSE=1 for per-file logging.
"""
import os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FINAL, PDF, PNG = ROOT / "final", ROOT / "exports" / "pdf", ROOT / "exports" / "png"
VERBOSE = os.environ.get("LOGO_EXPORT_VERBOSE") == "1"

# (svg, [png widths in px])
PNG_SIZES = {
    "wordmark-light.svg": [600, 1200, 2400], "wordmark-dark.svg": [600, 1200, 2400],
    "wordmark-onecolour.svg": [1200], "wordmark-compact.svg": [240, 480],
    "wordmark-line1-light.svg": [1200], "wordmark-line1-dark.svg": [1200],
    "lockup-horizontal.svg": [1200], "lockup-horizontal-dark.svg": [1200], "lockup-stacked.svg": [1200],
    "mark.svg": [512, 1024], "mark-dark.svg": [512], "mark-onecolour-carbon.svg": [512],
    "mark-small.svg": [16, 32, 48, 180, 192],
}

def viewbox(svg: str):
    m = re.search(r'viewBox="([\d.\s-]+)"', svg)
    x, y, w, h = map(float, m.group(1).split())
    return w, h

def log(msg):
    if VERBOSE: print(msg)

def main():
    PDF.mkdir(parents=True, exist_ok=True); PNG.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for svg_path in sorted(FINAL.glob("*.svg")):
            svg = svg_path.read_text(); w, h = viewbox(svg)
            # PDF page = artwork size in CSS px scaled so the long side is 297 mm-ish; vector, scale freely.
            scale = 1000 / w if w >= h else 1000 / h
            pw, ph = w * scale, h * scale
            html = f'<html><body style="margin:0"><div style="width:{pw}px;height:{ph}px">{svg.replace("<svg", f"<svg width=\'{pw}\' height=\'{ph}\'", 1)}</div></body></html>'
            page = b.new_page(); page.set_content(html)
            page.pdf(path=str(PDF / (svg_path.stem + ".pdf")), width=f"{pw}px", height=f"{ph}px",
                     print_background=True, page_ranges="1")
            page.close(); log(f"pdf  {svg_path.name}")
            for width in PNG_SIZES.get(svg_path.name, []):
                ph2 = max(1, round(width * h / w))
                page = b.new_page(viewport={"width": width, "height": ph2})
                page.set_content(f'<html><body style="margin:0;background:transparent">'
                                 f'{svg.replace("<svg", f"<svg width=\'{width}\' height=\'{ph2}\'", 1)}</body></html>')
                page.screenshot(path=str(PNG / f"{svg_path.stem}-{width}w.png"), omit_background=True)
                page.close(); log(f"png  {svg_path.stem}-{width}w")
        b.close()
    print(f"OK: {len(list(PDF.glob('*.pdf')))} pdf, {len(list(PNG.glob('*.png')))} png")

if __name__ == "__main__":
    sys.exit(main())
