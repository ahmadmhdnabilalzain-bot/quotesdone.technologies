#!/usr/bin/env python3
"""
QUOTESDONE TECHNOLOGIES - concept R2-1 "Monolith"
=================================================

Generator for every file in this folder. All letterforms are drawn here from
rectangles (stems, bars) and elliptical quarter-arcs, combined with real boolean
operations (skia-pathops), and written out as outlined SVG <path> data.
No font is used anywhere, not even as a skeleton.

Construction system (font units, cap height H = 1000, y up, baseline 0):
  * one radius: every round is a stadium end or corner of outer radius H/2
  * counters are concentric ellipses, so the curve thins from the stem weight S
    on the sides to the bar weight h at top and bottom (true stress modulation)
  * ownable move 1, the SILL: the Q has no diagonal tail. Its bottom-right
    corner is squared off and runs out to the right as a flat foundation bar
    on the baseline, tucking under the round foot of the U.
  * ownable move 2, the LINTEL: the T's crossbar continues as one beam into
    the top arm of the E (T and E share a lintel).

Run:  python3 build.py            (writes SVGs, verifies them, renders preview.png)
      python3 build.py --no-png   (SVGs only)
"""
from __future__ import annotations

import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path as FsPath

import pathops

HERE = FsPath(__file__).resolve().parent
K = 0.5522847498  # cubic approximation constant for a quarter ellipse

# --------------------------------------------------------------------------
# Parameters (edit these)
# --------------------------------------------------------------------------
H = 1000.0  # cap height in font units (both lines are drawn at this, then scaled)

# Line 1: QUOTESDONE
MAIN = dict(
    S=168.0,  # vertical stem weight
    h=142.0,  # horizontal bar weight (thinner than S for optical balance)
    os=8.0,  # overshoot of stadium rounds above cap height / below baseline
    sp=150.0,  # base spacing unit: gap contributed by a straight side
    round_side=0.52,  # fraction of sp applied next to a round side
    open_side=0.10,  # fraction of sp applied next to an open side (T arms)
    widths=dict(Q=1500, U=1250, O=1500, T=1180, E=1040, S=1190, D=1320, N=1250),
    s_rx=1.30,  # S bowls: horizontal stretch of their arcs (1 = circular)
    sill_ext=150.0,  # how far the Q's sill runs past the bowl
    lintel=True,  # join T crossbar to E top arm
)

# Line 2: TECHNOLOGIES (its own, lighter, drawing; tracking is solved in code)
SUB = dict(
    S=150.0,
    h=134.0,
    os=6.0,
    sp=0.0,  # unused: the line is justified
    round_side=0.0,
    open_side=0.0,
    widths=dict(T=1240, E=1100, C=1560, H=1340, N=1340, O=1600, L=1080, G=1600, I=150, S=1260),
    s_rx=1.30,
    sill_ext=0.0,
    lintel=False,
)

SUB_CAP_RATIO = 0.40  # line 2 cap height as a fraction of line 1 cap height
LINE_GAP_RATIO = 0.36  # gap between lines, fraction of line 1 cap height

# Kerning, in font units of line 1 (negative = tighter)
KERN = {
    ("Q", "U"): -110.0,  # sill tucks under the U's round foot
    ("T", "E"): -30.0,
    ("E", "S"): 0.0,
    ("S", "D"): 10.0,
    ("D", "O"): 0.0,
    ("O", "N"): 0.0,
    ("N", "E"): 0.0,
    ("U", "O"): 0.0,
    ("O", "T"): 0.0,
}

# Palette
BASALT = "#1D1C1A"  # warm near-black: primary ink
LIMESTONE = "#ECE8E0"  # warm stone: paper / ink on dark
AUBERGINE = "#5A2F4E"  # accent: mark tile, rules, app icon
AUBERGINE_LIGHT = "#B98AA8"  # accent tint for use on Basalt
STONE_GREY = "#7A746C"  # neutral for captions only


