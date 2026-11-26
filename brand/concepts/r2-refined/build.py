#!/usr/bin/env python3
"""
QUOTESDONE TECHNOLOGIES  -  logotype R2-2 "Refined"
===================================================

Every letter is drawn here from geometric primitives (rectangles, flared
stems, contrast rings, a variable-width pen stroke for the S) and merged with
Skia path booleans (skia-pathops).  No font file is read; no stock glyph is
used, not even as a skeleton.  Proportions follow classical Roman capitals
(wide rounds, narrow E/L/S), rebuilt with a vertical-stress contrast model.

Two deliberate, ownable modifications
  1. The "pillar Q": the lower right quarter of the Q bowl straightens into a
     vertical pillar that drops below the baseline.  The G jaw repeats the same
     straight lower quarter (without the drop), so the move belongs to a system.
  2. The "forward cut": every free terminal (arms of T E L, the C G S
     terminals) is sliced on one shared forward-leaning angle (CUT_DEG), so
     the whole word leans forward at its edges while standing upright.

Units: cap height H = 1000, y up, baseline 0.  SVG output flips y.

Usage
  python3 build.py                 build all deliverables + preview.png
  python3 build.py --checks DIR    also write zoom crops / 24 px test to DIR
Requires: skia-pathops, playwright (chromium) for the preview.
"""
from __future__ import annotations

import argparse
import math
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, replace
from functools import reduce
from pathlib import Path

import pathops

OUT = Path(__file__).resolve().parent

# --------------------------------------------------------------------------
# Palette
# --------------------------------------------------------------------------
OBSIDIAN = "#121212"      # primary ink (neutral, no blue cast: never navy)
PORCELAIN = "#F3F2EE"     # paper / reversed ink (neutral, not bone-warm)
ULTRAVIOLET = "#6B2BF0"   # single accent: app tiles, digital highlights only
ULTRAVIOLET_LIGHT = "#A88BFF"  # same hue, lifted for use on Obsidian
GRAPHITE = "#6F6E6A"      # neutral for captions / secondary UI


# --------------------------------------------------------------------------
# Parameters (one set per optical size)
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Params:
    H: float = 1000.0      # cap height
    OV: float = 13.0       # overshoot of round letters (top & bottom)
    STEM: float = 124.0    # straight vertical stem
    ROUND: float = 136.0   # thickest part of bowls (optically > STEM)
    HAIR: float = 44.0     # thinnest part of bowls (top / bottom of O)
    ARM: float = 50.0      # horizontal arms (E F L T H bar)
    THIN: float = 52.0     # thin verticals (N stems, U right stroke)
    DIAG: float = 132.0    # N diagonal, measured perpendicular
    FLARE: float = 0.07    # stems are this much narrower at mid-height
    CUT_DEG: float = 17.0  # the forward cut, degrees from vertical
    K_OUT: float = 0.585   # bezier kappa of outer bowls (0.5523 = ellipse)
    K_IN: float = 0.610    # kappa of counters (squarer = more technical)
    PEN_K: float = 1.35    # S pen: thickness = HAIR + (ROUND-HAIR)*|dy|^PEN_K
    DESC: float = 205.0    # depth of the Q pillar below baseline
    SB: float = 64.0       # base side-bearing for a straight stem side
    TRACK: float = 150.0   # extra tracking added to every gap
    WIDTH: float = 1.0     # global width factor for letter bodies


DISPLAY = Params()                       # QUOTESDONE, line 1
SMALL = replace(DISPLAY, STEM=150, ROUND=158, HAIR=104, ARM=106, THIN=112,
                DIAG=150, FLARE=0.0, OV=11, K_IN=0.60)  # TECHNOLOGIES
MARK = replace(DISPLAY, STEM=170, ROUND=184, HAIR=92, ARM=96, THIN=100,
               DIAG=176, DESC=240, OV=12)                 # companion mark

LINE2_SCALE = 0.300        # cap height of TECHNOLOGIES relative to line 1
LINE_GAP = 0.400           # gap between baseline 1 and cap top of line 2 (xH)
OPTICAL_LEFT = 14.0        # line-2 left inset so flat T aligns to round Q


# --------------------------------------------------------------------------
# Path helpers
# --------------------------------------------------------------------------
def poly(pts) -> pathops.Path:
    p = pathops.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.close()
    return p


def union(*paths) -> pathops.Path:
    paths = [p for p in paths if p is not None]
    return reduce(lambda a, b: pathops.op(a, b, pathops.PathOp.UNION), paths)


def diff(a, b) -> pathops.Path:
    return pathops.op(a, b, pathops.PathOp.DIFFERENCE)


def inter(a, b) -> pathops.Path:
    return pathops.op(a, b, pathops.PathOp.INTERSECTION)


