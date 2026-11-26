"""Export the social-media kit (profile pictures + covers) from the master SVGs.

Run:  python3 brand/logo/source/export_social.py
In :  brand/logo/final/*.svg (masters, never edited by hand)
Out:  brand/logo/social/profile/*.png   square profile pictures (the Q mark, safe for circular crops)
      brand/logo/social/covers/*.png    covers / banners (the wordmark, inside each platform's safe area)
      brand/logo/social/previews/*.png  how the files look when cropped by the platforms
Debug: LOGO_EXPORT_VERBOSE=1 prints every file. Sizes are the platforms' recommended sizes (checked Nov 2026
against Sprout Social, Hootsuite and Buffer guides); change SIZES below if a platform changes them.
"""
import io, os, re, sys
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FINAL, OUT = ROOT / "final", ROOT / "social"
VERBOSE = os.environ.get("LOGO_EXPORT_VERBOSE") == "1"

CARBON, ALLOY, RHODAMINE = "#0E1013", "#ECEAE4", "#E3185B"

# name -> (width, height, share of canvas HEIGHT the wordmark occupies, note)
COVERS = {
    "linkedin-profile-banner-1584x396": (1584, 396, 0.46, "LinkedIn personal cover, 4:1"),
    "linkedin-company-banner-1128x191": (1128, 191, 0.50, "LinkedIn company cover (Hootsuite/Buffer size)"),
    "linkedin-company-banner-1512x256": (1512, 256, 0.50, "LinkedIn company cover (Sprout Social size)"),
    "x-header-1500x500": (1500, 500, 0.34, "X header, 3:1; avatar overlaps bottom-left"),
    "facebook-cover-1702x630": (1702, 630, 0.34, "Facebook cover at 2x of 851x315"),
    "youtube-banner-2560x1440": (2560, 1440, 0.0, "YouTube banner; content inside the 1546x423 safe area"),
}
YT_SAFE = (1546, 423)

def log(m):
    if VERBOSE: print(m)

def read(name):  # master svg text
    return (FINAL / name).read_text()

def recolor(svg, color):
    return svg.replace('#0E1013', color).replace('#ECEAE4', color)

def sized(svg, w, h):
    return re.sub(r'<svg ', f'<svg width="{w}" height="{h}" style="display:block" ', re.sub(r' width="[\d.]+" height="[\d.]+"', '', svg, count=1), count=1)

def vb(svg):
    m = re.search(r'viewBox="([\d.\s-]+)"', svg); x, y, w, h = map(float, m.group(1).split()); return w, h

class Renderer:
    def __init__(self, browser): self.b = browser
    def png(self, w, h, body, bg=None):
        page = self.b.new_page(viewport={"width": w, "height": h})
        bgcss = f"background:{bg};" if bg else ""
        page.set_content(f'<html><body style="margin:0;{bgcss}width:{w}px;height:{h}px;position:relative;overflow:hidden">{body}</body></html>')
        data = page.screenshot(omit_background=bg is None)
        page.close()
        return Image.open(io.BytesIO(data)).convert("RGBA")

def mark_bbox(r):
    mk = sized(read("mark.svg"), 800, 800)
    im = r.png(800, 800, mk, bg=None)
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()  # (l, t, r, b) in 800 units

def profile(r, bg, fg, size, bbox, diameter_share=0.74):
    """Centre the mark's bounding box on the canvas, sized so its bbox DIAGONAL fits inside the circle safe zone."""
    l, t, rr, b = bbox; bw, bh = rr - l, b - t
    diag = (bw ** 2 + bh ** 2) ** 0.5
    scale = (size * diameter_share) / diag           # bbox diagonal = diameter_share * canvas
    mk = recolor(read("mark.svg"), fg)
    draw_w = 800 * scale
    cx, cy = (l + bw / 2) * scale, (t + bh / 2) * scale  # bbox centre inside the scaled 800 box
    left, top = size / 2 - cx, size / 2 - cy
    body = f'<div style="position:absolute;left:{left}px;top:{top}px">{sized(mk, draw_w, draw_w)}</div>'
    return r.png(size, size, body, bg=bg)

def wordmark_html(w, h, share, fg, cx=None, cy=None, fit_w=None):
    svg = recolor(read("wordmark-light.svg"), fg)
    sw, sh = vb(svg)
    hh = h * share; ww = hh * sw / sh
    if fit_w and ww > fit_w: ww = fit_w; hh = ww * sh / sw
    cx = w / 2 if cx is None else cx; cy = h / 2 if cy is None else cy
    return f'<div style="position:absolute;left:{cx - ww/2}px;top:{cy - hh/2}px">{sized(svg, ww, hh)}</div>'