# --------------------------------------------------------------------------
# Geometry primitives
# --------------------------------------------------------------------------
def rect(x0, y0, x1, y1) -> pathops.Path:
    p = pathops.Path()
    p.moveTo(x0, y0)
    p.lineTo(x1, y0)
    p.lineTo(x1, y1)
    p.lineTo(x0, y1)
    p.close()
    return p


def poly(points) -> pathops.Path:
    p = pathops.Path()
    p.moveTo(*points[0])
    for pt in points[1:]:
        p.lineTo(*pt)
    p.close()
    return p


def rrect(x0, y0, x1, y1, rx, ry, corners="tl tr bl br") -> pathops.Path:
    """Rectangle whose listed corners are elliptical quarter arcs (rx, ry)."""
    c = set(corners.split())
    bl, br, tr, tl = ("bl" in c), ("br" in c), ("tr" in c), ("tl" in c)
    p = pathops.Path()
    p.moveTo(x0 + (rx if bl else 0), y0)
    p.lineTo(x1 - (rx if br else 0), y0)
    if br:
        p.cubicTo(x1 - rx + K * rx, y0, x1, y0 + ry - K * ry, x1, y0 + ry)
    p.lineTo(x1, y1 - (ry if tr else 0))
    if tr:
        p.cubicTo(x1, y1 - ry + K * ry, x1 - rx + K * rx, y1, x1 - rx, y1)
    p.lineTo(x0 + (rx if tl else 0), y1)
    if tl:
        p.cubicTo(x0 + rx - K * rx, y1, x0, y1 - ry + K * ry, x0, y1 - ry)
    p.lineTo(x0, y0 + (ry if bl else 0))
    if bl:
        p.cubicTo(x0, y0 + ry - K * ry, x0 + rx - K * rx, y0, x0 + rx, y0)
    p.close()
    return p


def union(*paths) -> pathops.Path:
    out = pathops.Path()
    for p in paths:
        out = pathops.op(out, p, pathops.PathOp.UNION)
    return out


def minus(a, *bs) -> pathops.Path:
    for b in bs:
        a = pathops.op(a, b, pathops.PathOp.DIFFERENCE)
    return a


def moved(p: pathops.Path, dx=0.0, dy=0.0, sx=1.0, sy=1.0) -> pathops.Path:
    out = pathops.Path()
    p.transform(sx, 0, 0, sy, dx, dy).draw(out.getPen())
    return out


# --------------------------------------------------------------------------
# Glyphs. Each returns (outline, width, left_side, right_side)
# side types: "straight", "round", "open"
# --------------------------------------------------------------------------
def stadium_ring(W, P):
    """The O: outer stadium of radius H/2 (+overshoot), elliptical counter."""
    S, h, os = P["S"], P["h"], P["os"]
    R = (H + 2 * os) / 2
    outer = rrect(0, -os, W, H + os, R, R)
    inner = rrect(S, -os + h, W - S, H + os - h, R - S, R - h)
    return outer, inner


def g_O(P):
    W = P["widths"]["O"]
    outer, inner = stadium_ring(W, P)
    return minus(outer, inner), W, "round", "round"


def g_Q(P):
    """Q with the SILL: bottom-right corner squared and extended as a bar."""
    W = P["widths"]["Q"]
    S, h, os = P["S"], P["h"], P["os"]
    R = (H + 2 * os) / 2
    # bowl: the stadium with its bottom-right corner squared (a speech-bubble
    # corner); the counter keeps its pure elliptical shape
    outer = rrect(0, -os, W, H + os, R, R, "tl tr bl")
    inner = rrect(S, -os + h, W - S, H + os - h, R - S, R - h)
    # the sill: the bowl's floor running on past the bowl, flush with baseline
    sill = rect(W - R, -os, W + P["sill_ext"], -os + h)
    shape = minus(union(outer, sill), inner)
    return shape, W + P["sill_ext"], "round", "open"