def rect(x0, y0, x1, y1) -> pathops.Path:
    return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def ellipse(cx, cy, rx, ry, k) -> pathops.Path:
    """Four-cubic ellipse; k > 0.5523 squares it toward a superellipse."""
    p = pathops.Path()
    p.moveTo(cx + rx, cy)
    p.cubicTo(cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry)
    p.cubicTo(cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy)
    p.cubicTo(cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry)
    p.cubicTo(cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy)
    p.close()
    return p


def box_ellipse(x0, y0, x1, y1, k) -> pathops.Path:
    return ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, k)


def contrast_ring(p: Params, x0, x1, y0, y1, side=None, top=None):
    """Outer box minus counter.  Sides ROUND thick, top/bottom HAIR thin."""
    side = p.ROUND if side is None else side
    top = p.HAIR if top is None else top
    outer = box_ellipse(x0, y0, x1, y1, p.K_OUT)
    inner = box_ellipse(x0 + side, y0 + top, x1 - side, y1 - top, p.K_IN)
    return outer, inner


def half_plane(x0, y0, deg, keep="left", big=6000.0):
    """Half plane bounded by the line through (x0, y0) leaning `deg` degrees
    from vertical (top to the right = the forward cut)."""
    t = math.tan(math.radians(deg))
    top = (x0 + (big - y0) * t, big)
    bot = (x0 + (-big - y0) * t, -big)
    if keep == "left":
        return poly([bot, top, (-big, big), (-big, -big)])
    return poly([bot, (big, -big), (big, big), top])


def cut_band(x0, y0, deg, side, ymin, ymax, big=4000.0):
    """Polygon of the half plane on `side` of the forward-cut line through
    (x0, y0), clipped to the horizontal band ymin..ymax."""
    t = math.tan(math.radians(deg))
    xa, xb = x0 + (ymin - y0) * t, x0 + (ymax - y0) * t
    edge = big if side == "right" else -big
    return poly([(xa, ymin), (edge, ymin), (edge, ymax), (xb, ymax)])


def flared_stem(p: Params, xc, y0, y1, w, flare=None):
    """Vertical stem centred on xc whose sides curve in at mid-height."""
    f = p.FLARE if flare is None else flare
    we, wm = w * (1 + f / 2), w * (1 - f / 2)
    path = pathops.Path()
    cxl = xc - wm + we / 2           # quadratic control so mid hits wm/2
    cxr = xc + wm - we / 2
    ym = (y0 + y1) / 2
    path.moveTo(xc - we / 2, y0)
    path.lineTo(xc + we / 2, y0)
    path.quadTo(cxr, ym, xc + we / 2, y1)
    path.lineTo(xc - we / 2, y1)
    path.quadTo(cxl, ym, xc - we / 2, y0)
    path.close()
    return path, we


def arm(p: Params, x0, x1, y0, y1, cut_left=False, cut_right=True):
    """Horizontal bar; ends sliced by the forward cut through the bar's mid."""
    t = math.tan(math.radians(p.CUT_DEG))
    ym = (y0 + y1) / 2
    lx0 = x0 + (y0 - ym) * t if cut_left else x0
    lx1 = x0 + (y1 - ym) * t if cut_left else x0
    rx0 = x1 + (y0 - ym) * t if cut_right else x1
    rx1 = x1 + (y1 - ym) * t if cut_right else x1
    return poly([(lx0, y0), (rx0, y0), (rx1, y1), (lx1, y1)])


# -- variable-width pen (used for the S only; everything else is beziers) ---
def _cubic(p0, p1, p2, p3, t):
    u = 1 - t
    x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
    y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
    dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    return x, y, dx, dy


def hermite_chain(nodes):
    """nodes: (x, y, angle_deg, handle_in, handle_out) -> list of cubics."""
    segs = []
    for a, b in zip(nodes, nodes[1:]):
        ax, ay, aa, _, ao = a
        bx, by, ba, bi, _ = b
        da = (math.cos(math.radians(aa)), math.sin(math.radians(aa)))
        db = (math.cos(math.radians(ba)), math.sin(math.radians(ba)))
        segs.append(((ax, ay), (ax + ao * da[0], ay + ao * da[1]),
                     (bx - bi * db[0], by - bi * db[1]), (bx, by)))
    return segs