def cover(r, name, spec, bg, fg):
    w, h, share, _ = spec
    if name.startswith("youtube"):
        sw, sh = YT_SAFE
        body = wordmark_html(w, h, 1.0, fg, fit_w=sw * 0.72) if False else wordmark_html(w, h, (sh * 0.5) / h, fg)
    else:
        body = wordmark_html(w, h, share, fg)
    return r.png(w, h, body, bg=bg)

def save(im, path, flatten_bg=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if flatten_bg:  # opaque PNG for platforms that dislike alpha
        base = Image.new("RGBA", im.size, flatten_bg); base.alpha_composite(im); im = base
    im.convert("RGB").save(path, optimize=True)
    log(f"  {path.relative_to(ROOT.parent.parent)} {im.size}")

def circle_preview(src, diameter):
    im = src.resize((diameter, diameter), Image.LANCZOS)
    mask = Image.new("L", (diameter, diameter), 0); ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    out = Image.new("RGBA", (diameter, diameter), (255, 255, 255, 0)); out.paste(im, (0, 0), mask); return out

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(); r = Renderer(b)
        bbox = mark_bbox(r); log(f"mark bbox (800u): {bbox}")
        sets = {"carbon": (CARBON, ALLOY), "alloy": (ALLOY, CARBON), "rhodamine": (RHODAMINE, ALLOY)}
        prof = {}
        for tag, (bg, fg) in sets.items():
            big = profile(r, bg, fg, 1080, bbox); prof[tag] = big
            save(big, OUT / "profile" / f"qdt-profile-{tag}-1080.png")
            if tag != "rhodamine":
                save(profile(r, bg, fg, 800, bbox), OUT / "profile" / f"qdt-profile-{tag}-800.png")
                save(profile(r, bg, fg, 400, bbox), OUT / "profile" / f"qdt-profile-{tag}-400.png")
        covs = {}
        for name, spec in COVERS.items():
            for tag, (bg, fg) in {"carbon": (CARBON, ALLOY), "alloy": (ALLOY, CARBON)}.items():
                im = cover(r, name, spec, bg, fg); covs[(name, tag)] = im
                save(im, OUT / "covers" / f"qdt-{name}-{tag}.png")
        # link preview image (Open Graph 1200x630), also used by the website later
        for tag, (bg, fg) in {"carbon": (CARBON, ALLOY), "alloy": (ALLOY, CARBON)}.items():
            im = r.png(1200, 630, wordmark_html(1200, 630, 0.22, fg), bg=bg); save(im, OUT / "covers" / f"qdt-link-preview-1200x630-{tag}.png")
        b.close()
    # previews: circle crops and platform overlays
    pv = OUT / "previews"; pv.mkdir(exist_ok=True)
    sheet = Image.new("RGB", (1400, 560), "#777"); x = 30
    for tag in ("carbon", "alloy", "rhodamine"):
        for d in (320, 110, 48):
            c = circle_preview(prof[tag], d); sheet.paste(c, (x, 30 if d == 320 else (400 if d == 110 else 480)), c); 
            x += d + 20 if d != 320 else 0
        x += 340
    sheet.save(pv / "profile-circle-crops.png"); log("  previews/profile-circle-crops.png")
    # banner safe-area overlay: X header with avatar bite, LinkedIn banner with avatar bite
    for (name, tag, av) in (("x-header-1500x500", "carbon", (16, 330, 160)), ("linkedin-profile-banner-1584x396", "carbon", (32, 196, 160))):
        im = covs[(name, tag)].copy().convert("RGB"); d = ImageDraw.Draw(im)
        ax, ay, ad = av; d.ellipse((ax, ay, ax + ad, ay + ad), outline="#E3185B", width=4)
        im.save(pv / f"{name}-avatar-overlap-check.png")
    yt = covs[("youtube-banner-2560x1440", "carbon")].copy().convert("RGB"); d = ImageDraw.Draw(yt)
    sw, sh = YT_SAFE; d.rectangle(((2560 - sw) // 2, (1440 - sh) // 2, (2560 + sw) // 2, (1440 + sh) // 2), outline="#E3185B", width=6)
    yt.save(pv / "youtube-banner-safe-area-check.png")
    print("OK social kit:", sum(1 for _ in OUT.rglob("*.png")), "png files")

if __name__ == "__main__":
    sys.exit(main())