def g_U(P):
    W = P["widths"]["U"]
    S, h, os = P["S"], P["h"], P["os"]
    R = (H + 2 * os) / 2
    outer = rrect(0, -os, W, H, R, R, "bl br")
    inner = rrect(S, -os + h, W - S, H + 500, R - S, R - h, "bl br")
    return minus(outer, inner), W, "straight", "straight"


def g_D(P):
    W = P["widths"]["D"]
    S, h, os = P["S"], P["h"], P["os"]
    R = H / 2
    outer = rrect(0, 0, W, H, R, R, "tr br")
    inner = rrect(S, h, W - S, H - h, R - S, R - h, "tr br")
    return minus(outer, inner), W, "straight", "round"


def g_T(P):
    W = P["widths"]["T"]
    S, h = P["S"], P["h"]
    x = (W - S) / 2
    return union(rect(0, H - h, W, H), rect(x, 0, x + S, H)), W, "open", "open"


def g_E(P):
    W = P["widths"]["E"]
    S, h = P["S"], P["h"]
    mid = 0.515 * H  # optical middle sits slightly high
    hm = h * 0.96
    shape = union(
        rect(0, 0, S, H),
        rect(0, H - h, W - 0.015 * W, H),  # top arm a touch shorter
        rect(0, mid - hm / 2, W * 0.90, mid + hm / 2),  # middle arm shorter still
        rect(0, 0, W, h),  # bottom arm the longest: stability
    )
    return shape, W, "straight", "open"


def g_L(P):
    W = P["widths"]["L"]
    S, h = P["S"], P["h"]
    return union(rect(0, 0, S, H), rect(0, 0, W, h)), W, "straight", "open"


def g_I(P):
    S = P["S"]
    return rect(0, 0, S, H), S, "straight", "straight"


def g_H(P):
    W = P["widths"]["H"]
    S, h = P["S"], P["h"]
    mid = 0.515 * H
    shape = union(rect(0, 0, S, H), rect(W - S, 0, W, H), rect(0, mid - h / 2, W, mid + h / 2))
    return shape, W, "straight", "straight"


def g_N(P):
    W = P["widths"]["N"]
    S, h = P["S"], P["h"]
    st = S * 0.94  # N stems slightly lighter: the diagonal adds colour
    # horizontal width of the diagonal so its perpendicular weight ~ 0.98 S
    dx = 0.98 * S * math.hypot(W - st, H) / H
    diag = poly([(0, H), (dx, H), (W, 0), (W - dx, 0)])
    shape = union(rect(0, 0, st, H), rect(W - st, 0, W, H), diag)
    shape = pathops.op(shape, rect(0, 0, W, H), pathops.PathOp.INTERSECTION)
    return shape, W, "straight", "straight"


def g_S(P):
    """Two stacked half-stadiums joined by a shared middle bar."""
    W = P["widths"]["S"]
    S, h, os = P["S"], P["h"], P["os"]
    ym = 0.522 * H  # centre of middle bar: upper bowl a little smaller
    hm = h * 0.94  # spine slightly lighter
    top, bot = H + os * 0.5, -os * 0.5
    inset = 0.025 * W  # upper bowl narrower than the lower one
    t_end = W - 0.035 * W  # top terminal
    b_start = 0.0  # bottom terminal
    # upper bowl (open to the right)
    Ru = (top - (ym - hm / 2)) / 2
    up_o = rrect(inset, ym - hm / 2, t_end, top, Ru * P["s_rx"], Ru, "tl bl")
    up_i = rrect(inset + S, ym + hm / 2, W + 10, top - h, Ru * P["s_rx"] - S, (top - h - ym - hm / 2) / 2, "tl bl")
    upper = minus(up_o, up_i)
    # lower bowl (open to the left)
    Rl = ((ym + hm / 2) - bot) / 2
    lo_o = rrect(b_start, bot, W, ym + hm / 2, Rl * P["s_rx"], Rl, "tr br")
    lo_i = rrect(-10, bot + h, W - S, ym - hm / 2, Rl * P["s_rx"] - S, (ym - hm / 2 - bot - h) / 2, "tr br")
    lower = minus(lo_o, lo_i)
    # the two bowls overlap along the spine; clip the upper spine where it
    # would poke past the lower bowl's outer curve and vice versa
    # the spine: left part belongs to the upper bowl, right part to the lower;
    # trim each so neither sticks out past the other bowl's curve
    band = (ym - hm / 2 - 1, ym + hm / 2 + 1)
    upper = minus(upper, rect(W - Rl * P["s_rx"], band[0], W + 50, band[1]))
    lower = minus(lower, rect(-50, band[0], inset + Ru * P["s_rx"], band[1]))
    shape = union(upper, lower)
    return shape, W, "round", "round"