def pen_stroke(p: Params, segs, step=3.0, ext=70.0):
    """Offset a centreline with a vertical-stress nib.  Ends are extended by
    `ext` along the tangent so that terminals can be cut afterwards."""
    samples = []
    for i, s in enumerate(segs):
        approx = sum(math.dist(s[j], s[j + 1]) for j in range(3))
        n = max(8, int(approx / step))
        for k in range(0 if i == 0 else 1, n + 1):
            samples.append(_cubic(*s, k / n))

    def width(dx, dy):
        L = math.hypot(dx, dy) or 1.0
        return p.HAIR + (p.ROUND - p.HAIR) * abs(dy / L) ** p.PEN_K

    def unit(dx, dy):
        L = math.hypot(dx, dy) or 1.0
        return dx / L, dy / L

    x, y, dx, dy = samples[0]
    ux, uy = unit(dx, dy)
    head = [(x - ux * ext, y - uy * ext, dx, dy)]
    x, y, dx, dy = samples[-1]
    ux, uy = unit(dx, dy)
    tail = [(x + ux * ext, y + uy * ext, dx, dy)]
    left, right = [], []
    for x, y, dx, dy in head + samples + tail:
        ux, uy = unit(dx, dy)
        w = width(dx, dy) / 2
        left.append((x - uy * w, y + ux * w))
        right.append((x + uy * w, y - ux * w))
    path = poly(left + right[::-1])
    path.simplify(fix_winding=True)
    return path


# --------------------------------------------------------------------------
# Glyphs.  Each returns (path, ink_width); ink starts at x = 0.
# --------------------------------------------------------------------------
def g_I(p):
    s, we = flared_stem(p, 0, 0, p.H, p.STEM)
    return s.transform(1, 0, 0, 1, we / 2, 0), we


def g_L(p):
    w = 500 * p.WIDTH
    s, we = flared_stem(p, 0, 0, p.H, p.STEM)
    s = s.transform(1, 0, 0, 1, we / 2, 0)
    return union(s, arm(p, we / 2, w, 0, p.ARM * 1.06)), w


def g_E(p):
    w = 520 * p.WIDTH
    s, we = flared_stem(p, 0, 0, p.H, p.STEM)
    s = s.transform(1, 0, 0, 1, we / 2, 0)
    a = p.ARM
    top = arm(p, we / 2, w * 0.95, p.H - a, p.H)
    mid_y = p.H * 0.515                       # optical centre, a touch high
    mid = arm(p, we / 2, w * 0.86, mid_y - a * 0.48, mid_y + a * 0.48)
    bot = arm(p, we / 2, w, 0, a * 1.06)
    return union(s, top, mid, bot), w


def g_T(p):
    w = 700 * p.WIDTH
    bar = arm(p, 0, w, p.H - p.ARM * 1.04, p.H, cut_left=True, cut_right=True)
    s, _ = flared_stem(p, w / 2, 0, p.H - 10, p.STEM)
    return union(bar, s), w


def g_H(p):
    w = 760 * p.WIDTH
    s1, we = flared_stem(p, 0, 0, p.H, p.STEM)
    s1 = s1.transform(1, 0, 0, 1, we / 2, 0)
    s2, _ = flared_stem(p, w - we / 2, 0, p.H, p.STEM)
    yb = p.H * 0.505
    bar = rect(we / 2, yb - p.ARM / 2, w - we / 2, yb + p.ARM / 2)
    return union(s1, s2, bar), w


def g_N(p):
    w = 790 * p.WIDTH
    t = p.THIN
    # diagonal: top-left to bottom-right; horizontal width from perpendicular
    run, rise = w - t, p.H
    theta = math.atan2(run, rise)              # angle from vertical
    dh = p.DIAG / math.cos(theta)              # horizontal thickness
    diag = poly([(0, p.H), (dh, p.H), (w, 0), (w - dh, 0)])
    l = rect(0, 0, t, p.H)
    r = rect(w - t, 0, w, p.H)
    return union(diag, l, r), w


def g_O(p, w=900):
    w *= p.WIDTH
    outer, inner = contrast_ring(p, 0, w, -p.OV, p.H + p.OV)
    return diff(outer, inner), w


def g_Q(p, w=900):
    """Pillar Q: lower-right quarter of the bowl becomes a vertical pillar
    that drops below the baseline; its foot takes the forward cut."""
    w *= p.WIDTH
    outer, inner = contrast_ring(p, 0, w, -p.OV, p.H + p.OV)
    pw = p.ROUND
    ym = p.H / 2
    foot_t = math.tan(math.radians(90 - p.CUT_DEG - 45))   # foot slope
    pillar = poly([(w - pw, ym), (w, ym), (w, -p.DESC),
                   (w - pw, -p.DESC + pw * foot_t)])
    body = union(outer, pillar)
    return diff(body, inner), w


def g_C(p, w=820):
    w *= p.WIDTH
    outer, inner = contrast_ring(p, 0, w, -p.OV, p.H + p.OV)
    ring = diff(outer, inner)
    cut = half_plane(w * 0.80, p.H / 2, p.CUT_DEG, keep="left")
    return inter(ring, cut), w