def _c_base(P, W):
    S, h, os = P["S"], P["h"], P["os"]
    outer, inner = stadium_ring(W, P)
    return minus(outer, inner), (H + 2 * os) / 2


def g_C(P):
    W = P["widths"]["C"]
    ring, R = _c_base(P, W)
    ap = 0.40 * H  # aperture height
    cut = rect(W - R * 0.62, H / 2 - ap / 2, W + 20, H / 2 + ap / 2)
    return minus(ring, cut), W, "round", "open"


def g_G(P):
    W = P["widths"]["G"]
    S, h = P["S"], P["h"]
    ring, R = _c_base(P, W)
    mid = 0.50 * H
    cut = rect(W - R * 0.62, mid + h / 2, W + 20, mid + 0.20 * H + h / 2)
    bar = rect(W * 0.60, mid - h / 2, W - S * 0.5, mid + h / 2)
    side = rect(W - S, -5, W, mid + h / 2)  # straight right side below the bar
    body = union(minus(ring, cut), bar)
    body = union(body, pathops.op(side, rrect(0, -P["os"], W, H + P["os"], R, R), pathops.PathOp.INTERSECTION))
    return body, W, "round", "round"


GLYPHS = dict(Q=g_Q, U=g_U, O=g_O, T=g_T, E=g_E, S=g_S, D=g_D, N=g_N, C=g_C, H=g_H, L=g_L, G=g_G, I=g_I)


# --------------------------------------------------------------------------
# Layout
# --------------------------------------------------------------------------
def side_gap(kind, P):
    return {"straight": 1.0, "round": P["round_side"], "open": P["open_side"]}[kind] * P["sp"]


def set_main(text="QUOTESDONE", P=MAIN):
    """Returns (outline, width, positions) for line 1, with ligature joins."""
    x = 0.0
    out = pathops.Path()
    pos = {}
    prev = None
    for i, ch in enumerate(text):
        shape, W, ls, rs = GLYPHS[ch](P)
        if prev is not None:
            pch, prs = prev
            x += side_gap(prs, P) + side_gap(ls, P) + KERN.get((pch, ch), 0.0)
        pos[i] = (ch, x, W)
        out = union(out, moved(shape, dx=x))
        x += W
        prev = (ch, rs)
    # LINTEL: bridge the T crossbar into the E top arm
    if P["lintel"]:
        for i in range(len(text) - 1):
            if text[i] == "T" and text[i + 1] == "E":
                _, tx, tw = pos[i]
                _, ex, _ = pos[i + 1]
                out = union(out, rect(tx + tw - 1, H - P["h"], ex + 1, H))
    return out, x, pos


def set_justified(text, P, target_width, left_inset=0.0, right_inset=0.0):
    """Line 2: equal gaps between glyph boxes so the line spans target_width."""
    shapes = [GLYPHS[c](P) for c in text]
    total = sum(s[1] for s in shapes)
    gap = (target_width - left_inset - right_inset - total) / (len(text) - 1)
    out = pathops.Path()
    x = left_inset
    for shape, W, _, _ in shapes:
        out = union(out, moved(shape, dx=x))
        x += W + gap
    return out, gap