def g_G(p, w=860):
    """C bowl whose lower-right quarter straightens into a jaw (Q's sibling)."""
    w *= p.WIDTH
    outer, inner = contrast_ring(p, 0, w, -p.OV, p.H + p.OV)
    ring = diff(outer, inner)
    jaw_top = p.H * 0.47
    cut = union(half_plane(w * 0.79, p.H / 2, p.CUT_DEG, keep="left"),
                rect(0, -2 * p.H, 2 * w, jaw_top - p.ARM))
    upper = inter(ring, cut)
    pw = p.ROUND * 0.96
    jaw = rect(w - pw, p.H * 0.12, w, jaw_top)
    bar = arm(p, w * 0.56, w, jaw_top - p.ARM, jaw_top, cut_left=True,
              cut_right=False)
    lower_fill = inter(outer, rect(w - pw, -p.OV, w, jaw_top))
    lower_fill = diff(lower_fill, inner)
    return union(upper, jaw, bar, lower_fill), w


def g_D(p, w=820):
    w *= p.WIDTH
    s, we = flared_stem(p, 0, 0, p.H, p.STEM, flare=0)
    cx = w * 0.40
    hair = p.HAIR * 1.08
    outer = union(rect(0, 0, cx, p.H),
                  inter(ellipse(cx, p.H / 2, w - cx, p.H / 2, p.K_OUT),
                        rect(cx, -1, w + 1, p.H + 1)))
    inner = union(rect(we, hair, cx, p.H - hair),
                  inter(ellipse(cx, p.H / 2, w - cx - p.ROUND, p.H / 2 - hair, p.K_IN),
                        rect(cx - 1, 0, w, p.H)))
    return diff(outer, inner), w


def g_U(p, w=750):
    w *= p.WIDTH
    t = p.THIN
    yc = p.H * 0.40                          # where straight sides meet bowl
    outer_e = ellipse(w / 2, yc, w / 2, yc + p.OV, p.K_OUT)
    inner_e = box_ellipse(p.STEM, p.HAIR * 1.05 - p.OV, w - t,
                          2 * yc - (p.HAIR * 1.05 - p.OV), p.K_IN)
    bowl = inter(diff(outer_e, inner_e), rect(-1, -p.OV - 1, w + 1, yc))
    left, _ = flared_stem(p, p.STEM / 2, yc - 2, p.H, p.STEM, flare=0)
    right = rect(w - t, yc - 2, w, p.H)
    return union(bowl, left, right), w


def g_S(p, w=540):
    w *= p.WIDTH
    H, OV, R, h = p.H, p.OV, p.ROUND, p.HAIR
    nodes = [
        (w * 0.905, H * 0.790, 100, 0, H * 0.105),
        (w * 0.505, H + OV - h / 2, 180, w * 0.245, w * 0.250),
        (w * 0.045 + R / 2, H * 0.735, 270, H * 0.140, H * 0.120),
        (w * 0.500, H * 0.500, -38, w * 0.250, w * 0.250),
        (w - R / 2, H * 0.255, 270, H * 0.130, H * 0.150),
        (w * 0.480, -OV + h / 2, 180, w * 0.270, w * 0.270),
        (w * 0.060, H * 0.215, 112, H * 0.110, 0),
    ]
    stroke = pen_stroke(p, hermite_chain(nodes))
    # forward cuts: slice away what lies beyond a forward-leaning line, only
    # inside the band of each terminal
    s = diff(stroke, cut_band(w * 0.995, H * 0.80, p.CUT_DEG, "right", H * 0.60, H * 2))
    s = diff(s, cut_band(w * 0.005, H * 0.20, p.CUT_DEG, "left", -H, H * 0.40))
    return s, w


GLYPHS = {"I": g_I, "L": g_L, "E": g_E, "T": g_T, "H": g_H, "N": g_N,
          "O": g_O, "Q": g_Q, "C": g_C, "G": g_G, "D": g_D, "U": g_U, "S": g_S}

# side-bearing multipliers of p.SB: (left, right)
SIDES = {
    "I": (1.00, 1.00), "L": (1.00, 0.30), "E": (1.00, 0.55), "T": (0.30, 0.30),
    "H": (1.00, 1.00), "N": (0.95, 0.95), "O": (0.62, 0.62), "Q": (0.62, 0.92),
    "C": (0.62, 0.55), "G": (0.62, 0.90), "D": (1.00, 0.62), "U": (0.95, 0.92),
    "S": (0.70, 0.70),
}
# pair adjustments in units of H (negative = tighter)
KERN = {"QU": -10, "OT": -18, "TE": -6, "ES": 4, "SD": 0, "DO": 0, "ON": 0,
        "NE": 0, "UO": 0, "TO": -18, "LO": -20, "EC": 0, "CH": 0, "HN": 0,
        "NO": 0, "OL": 0, "OG": 0, "GI": 0, "IE": 0}


# --------------------------------------------------------------------------
# Layout
# --------------------------------------------------------------------------
def glyph(ch, p):
    """Glyph normalised so its ink runs from x = 0 to the returned width."""
    path, _ = GLYPHS[ch](p)
    x0, _, x1, _ = path.bounds
    return path.transform(1, 0, 0, 1, -x0, 0), x1 - x0


def ink_bounds(path):
    return path.bounds  # (xmin, ymin, xmax, ymax)


def set_line(text, p, gap_extra=None, kern=True):
    """Place glyphs; returns union path (ink starts at x=0) and pieces."""
    track = p.TRACK if gap_extra is None else gap_extra
    x = 0.0
    parts = []
    prev = None
    for ch in text:
        path, w = glyph(ch, p)
        if prev is not None:
            gap = (SIDES[prev][1] + SIDES[ch][0]) * p.SB + track
            if kern:
                gap += KERN.get(prev + ch, 0)
            x += gap
        parts.append(path.transform(1, 0, 0, 1, x, 0))
        x += w
        prev = ch
    line = union(*parts)
    xmin = line.bounds[0]
    return line.transform(1, 0, 0, 1, -xmin, 0)


def set_justified(text, p, target_width):
    """Solve the tracking so that the ink width equals target_width."""
    lo, hi = -200.0, 6000.0
    for _ in range(60):
        mid = (lo + hi) / 2
        w = set_line(text, p, gap_extra=mid).bounds[2]
        lo, hi = (mid, hi) if w < target_width else (lo, mid)
    return set_line(text, p, gap_extra=(lo + hi) / 2), (lo + hi) / 2


def build_wordmark():
    """Returns (line1, line2) paths in line-1 units, y up, baseline1 = 0."""
    line1 = set_line("QUOTESDONE", DISPLAY)
    w1 = line1.bounds[2]
    s2 = LINE2_SCALE
    target = (w1 - OPTICAL_LEFT * 2) / s2
    line2, track2 = set_justified("TECHNOLOGIES", SMALL, target)
    y2_top = -LINE_GAP * DISPLAY.H
    line2 = line2.transform(s2, 0, 0, s2, OPTICAL_LEFT, y2_top - s2 * SMALL.H)
    return line1, line2, track2


def build_mark_glyph():
    path, w = g_Q(MARK)
    return path


# --------------------------------------------------------------------------
# SVG output
# --------------------------------------------------------------------------
def to_d(path: pathops.Path, s=1.0, tx=0.0, ty=0.0, nd=2) -> str:
    """Serialise with y flipped: X = x*s + tx, Y = ty - y*s."""
    def f(v):
        r = f"{round(v, nd):.{nd}f}".rstrip("0").rstrip(".")
        return "0" if r in ("-0", "") else r

    def pt(q):
        return f"{f(q[0] * s + tx)} {f(ty - q[1] * s)}"

    out = []
    for verb, pts in path.segments:
        if verb == "moveTo":
            out.append("M" + pt(pts[0]))
        elif verb == "lineTo":
            out.append("L" + pt(pts[0]))
        elif verb == "curveTo":
            out.append("C" + " ".join(pt(q) for q in pts))
        elif verb == "qCurveTo":
            # pathops emits TrueType-style quads; expand implied on-points
            cur = pts
            for i in range(len(cur) - 1):
                c = cur[i]
                if i < len(cur) - 2:
                    nxt = cur[i + 1]
                    end = ((c[0] + nxt[0]) / 2, (c[1] + nxt[1]) / 2)
                else:
                    end = cur[-1]
                out.append("Q" + pt(c) + " " + pt(end))
        elif verb in ("closePath", "endPath"):
            out.append("Z")
    return "".join(out)


def svg_doc(title, uid, w, h, layers, bg=None):
    """layers: list of (id_suffix, d, fill).  Pure <path>, ids prefixed."""
    body = []
    if bg:
        body.append(f'<path id="{uid}-bg" fill="{bg}" d="M0 0H{w:g}V{h:g}H0Z"/>')
    for suffix, d, fill in layers:
        body.append(f'<path id="{uid}-{suffix}" fill="{fill}" d="{d}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" '
            f'width="{w:g}" height="{h:g}" role="img" aria-labelledby="{uid}-title">'
            f'<title id="{uid}-title">{title}</title>' + "".join(body) + "</svg>\n")


ALLOWED_TAGS = {"svg", "title", "g", "path"}