# --------------------------------------------------------------------------
# SVG writing + verification
# --------------------------------------------------------------------------
def to_d(p: pathops.Path, sx, tx, ty, nd=2) -> str:
    """Font units (y up) -> SVG user units (y down)."""
    f = lambda v: f"{round(v, nd):g}"
    pt = lambda x, y: f"{f(x * sx + tx)} {f(ty - y * sx)}"
    parts = []
    for verb, pts in p.segments:
        if verb == "moveTo":
            parts.append("M" + pt(*pts[0]))
        elif verb == "lineTo":
            parts.append("L" + pt(*pts[0]))
        elif verb == "curveTo":
            parts.append("C" + " ".join(pt(*q) for q in pts))
        elif verb == "qCurveTo":
            parts.append("Q" + " ".join(pt(*q) for q in pts))
        elif verb == "closePath":
            parts.append("Z")
    return "".join(parts)


def bounds(p):
    return p.bounds  # (xmin, ymin, xmax, ymax)


def svg_doc(name, title, w, h, layers, bg=None):
    """layers: list of (id_suffix, fill, d). Background, if any, is a path."""
    ids = []
    body = []
    if bg:
        body.append(f'<path id="{name}-bg" fill="{bg}" d="M0 0H{w:g}V{h:g}H0Z"/>')
    for suffix, fill, d in layers:
        pid = f"{name}-{suffix}"
        ids.append(pid)
        body.append(f'<path id="{pid}" fill="{fill}" d="{d}"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
        f'role="img" aria-labelledby="{name}-title">'
        f'<title id="{name}-title">{title}</title>' + "".join(body) + "</svg>\n"
    )


ALLOWED = {"svg", "title", "path", "g"}


def verify_svg(path: FsPath):
    tree = ET.parse(path)
    ids = []
    for el in tree.iter():
        tag = el.tag.split("}")[-1]
        assert tag in ALLOWED, f"{path.name}: disallowed element <{tag}>"
        for k in el.attrib:
            kl = k.split("}")[-1].lower()
            assert kl not in ("href", "style", "font-family", "font", "class"), f"{path.name}: attribute {k}"
            assert "url(" not in el.attrib[k], f"{path.name}: external ref"
        if "id" in el.attrib:
            ids.append(el.attrib["id"])
    root = tree.getroot()
    assert any(e.tag.endswith("title") for e in root), f"{path.name}: no <title>"
    assert len(ids) == len(set(ids)), f"{path.name}: duplicate ids"
    return len(ids)


# --------------------------------------------------------------------------
# Composition
# --------------------------------------------------------------------------
def build_geometry():
    main, main_w, pos = set_main()
    mb = bounds(main)
    # optical edges of line 1: Q's round left edge reads ~1% inside its box
    left_opt = mb[0] + 0.012 * H
    right_opt = mb[2]
    sub_scale = SUB_CAP_RATIO
    target = (right_opt - left_opt) / sub_scale
    sub, gap = set_justified("TECHNOLOGIES", SUB, target)
    return dict(main=main, mb=mb, pos=pos, sub=sub, sub_scale=sub_scale, left_opt=left_opt, sub_gap=gap)


def write_all():
    G = build_geometry()
    main, mb = G["main"], G["mb"]
    files = []
    pad = 0.5 * H  # clear space used inside the artboards (= half cap height)

    # ---- wordmark (QUOTESDONE only) ----
    ww = (mb[2] - mb[0]) + 2 * pad
    wh = (mb[3] - mb[1]) + 2 * pad
    sx = 0.1  # 1 font unit = 0.1 px in the SVG
    tx, ty = (pad - mb[0]) * sx, (pad + mb[3]) * sx
    d_main = to_d(main, sx, tx, ty)
    for fname, title, fg, bg in [
        ("wordmark-light.svg", "QUOTESDONE wordmark, Basalt on Limestone", BASALT, LIMESTONE),
        ("wordmark-dark.svg", "QUOTESDONE wordmark, Limestone on Basalt", LIMESTONE, BASALT),
        ("wordmark-onecolour.svg", "QUOTESDONE wordmark, one colour, transparent", "#000000", None),
    ]:
        name = fname[:-4]
        (HERE / fname).write_text(svg_doc(name, title, ww * sx, wh * sx, [("q", fg, d_main)], bg))
        files.append(fname)

    # ---- stacked lockup ----
    ss = G["sub_scale"]
    sub = moved(G["sub"], dx=G["left_opt"], sy=ss, sx=ss)
    gap = LINE_GAP_RATIO * H
    sub = moved(sub, dy=mb[1] - gap - H * ss)
    sb = bounds(sub)
    xmin, xmax = min(mb[0], sb[0]), max(mb[2], sb[2])
    ymin, ymax = min(mb[1], sb[1]), mb[3]
    lw, lh = (xmax - xmin) + 2 * pad, (ymax - ymin) + 2 * pad
    tx, ty = (pad - xmin) * sx, (pad + ymax) * sx
    d1, d2 = to_d(main, sx, tx, ty), to_d(sub, sx, tx, ty)
    for fname, title, fg, bg in [
        ("lockup-stacked-light.svg", "QUOTESDONE TECHNOLOGIES stacked lockup, light", BASALT, LIMESTONE),
        ("lockup-stacked-dark.svg", "QUOTESDONE TECHNOLOGIES stacked lockup, dark", LIMESTONE, BASALT),
        ("lockup-stacked-onecolour.svg", "QUOTESDONE TECHNOLOGIES stacked lockup, one colour", "#000000", None),
    ]:
        name = fname[:-4]
        (HERE / fname).write_text(svg_doc(name, title, lw * sx, lh * sx, [("l1", fg, d1), ("l2", fg, d2)], bg))
        files.append(fname)

    # ---- mark (800 x 800) ----
    mark_shape, mark_fg_note = build_mark()
    mbx = bounds(mark_shape)
    msize = 800.0
    # fit mark so its larger side is 62% of the tile
    span = max(mbx[2] - mbx[0], mbx[3] - mbx[1])
    msx = msize * 0.62 / span
    mtx = (msize - (mbx[2] - mbx[0]) * msx) / 2 - mbx[0] * msx
    mty = (msize - (mbx[3] - mbx[1]) * msx) / 2 + mbx[3] * msx
    d_mark = to_d(mark_shape, msx, mtx, mty)
    (HERE / "mark.svg").write_text(
        svg_doc("mark", "QUOTESDONE TECHNOLOGIES mark, Limestone on Aubergine", msize, msize,
                [("glyph", LIMESTONE, d_mark)], AUBERGINE)
    )
    (HERE / "mark-onecolour.svg").write_text(
        svg_doc("mark-onecolour", "QUOTESDONE TECHNOLOGIES mark, one colour", msize, msize,
                [("glyph", "#000000", d_mark)], None)
    )
    files += ["mark.svg", "mark-onecolour.svg"]

    # ---- horizontal lockup: mark + stacked lockup ----
    # mark height = height of the two-line block; separated by a rule-free gap
    block_h = ymax - ymin
    mk = moved(mark_shape, dx=-mbx[0], dy=-mbx[1])
    mk_scale = block_h / (mbx[3] - mbx[1])
    mk = moved(mk, sx=mk_scale, sy=mk_scale)
    mk = moved(mk, dx=xmin, dy=ymin)
    mkb = bounds(mk)
    shift = (mkb[2] - mkb[0]) + 0.62 * H  # gap between mark and type
    m1, m2 = moved(main, dx=shift), moved(sub, dx=shift)
    hx0, hx1 = mkb[0], xmax + shift
    hw, hh = (hx1 - hx0) + 2 * pad, block_h + 2 * pad
    tx, ty = (pad - hx0) * sx, (pad + ymax) * sx
    for fname, title, fg, acc, bg in [
        ("lockup-horizontal-light.svg", "QUOTESDONE TECHNOLOGIES horizontal lockup, light", BASALT, AUBERGINE, LIMESTONE),
        ("lockup-horizontal-dark.svg", "QUOTESDONE TECHNOLOGIES horizontal lockup, dark", LIMESTONE, AUBERGINE_LIGHT, BASALT),
        ("lockup-horizontal-onecolour.svg", "QUOTESDONE TECHNOLOGIES horizontal lockup, one colour", "#000000", "#000000", None),
    ]:
        name = fname[:-4]
        layers = [("mark", acc, to_d(mk, sx, tx, ty)), ("l1", fg, to_d(m1, sx, tx, ty)), ("l2", fg, to_d(m2, sx, tx, ty))]
        (HERE / fname).write_text(svg_doc(name, title, hw * sx, hh * sx, layers, bg))
        files.append(fname)

    n = 0
    for f in files:
        n += verify_svg(HERE / f)
    print(f"wrote + verified {len(files)} SVGs ({n} ids), line-2 gap {G['sub_gap']:.0f} u")
    return files, G