def verify_svg(path: Path):
    text = path.read_text()
    root = ET.fromstring(text)
    ids = []
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        assert tag in ALLOWED_TAGS, f"{path.name}: tag <{tag}> not allowed"
        for k, v in el.attrib.items():
            assert "href" not in k, f"{path.name}: href found"
            assert k not in ("style", "font-family", "font-size", "class"), \
                f"{path.name}: attribute {k}"
            assert "url(" not in v, f"{path.name}: url() reference"
        if "id" in el.attrib:
            ids.append(el.attrib["id"])
    assert root.find("{http://www.w3.org/2000/svg}title") is not None, \
        f"{path.name}: missing <title>"
    assert len(ids) == len(set(ids)), f"{path.name}: duplicate ids"
    assert not re.search(r"<text|@font-face|<image|<use", text), path.name
    return len(ids)


# --------------------------------------------------------------------------
# Compositions
# --------------------------------------------------------------------------
def compose(line1, line2, scale, pad_x, pad_top):
    """Return (d1, d2, width, height) for the two-line wordmark."""
    b1, b2 = line1.bounds, line2.bounds
    top = max(b1[3], b2[3])
    bottom = min(b1[1], b2[1])
    w = b1[2] * scale + 2 * pad_x
    h = (top - bottom) * scale + 2 * pad_top
    ty = pad_top + top * scale
    return (to_d(line1, scale, pad_x, ty), to_d(line2, scale, pad_x, ty), w, h)


def write_all():
    line1, line2, track2 = build_wordmark()
    mark = build_mark_glyph()
    files = {}

    # ---- wordmark: scale so that cap height = 100 px in the SVG ----------
    S = 0.1
    pad = 0.30 * DISPLAY.H * S       # clear space baked in = 0.3 cap height
    d1, d2, W, Hh = compose(line1, line2, S, pad, pad)
    for name, fill, bg, title in [
        ("wordmark-light.svg", OBSIDIAN, None, "QUOTESDONE TECHNOLOGIES wordmark (for light backgrounds)"),
        ("wordmark-dark.svg", PORCELAIN, OBSIDIAN, "QUOTESDONE TECHNOLOGIES wordmark (on dark)"),
        ("wordmark-onecolour.svg", "#000000", None, "QUOTESDONE TECHNOLOGIES wordmark (one colour)"),
    ]:
        uid = "qdt-" + name.replace(".svg", "")
        files[name] = svg_doc(title, uid, round(W, 2), round(Hh, 2),
                              [("line1", d1, fill), ("line2", d2, fill)], bg)

    # ---- mark: 800 x 800, Q optically centred (bowl centred, pillar below)
    mb = mark.bounds
    bowl_h = MARK.H + 2 * MARK.OV
    ms = 520 / bowl_h
    mw = (mb[2] - mb[0]) * ms
    tx = (800 - mw) / 2 - mb[0] * ms
    ty = 400 + (MARK.H / 2) * ms + (MARK.DESC * ms) * 0.30  # lift for pillar
    md = to_d(mark, ms, tx, ty)
    files["mark.svg"] = svg_doc("QUOTESDONE TECHNOLOGIES mark", "qdt-mark",
                                800, 800, [("q", md, OBSIDIAN)])
    files["mark-tile.svg"] = svg_doc(
        "QUOTESDONE TECHNOLOGIES app tile", "qdt-tile", 800, 800,
        [("tile", rounded_rect_d(0, 0, 800, 800, 180), ULTRAVIOLET),
         ("q", md, PORCELAIN)])

    # ---- lockups -------------------------------------------------------
    for theme, fill, bg in [("light", OBSIDIAN, None), ("dark", PORCELAIN, OBSIDIAN)]:
        files[f"lockup-horizontal-{theme}.svg"] = horizontal_lockup(
            line1, line2, mark, fill, bg, theme)
        files[f"lockup-stacked-{theme}.svg"] = stacked_lockup(
            line1, line2, mark, fill, bg, theme)

    for name, text in files.items():
        (OUT / name).write_text(text)
    for name in files:
        verify_svg(OUT / name)
    return files, (line1, line2, mark, track2)


def rounded_rect_d(x, y, w, h, r):
    k = 0.5523 * r
    return (f"M{x + r} {y}H{x + w - r}C{x + w - r + k} {y} {x + w} {y + r - k} {x + w} {y + r}"
            f"V{y + h - r}C{x + w} {y + h - r + k} {x + w - r + k} {y + h} {x + w - r} {y + h}"
            f"H{x + r}C{x + r - k} {y + h} {x} {y + h - r + k} {x} {y + h - r}"
            f"V{y + r}C{x} {y + r - k} {x + r - k} {y} {x + r} {y}Z")


def horizontal_lockup(line1, line2, mark, fill, bg, theme):
    """Small Q mark | hairline rule | wordmark.  Mark = line-1+line-2 height."""
    S = 0.1
    b1, b2 = line1.bounds, line2.bounds
    top, bottom = b1[3], b2[1]
    block_h = top - bottom                       # wordmark block, line-1 units
    mb = mark.bounds
    m_scale = block_h * 0.78 / (mb[3] - mb[1])   # mark slightly smaller block
    gap = 0.55 * DISPLAY.H                       # mark - rule - wordmark gaps
    rule_w = DISPLAY.HAIR * 0.9
    pad = 0.30 * DISPLAY.H
    mw = (mb[2] - mb[0]) * m_scale
    x_mark = pad
    x_rule = x_mark + mw + gap
    x_word = x_rule + rule_w + gap
    W = (x_word + b1[2] + pad) * S
    Hh = (block_h + 2 * pad) * S
    ty = (pad + top) * S
    # vertical: centre mark's bowl on the cap height of line 1 + line 2 block
    m_mid = (mb[1] + mb[3]) / 2 * m_scale
    block_mid = (top + bottom) / 2
    mark_t = mark.transform(m_scale, 0, 0, m_scale, x_mark - mb[0] * m_scale,
                            block_mid - m_mid)
    rule = rect(x_rule, bottom, x_rule + rule_w, top)
    layers = [
        ("mark", to_d(mark_t, S, 0, ty), fill),
        ("rule", to_d(rule, S, 0, ty), fill),
        ("line1", to_d(line1, S, x_word * S, ty), fill),
        ("line2", to_d(line2, S, x_word * S, ty), fill),
    ]
    return svg_doc(f"QUOTESDONE TECHNOLOGIES horizontal lockup ({theme})",
                   f"qdt-lockh-{theme}", round(W, 2), round(Hh, 2), layers, bg)


def stacked_lockup(line1, line2, mark, fill, bg, theme):
    S = 0.1
    b1, b2 = line1.bounds, line2.bounds
    mb = mark.bounds
    m_scale = 1.15 * DISPLAY.H / (mb[3] - mb[1])
    pad = 0.30 * DISPLAY.H
    gap = 0.62 * DISPLAY.H
    mw = (mb[2] - mb[0]) * m_scale
    mh = (mb[3] - mb[1]) * m_scale
    W = (b1[2] + 2 * pad)
    top_word = pad + mh + gap + b1[3]            # distance from top to baseline1
    Hh = top_word - b2[1] + pad
    ty = top_word * S
    # mark centred on the wordmark's ink width, sitting above it
    mx = (W - mw) / 2 - mb[0] * m_scale
    my = (top_word - pad - mb[3] * m_scale)       # y-up offset relative to baseline1
    mark_t = mark.transform(m_scale, 0, 0, m_scale, mx, my)
    layers = [
        ("mark", to_d(mark_t, S, 0, ty), fill),
        ("line1", to_d(line1, S, pad * S, ty), fill),
        ("line2", to_d(line2, S, pad * S, ty), fill),
    ]
    return svg_doc(f"QUOTESDONE TECHNOLOGIES stacked lockup ({theme})",
                   f"qdt-locks-{theme}", round(W * S, 2), round(Hh * S, 2), layers, bg)


# --------------------------------------------------------------------------
# Preview
# --------------------------------------------------------------------------
def inline(svg_text, css_w=None, css_h=None):
    s = svg_text.strip()
    attrs = ""
    if css_w:
        attrs += f' style="width:{css_w};height:auto;display:block"'
    if css_h:
        attrs = f' style="height:{css_h};width:auto;display:block"'
    return re.sub(r'width="[^"]+" height="[^"]+"', attrs.strip() and attrs, s, count=1)