def build_mark():
    """The mark is the Q alone, drawn with the wordmark's own geometry,
    narrowed to a near-square bowl so it sits in a tile; the sill stays."""
    P = dict(MAIN)
    P["widths"] = dict(MAIN["widths"], Q=1180)
    P["sill_ext"] = 190.0
    shape, *_ = g_Q(P)
    return shape, "Q"


# --------------------------------------------------------------------------
# Preview
# --------------------------------------------------------------------------
def svg_inline(fname):
    s = (HERE / fname).read_text()
    return s


def render_preview():
    import base64

    from playwright.sync_api import sync_playwright

    def uri_text(t):
        return "data:image/svg+xml;base64," + base64.b64encode(t.encode()).decode()

    def uri(f):
        return "data:image/svg+xml;base64," + base64.b64encode((HERE / f).read_bytes()).decode()

    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
    body{{margin:0;background:#D9D4CB;font:14px/1.4 -apple-system,system-ui,sans-serif;color:{BASALT}}}
    .p{{padding:40px 56px}} .l{{background:{LIMESTONE}}} .d{{background:{BASALT}}}
    img{{display:block}} .cap{{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:{STONE_GREY};margin:0 0 14px}}
    .row{{display:flex;gap:40px;align-items:flex-end}}
    .sign{{background:linear-gradient(#2a2826,#151413);padding:70px 60px;position:relative}}
    .sign:before{{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 120px)}}
    .letter{{background:#fff;width:560px;height:300px;position:relative;box-shadow:0 1px 4px rgba(0,0,0,.15)}}
    .tile{{width:180px;height:180px;border-radius:40px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.25)}}
    .tile img{{width:180px;height:180px}}
    .px{{image-rendering:pixelated}}
    </style></head><body>
    <div class="p l"><p class="cap">Wordmark, light</p><img src="{uri('wordmark-light.svg')}" style="width:1480px"></div>
    <div class="p d"><p class="cap">Wordmark, dark</p><img src="{uri('wordmark-dark.svg')}" style="width:1480px"></div>
    <div class="p l"><div class="row">
      <div><p class="cap">Stacked lockup, light</p><img src="{uri('lockup-stacked-light.svg')}" style="width:700px"></div>
      <div><p class="cap">One colour</p><img src="{uri('lockup-stacked-onecolour.svg')}" style="width:700px"></div>
    </div></div>
    <div class="p d"><p class="cap">Horizontal lockup with mark, dark</p><img src="{uri('lockup-horizontal-dark.svg')}" style="width:1100px"></div>
    <div class="p l"><p class="cap">Horizontal lockup with mark, light</p><img src="{uri('lockup-horizontal-light.svg')}" style="width:1100px"></div>
    <div class="p l"><p class="cap">Mark at 512 / 32 / 16 px (and 16 px enlarged x6)</p><div class="row">
      <img src="{uri('mark.svg')}" style="width:512px;height:512px">
      <img src="{uri('mark.svg')}" style="width:32px;height:32px">
      <img src="{uri('mark.svg')}" style="width:16px;height:16px">
      <canvas id="c16" width="16" height="16" class="px" style="width:96px;height:96px"></canvas>
      <canvas id="c32" width="32" height="32" class="px" style="width:96px;height:96px"></canvas>
    </div></div>
    <div class="sign"><p class="cap" style="color:#8d867c;position:relative">Signage line, tower crown (dark, lit)</p>
      <img src="{uri('wordmark-dark.svg')}" style="width:1480px;position:relative;filter:drop-shadow(0 0 6px rgba(236,232,224,.35))"></div>
    <div class="p" style="background:#CFC9BF"><div class="row">
      <div><p class="cap">Letterhead corner</p><div class="letter">
        <img src="{uri_text((HERE / 'lockup-stacked-onecolour.svg').read_text().replace('#000000', BASALT))}" style="position:absolute;left:44px;top:44px;width:250px;mix-blend-mode:multiply">
        <div style="position:absolute;left:44px;top:120px;width:472px;height:1px;background:{AUBERGINE}"></div>
        <div style="position:absolute;left:44px;top:134px;font-size:10px;letter-spacing:.06em;color:{STONE_GREY}">DUBAI, UNITED ARAB EMIRATES</div>
      </div></div>
      <div><p class="cap">App icon tile</p><div class="tile"><img src="{uri('mark.svg')}"></div></div>
      <div><p class="cap">App icon on dark</p><div class="tile" style="background:{BASALT}"><img src="{uri('mark.svg')}"></div></div>
    </div></div>
    <script>
    for (const n of [16,32]) {{ const c=document.getElementById('c'+n).getContext('2d'); const i=new Image();
      i.onload=()=>c.drawImage(i,0,0,n,n); i.src="{uri('mark.svg')}"; }}
    </script>
    </body></html>"""
    out_html = HERE / "_preview.html"
    out_html.write_text(html)
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        pg.goto(out_html.as_uri())
        pg.wait_for_timeout(500)
        pg.screenshot(path=str(HERE / "preview.png"), full_page=True)
        b.close()
    out_html.unlink()
    print("wrote preview.png")


def launch(p):
    import os

    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
    try:
        return p.chromium.launch(args=["--no-sandbox"])
    except Exception:
        return p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1255/chrome-linux64/chrome", args=["--no-sandbox"])


def render_crops(out_dir, fname="wordmark-light.svg", width=6000, crops=6):
    """Large render of a file, cut into overlapping crops for inspection."""
    import base64

    from playwright.sync_api import sync_playwright

    out_dir = FsPath(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    data = base64.b64encode((HERE / fname).read_bytes()).decode()
    html = f'<html><body style="margin:0"><img id="i" src="data:image/svg+xml;base64,{data}" style="width:{width}px;display:block"></body></html>'
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page(viewport={"width": width, "height": 800})
        pg.set_content(html)
        pg.wait_for_timeout(300)
        hgt = pg.evaluate("document.getElementById('i').getBoundingClientRect().height")
        step = width / crops
        for i in range(crops):
            x = max(0, i * step - step * 0.15)
            pg.screenshot(path=str(out_dir / f"crop{i}.png"), clip=dict(x=x, y=0, width=step * 1.3, height=hgt))
        b.close()


if __name__ == "__main__":
    write_all()
    if "--crops" in sys.argv:
        render_crops(sys.argv[sys.argv.index("--crops") + 1])
    if "--no-png" not in sys.argv:
        render_preview()