def preview_html(files):
    sv = files
    mark_inline = lambda h: inline(sv["mark.svg"], css_h=h)  # noqa: E731
    tile = lambda h: inline(sv["mark-tile.svg"], css_h=h)    # noqa: E731
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:1600px;background:{PORCELAIN};font:13px/1.4 'Inter',sans-serif;color:{GRAPHITE}}}
.panel{{padding:70px 90px;}}
.dark{{background:{OBSIDIAN};}}
.cap{{font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:22px}}
.dark .cap{{color:#8a8985}}
.row{{display:flex;gap:60px;align-items:center}}
.grid{{display:grid;grid-template-columns:1fr 1fr;}}
.cell{{padding:50px 70px;border-top:1px solid #dcdad4}}
.sign{{background:linear-gradient(#2a2a2a,#161616);padding:60px 80px;}}
.letter{{background:#fff;width:640px;height:300px;box-shadow:0 2px 14px rgba(0,0,0,.12);padding:42px 46px;position:relative}}
.letter .ln{{height:6px;background:#ebeae6;margin:9px 0;border-radius:3px}}
</style></head><body>
<div class="panel"><div class="cap">Wordmark, light</div>{inline(sv["wordmark-light.svg"], css_w="1420px")}</div>
<div class="panel dark"><div class="cap">Wordmark, dark</div>{inline(sv["wordmark-dark.svg"], css_w="1420px")}</div>
<div class="grid">
 <div class="cell"><div class="cap">One colour</div>{inline(sv["wordmark-onecolour.svg"], css_w="620px")}</div>
 <div class="cell"><div class="cap">Mark 512 / 32 / 16 px</div><div class="row">{mark_inline("512px").replace('display:block','display:block;width:300px;height:300px')}
   {mark_inline("32px")}{mark_inline("16px")}{tile("96px")}{tile("32px")}</div></div>
 <div class="cell"><div class="cap">Horizontal lockup</div>{inline(sv["lockup-horizontal-light.svg"], css_w="640px")}</div>
 <div class="cell"><div class="cap">Stacked lockup</div>{inline(sv["lockup-stacked-light.svg"], css_h="190px")}</div>
</div>
<div class="sign"><div class="cap" style="color:#8a8985">Signage line, back-lit fascia</div>{inline(sv["wordmark-dark.svg"].replace(OBSIDIAN, "#1b1b1b"), css_w="1100px")}</div>
<div class="grid">
 <div class="cell" style="background:#e9e7e1"><div class="cap">Letterhead corner</div>
  <div class="letter"><div style="width:240px">{inline(sv["lockup-horizontal-light.svg"], css_w="240px")}</div>
   <div style="margin-top:46px">{''.join('<div class="ln" style="width:%d%%"></div>' % w for w in (88, 92, 76, 90, 60))}</div></div></div>
 <div class="cell"><div class="cap">App-icon tile, 180 / 60 px</div><div class="row">{tile("180px")}{tile("60px")}
   <div>{inline(sv["lockup-horizontal-dark.svg"], css_w="420px")}</div></div></div>
</div>
<div class="panel" style="padding-top:30px;padding-bottom:30px"><div class="cap">Wordmark at 24 px cap height (actual pixels)</div>
 <div style="height:{24 * 1.0}px">{inline(sv["wordmark-light.svg"], css_h=str(round(24 * (1 + 0.6 + LINE_GAP + LINE2_SCALE) / 1.0 * 1.0, 1)) + "px")}</div></div>
</body></html>"""


def render_preview(files, checks_dir=None):
    from playwright.sync_api import sync_playwright
    html = preview_html(files)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        page = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        page.set_content(html)
        page.screenshot(path=str(OUT / "preview.png"), full_page=True)
        if checks_dir:
            write_checks(page, files, Path(checks_dir))
        b.close()


def write_checks(page, files, d: Path):
    """Zoom crops and true-size small renders for inspection (not shipped)."""
    d.mkdir(parents=True, exist_ok=True)
    for name, css in [("wordmark-light.svg", "width:3200px"),
                      ("mark.svg", "width:800px")]:
        svg = re.sub(r'width="[^"]+" height="[^"]+"', f'style="{css};display:block"',
                     files[name], count=1)
        page.set_viewport_size({"width": 3300, "height": 900})
        page.set_content(f"<body style='margin:20px;background:#fff'>{svg}</body>")
        page.screenshot(path=str(d / f"zoom-{name}.png"), full_page=True)
    # true small sizes, DPR 1: cap height 24/16 px; mark 32/16 px
    cap_ratio = None
    h1 = files["wordmark-light.svg"]
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', h1).group(1).split()]
    # cap height = 100 svg units in the wordmark file
    smalls = ""
    for cap in (40, 24, 16):
        hpx = vb[3] * cap / 100
        smalls += re.sub(r'width="[^"]+" height="[^"]+"',
                         f'style="height:{hpx:.2f}px;display:block;margin:8px"', h1, count=1)
    for px in (32, 16):
        smalls += re.sub(r'width="[^"]+" height="[^"]+"',
                         f'style="height:{px}px;display:inline-block;margin:8px"',
                         files["mark.svg"], count=1)
    page.set_viewport_size({"width": 700, "height": 300})
    page.set_content(f"<body style='margin:0;background:#fff'>{smalls}</body>")
    page.screenshot(path=str(d / "small-dpr1.png"), full_page=True)
    try:
        from PIL import Image
        im = Image.open(d / "small-dpr1.png")
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(d / "small-dpr1-x4.png")
    except ImportError:
        pass
    _ = cap_ratio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checks", help="directory for zoom crops (not shipped)")
    ap.add_argument("--no-preview", action="store_true")
    a = ap.parse_args()
    files, (l1, l2, mark, track2) = write_all()
    print(f"line1 ink width {l1.bounds[2]:.0f} u, line2 tracking {track2:.0f} u "
          f"(in its own units), files: {len(files)}")
    if not a.no_preview:
        render_preview(files, a.checks)
    for f in sorted(OUT.glob("*.svg")):
        print(f"  {f.name:32s} {f.stat().st_size / 1024:6.1f} KB  ok")


if __name__ == "__main__":
    sys.exit(main())
