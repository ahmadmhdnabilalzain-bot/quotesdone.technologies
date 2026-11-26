#!/usr/bin/env python3
"""
QUOTESDONE TECHNOLOGIES  -  Concept R2-3 "Engineered"  (generator)

Every letter is assembled from named members (stems, beams, bowls, rings,
braces). Where one member butts into another, a hairline JOINT separates
them, as if the word were machined from parts and then assembled. All cuts
are orthogonal (horizontal or vertical). Two shared beams tie the centre
of the word together: T+E share the top beam, E+S share the baseline beam.

Geometry is generated here, in design units (cap height H = 100, y up,
baseline = 0) and written out as outlined SVG path data. No fonts are used.

Run:  python3 build.py            (writes every deliverable next to this file)
      python3 build.py --no-png   (skip the Playwright preview render)
"""
from __future__ import annotations

import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, replace
from pathlib import Path

OUT = Path(__file__).resolve().parent

# --------------------------------------------------------------------------
# PARAMETERS  (design units, cap height = 100)
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Params:
    H: float = 100.0      # cap height
    wv: float = 15.0      # vertical stroke weight (stems, sides of rounds)
    wh: float = 13.6      # horizontal stroke weight (beams, tops of rounds)
    wd: float = 14.0      # diagonal weight, measured perpendicular (N)
    gap: float = 2.4      # JOINT: hairline between members (<=0 fuses them)
    over: float = 1.6     # overshoot of rounds beyond baseline / cap line
    mid: float = 52.0     # centre height of E arm, S spine, H bar
    track: float = 0.0    # extra tracking added to every pair (units)
    q_tail: float = 10.0  # Q tail run beyond the bowl's right edge
    q_slot_open: float = 0.0  # extra opening of the Q joint (mark uses it)


MASTER = Params()
COMPACT = replace(MASTER, gap=-0.6)                    # small sizes: joints closed
LINE2 = replace(MASTER, wv=14.0, wh=13.0, wd=13.2, gap=-0.6, over=1.4)
MARK = replace(MASTER, wv=17.0, wh=15.6, gap=4.2, over=1.6, q_tail=16.0)
MARK_SMALL = replace(MARK, gap=-0.6)

EPS = 0.6  # overlap used where members are meant to fuse (avoids AA seams)

# Palette ------------------------------------------------------------------
CARBON = "#0E1013"   # primary ink: warm-neutral near-black
ALLOY = "#ECEAE4"    # light ground / reversed ink: machined aluminium white
RHODAMINE = "#E3185B"  # single accent: laser-dye red-violet, used sparingly
GRAPHITE = "#5E636B"   # neutral for secondary info (not used in the logo)
BLACK = "#000000"

# --------------------------------------------------------------------------
# GEOMETRY  -  contours made of lines and cubic Beziers
# --------------------------------------------------------------------------

Pt = tuple[float, float]


def unit(deg: float) -> Pt:
    a = math.radians(deg)
    return math.cos(a), math.sin(a)


def weight(p: Params, tangent_deg: float) -> float:
    """Stroke weight for a stroke travelling in direction `tangent_deg`.
    Horizontal travel -> wh, vertical travel -> wv, smooth in between."""
    c = math.cos(math.radians(tangent_deg))
    s = math.sin(math.radians(tangent_deg))
    return p.wh * c * c + p.wv * s * s


class Contour:
    """A closed contour: ('M',p) ('L',p) ('C',p1,p2,p3)."""

    def __init__(self, start: Pt):
        self.cmds: list[tuple] = [("M", start)]

    def line(self, p: Pt):
        self.cmds.append(("L", p))

    def curve(self, f, t0: float, t1: float, n: int | None = None):
        """Append parametric curve f(t) from t0 to t1 as Hermite cubics."""
        if n is None:
            n = max(2, int(math.ceil(abs(t1 - t0) / 15.0)))  # ~15 deg pieces
        h = 1e-4 * (1 if t1 >= t0 else -1)
        for i in range(n):
            a = t0 + (t1 - t0) * i / n
            b = t0 + (t1 - t0) * (i + 1) / n
            pa, pb = f(a), f(b)
            da = [(f(a + h)[k] - f(a - h)[k]) / (2 * h) for k in (0, 1)]
            db = [(f(b + h)[k] - f(b - h)[k]) / (2 * h) for k in (0, 1)]
            dt = (b - a) / 3.0
            c1 = (pa[0] + da[0] * dt, pa[1] + da[1] * dt)
            c2 = (pb[0] - db[0] * dt, pb[1] - db[1] * dt)
            self.cmds.append(("C", c1, c2, pb))

    def points(self, samples: int = 24) -> list[Pt]:
        pts, cur = [], None
        for c in self.cmds:
            if c[0] in ("M", "L"):
                cur = c[1]
                pts.append(cur)
            else:
                p0, p1, p2, p3 = cur, c[1], c[2], c[3]
                for i in range(1, samples + 1):
                    t = i / samples
                    mt = 1 - t
                    pts.append((
                        mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0],
                        mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]))
                cur = p3
        return pts


def rect(x0, y0, x1, y1) -> Contour:
    c = Contour((x0, y0))
    for p in ((x1, y0), (x1, y1), (x0, y1)):
        c.line(p)
    return c


def poly(pts) -> Contour:
    c = Contour(pts[0])
    for p in pts[1:]:
        c.line(p)
    return c


class Pen:
    """Centre-line pen: straight lines and circular arcs, tangent-continuous.
    Produces an outline whose weight follows `weight()` (stroke modulation)
    and an SVG centre-line path for draw-on animation."""

    def __init__(self, p: Params, start: Pt):
        self.p = p
        self.start = start
        self.cur = start
        self.segs: list[tuple] = []

    def line_to(self, q: Pt):
        self.segs.append(("L", self.cur, q))
        self.cur = q
        return self

    def arc(self, center: Pt, sweep: float):
        dx, dy = self.cur[0] - center[0], self.cur[1] - center[1]
        r = math.hypot(dx, dy)
        a0 = math.degrees(math.atan2(dy, dx))
        self.segs.append(("A", center, r, a0, sweep))
        a1 = math.radians(a0 + sweep)
        self.cur = (center[0] + r * math.cos(a1), center[1] + r * math.sin(a1))
        return self

    # side = +1 left of travel, -1 right of travel
    def _side_fn(self, seg, side):
        p = self.p
        if seg[0] == "L":
            _, a, b = seg
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
            n = (-d[1], d[0])
            w = weight(p, math.degrees(math.atan2(d[1], d[0])))
            o = side * w / 2
            return (a[0] + n[0] * o, a[1] + n[1] * o), (b[0] + n[0] * o, b[1] + n[1] * o)
        _, c, r, a0, sw = seg
        s = 1 if sw > 0 else -1

        def f(t):
            th = a0 + sw * t
            w = weight(self.p, th + 90 * s)
            rr = r - side * s * w / 2
            u = unit(th)
            return (c[0] + rr * u[0], c[1] + rr * u[1])
        return f

    def outline(self, closed=False) -> list[Contour]:
        def side_path(side, reverse):
            segs = list(reversed(self.segs)) if reverse else self.segs
            items = []
            for sg in segs:
                fn = self._side_fn(sg, side)
                items.append((sg, fn))
            return items

        if closed:
            out = []
            for side in (1, -1):
                items = side_path(side, reverse=(side == -1))
                first = items[0]
                start = first[1](1.0 if side == -1 else 0.0) if first[0][0] == "A" else (
                    first[1][1] if side == -1 else first[1][0])
                c = Contour(start)
                for sg, fn in items:
                    if sg[0] == "L":
                        c.line(fn[0] if side == -1 else fn[1])
                    else:
                        sweep = abs(sg[4])
                        n = max(2, int(math.ceil(sweep / 15)))
                        c.curve(fn, 1.0, 0.0, n) if side == -1 else c.curve(fn, 0.0, 1.0, n)
                out.append(c)
            return out

        left = side_path(1, False)
        right = side_path(-1, True)
        sg0, fn0 = left[0]
        c = Contour(fn0[0] if sg0[0] == "L" else fn0(0.0))
        for sg, fn in left:
            if sg[0] == "L":
                c.line(fn[1])
            else:
                c.curve(fn, 0.0, 1.0, max(2, int(math.ceil(abs(sg[4]) / 15))))
        for sg, fn in right:
            if sg[0] == "L":
                c.line(fn[1])
                c.line(fn[0])
            else:
                c.line(fn(1.0))
                c.curve(fn, 1.0, 0.0, max(2, int(math.ceil(abs(sg[4]) / 15))))
        return [c]

    def centerline(self) -> list[tuple]:
        """Return centre-line commands in design space: ('M',p) ('L',p) ('A',r,large,ccw,p)."""
        cmds = [("M", self.start)]
        for sg in self.segs:
            if sg[0] == "L":
                cmds.append(("L", sg[2]))
            else:
                _, c, r, a0, sw = sg
                # split > 180 into pieces so SVG arcs stay unambiguous
                pieces = max(1, int(math.ceil(abs(sw) / 179.0)))
                for i in range(pieces):
                    th = math.radians(a0 + sw * (i + 1) / pieces)
                    cmds.append(("A", r, 0, sw > 0, (c[0] + r * math.cos(th), c[1] + r * math.sin(th))))
        return cmds


def solve_angle(f_y, target, lo, hi, it=60):
    """Bisection: find t in [lo,hi] with f_y(t) == target (monotonic)."""
    flo = f_y(lo) - target
    for _ in range(it):
        mid = (lo + hi) / 2
        fm = f_y(mid) - target
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


# --------------------------------------------------------------------------
# MEMBERS AND GLYPHS
# --------------------------------------------------------------------------


@dataclass
class Stroke:
    name: str
    role: str
    contours: list[Contour]
    center: list[tuple]          # centre-line commands (design space)
    width: float                 # nominal weight
    butt: bool = True            # outline == centre-line stroked with butt caps?
    modulated: bool = False      # weight varies along the stroke (wh on beams, wv on sides)
    note: str = ""


@dataclass
class Glyph:
    name: str                    # e.g. "Q" or "TES"
    width: float                 # ink width (x from 0)
    lsb: float                   # left side-bearing (units)
    rsb: float                   # right side-bearing
    strokes: list[Stroke] = field(default_factory=list)
    letters: str = ""


def j(p: Params) -> float:
    """Joint clearance: positive hairline gap, or negative overlap when fused."""
    return p.gap if p.gap > 0 else -EPS


def line_stroke(name, role, a: Pt, b: Pt, w: float) -> Stroke:
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
    n = (-d[1] * w / 2, d[0] * w / 2)
    c = poly([(a[0] + n[0], a[1] + n[1]), (b[0] + n[0], b[1] + n[1]),
              (b[0] - n[0], b[1] - n[1]), (a[0] - n[0], a[1] - n[1])])
    return Stroke(name, role, [c], [("M", a), ("L", b)], w)


def pen_stroke(name, role, pen: Pen, closed=False, w=None) -> Stroke:
    return Stroke(name, role, pen.outline(closed), pen.centerline(), w or pen.p.wv, modulated=True)


def ring_radius(p: Params) -> float:
    """Centre-line radius of O so the top/bottom overshoot by p.over."""
    return p.H / 2 + p.over - p.wh / 2


# --- O --------------------------------------------------------------------
def glyph_O(p: Params, name="O") -> Glyph:
    r = ring_radius(p)
    R = r + p.wv / 2
    cx, cy = R, p.H / 2
    pen = Pen(p, (cx + r, cy)).arc((cx, cy), 360)
    s = pen_stroke(f"{name}.ring", "ring", pen, closed=True)
    return Glyph(name, 2 * R, 5.0, 5.0, [s], "O")


# --- Q : one motion - bowl sweeps round and leaves along the baseline ------
def glyph_Q(p: Params) -> Glyph:
    r = ring_radius(p)
    R = r + p.wv / 2
    cx, cy = R, p.H / 2
    yb = cy - r                          # tail centre-line height
    if p.gap <= 0:
        # fused (small-size) cut: closed ring + tail bar overlapping its bottom
        ring = pen_stroke("Q.ring", "ring", Pen(p, (cx + r, cy)).arc((cx, cy), 360), closed=True)
        tip = cx + R + p.q_tail
        tail = line_stroke("Q.tail", "tail", (cx, yb), (tip, yb), p.wh)
        return Glyph("Q", tip, 5.0, 2.0, [ring, tail], "Q")
    tail_top = yb + p.wh / 2
    yc = tail_top + j(p) + p.q_slot_open  # horizontal cut of the bowl's free end

    def outer(t):  # t = angle (deg), outside of CCW travel
        w = weight(p, t + 90)
        u = unit(t)
        return (cx + (r + w / 2) * u[0], cy + (r + w / 2) * u[1])

    def inner(t):
        w = weight(p, t + 90)
        u = unit(t)
        return (cx + (r - w / 2) * u[0], cy + (r - w / 2) * u[1])

    a_out = solve_angle(lambda t: outer(t)[1], yc, -89.9, 0.0)
    a_in = solve_angle(lambda t: inner(t)[1], yc, -89.9, 0.0)
    tip = cx + R + p.q_tail
    c = Contour(outer(a_out))
    c.curve(outer, a_out, 270.0)                 # outside: round to the bottom
    c.line((tip, yb - p.wh / 2))                 # tail underside
    c.line((tip, yb + p.wh / 2))                 # tail tip (vertical cut)
    c.line((cx, yb + p.wh / 2))                  # tail top, back to the bowl
    c.curve(inner, 270.0, a_in)                  # inside: back round the counter
    c.line(outer(a_out))                         # horizontal cut (the joint)
    a_c = (a_out + a_in) / 2
    start = (cx + r * math.cos(math.radians(a_c)), cy + r * math.sin(math.radians(a_c)))
    center = [("M", start), ("A", r, 1, True, (cx - r, cy)), ("A", r, 0, True, (cx, yb)),
              ("L", (tip, yb))]
    s = Stroke("Q.bowl_tail", "bowl+tail", [c], center, p.wv, butt=False, modulated=True,
               note="free end of the bowl is cut horizontally (parallel to the tail); "
                    "reveal with a mask, or stroke the centre line and clip to outline")
    return Glyph("Q", tip, 5.0, 2.0, [s], "Q")


# --- U --------------------------------------------------------------------
def glyph_U(p: Params, W=94.0) -> Glyph:
    rU = (W - p.wv) / 2
    cy = rU + p.wh / 2 - p.over
    xl, xr = p.wv / 2, W - p.wv / 2
    pen = Pen(p, (xl, p.H)).line_to((xl, cy)).arc((W / 2, cy), 180).line_to((xr, p.H))
    return Glyph("U", W, 9.0, 9.0, [pen_stroke("U.body", "stem+bowl+stem", pen)], "U")


# --- T --------------------------------------------------------------------
def t_parts(p: Params, x0: float, W: float, beam_to: float | None = None, pre="T"):
    beam_to = W if beam_to is None else beam_to
    yb = p.H - p.wh / 2
    beam = line_stroke(f"{pre}.beam", "beam", (x0, yb), (x0 + beam_to, yb), p.wh)
    sx = x0 + W / 2
    stem = line_stroke(f"{pre}.stem", "stem", (sx, 0.0), (sx, p.H - p.wh - j(p)), p.wv)
    return [stem, beam]


def glyph_T(p: Params, W=88.0) -> Glyph:
    return Glyph("T", W, 2.0, 2.0, t_parts(p, 0.0, W), "T")


# --- E --------------------------------------------------------------------
def e_parts(p: Params, x0: float, W: float, top=True, bottom=True, pre="E"):
    out = []
    xs = x0 + p.wv / 2
    out.append(line_stroke(f"{pre}.stem", "stem", (xs, p.wh + j(p)), (xs, p.H - p.wh - j(p)), p.wv))
    if top:
        out.append(line_stroke(f"{pre}.arm_top", "beam", (x0, p.H - p.wh / 2),
                               (x0 + W * 0.97, p.H - p.wh / 2), p.wh))
    out.append(line_stroke(f"{pre}.arm_mid", "beam", (x0 + p.wv + j(p), p.mid),
                           (x0 + W * 0.90, p.mid), p.wh))
    if bottom:
        out.append(line_stroke(f"{pre}.arm_base", "beam", (x0, p.wh / 2), (x0 + W, p.wh / 2), p.wh))
    return out


def glyph_E(p: Params, W=76.0) -> Glyph:
    return Glyph("E", W, 10.0, 3.0, e_parts(p, 0.0, W), "E")


# --- S : constructed from two beams, two half-rounds and a spine -----------
def s_pen(p: Params, x0: float, W: float, start_x: float | None = None, top_end=None):
    rl = (p.mid - p.wh / 2) / 2                      # lower bowl (larger)
    ru = (p.H - p.wh / 2 - p.mid) / 2                # upper bowl
    xl = x0 + ru + p.wv / 2                          # upper bowl centre x
    xr = x0 + W - rl - p.wv / 2                      # lower bowl centre x
    start_x = x0 + 1.0 if start_x is None else start_x
    top_end = x0 + W - 1.5 if top_end is None else top_end
    pen = Pen(p, (start_x, p.wh / 2))
    pen.line_to((xr, p.wh / 2)).arc((xr, p.wh / 2 + rl), 180)
    pen.line_to((xl, p.mid)).arc((xl, p.mid + ru), -180)
    pen.line_to((top_end, p.H - p.wh / 2))
    return pen


def glyph_S(p: Params, W=82.0) -> Glyph:
    s = pen_stroke("S.body", "beam+bowl+spine+bowl+beam", s_pen(p, 0.0, W))
    return Glyph("S", W, 5.0, 5.0, [s], "S")


# --- TES ligature: T and E share the top beam, E and S share the base beam -
def glyph_TES(p: Params, Wt=88.0, We=74.0, Ws=78.0, te=3.0, es=14.0) -> Glyph:
    """te: clear space from T beam's natural end to E stem; es: E arms to S."""
    xE = Wt + te
    xS = xE + We + es
    parts = t_parts(p, 0.0, Wt, beam_to=xE + We * 0.97)
    parts[1].name = "TE.beam_shared"
    parts[1].role = "shared beam (T bar + E top arm)"
    e = e_parts(p, xE, We, top=False, bottom=False)
    pen = Pen(p, (xE, p.wh / 2))
    sp = s_pen(p, xS, Ws, start_x=xE)
    pen.segs = sp.segs
    pen.start = sp.start
    es_body = pen_stroke("ES.base_and_S", "shared beam (E base arm + S)", pen)
    strokes = [parts[0], parts[1], e[0], e[1], es_body]
    return Glyph("TES", xS + Ws, 2.0, 5.0, strokes, "TES")


# --- D --------------------------------------------------------------------
def glyph_D(p: Params, W=94.0) -> Glyph:
    rd = (p.H - p.wh) / 2
    xd = W - rd - p.wv / 2
    stem = line_stroke("D.stem", "stem", (p.wv / 2, p.wh + j(p)), (p.wv / 2, p.H - p.wh - j(p)), p.wv)
    pen = Pen(p, (0.0, p.H - p.wh / 2)).line_to((xd, p.H - p.wh / 2))
    pen.arc((xd, p.H / 2), -180).line_to((0.0, p.wh / 2))
    return Glyph("D", W, 10.0, 5.0, [stem, pen_stroke("D.bowl", "beam+bowl+beam", pen)], "D")


# --- N --------------------------------------------------------------------
def glyph_N(p: Params, W=94.0) -> Glyph:
    left = line_stroke("N.stem_left", "stem", (p.wv / 2, 0.0), (p.wv / 2, p.H), p.wv)
    right = line_stroke("N.stem_right", "stem", (W - p.wv / 2, 0.0), (W - p.wv / 2, p.H), p.wv)
    a, b = p.wv + j(p), W - p.wv - j(p)
    dx = b - a
    t = p.wd  # solve vertical thickness t so perpendicular weight == wd
    for _ in range(30):
        dy = p.H - t
        t = p.wd * math.hypot(dx, dy) / dx
    c = poly([(a, p.H), (b, t), (b, 0.0), (a, p.H - t)])
    diag = Stroke("N.brace", "diagonal", [c], [("M", (a, p.H - t / 2)), ("L", (b, t / 2))], p.wd,
                  butt=False, note="ends are cut vertically against the stems; reveal with a mask")
    return Glyph("N", W, 10.0, 10.0, [left, diag, right], "N")


# --- line-2 extras: C H L G I ---------------------------------------------
def glyph_C(p: Params, cut=0.62) -> Glyph:
    r = ring_radius(p)
    R = r + p.wv / 2
    cx, cy = R, p.H / 2
    k = cut * (p.H / 2)               # cut height above / below centre

    def outer(t):
        w = weight(p, t + 90)
        u = unit(t)
        return (cx + (r + w / 2) * u[0], cy + (r + w / 2) * u[1])

    def inner(t):
        w = weight(p, t + 90)
        u = unit(t)
        return (cx + (r - w / 2) * u[0], cy + (r - w / 2) * u[1])

    ao_t = solve_angle(lambda t: outer(t)[1], cy + k, 0.0, 89.9)
    ai_t = solve_angle(lambda t: inner(t)[1], cy + k, 0.0, 89.9)
    ao_b = 360 - ao_t
    ai_b = 360 - ai_t
    c = Contour(outer(ao_t))
    c.curve(outer, ao_t, ao_b)
    c.line(inner(ai_b))
    c.curve(inner, ai_b, ai_t)
    s = Stroke("C.bowl", "bowl", [c], [("M", (cx + r * math.cos(math.radians(ao_t)), cy + k)),
                                       ("A", r, 1, True, (cx + r * math.cos(math.radians(ao_t)), cy - k))],
               p.wv, butt=False, note="horizontal cuts")
    return Glyph("C", outer(ao_t)[0], 5.0, 3.0, [s], "C")


def glyph_G(p: Params, cut=0.62) -> Glyph:
    r = ring_radius(p)
    R = r + p.wv / 2
    cx, cy = R, p.H / 2
    k = cut * (p.H / 2)

    def outer(t):
        w = weight(p, t + 90)
        u = unit(t)
        return (cx + (r + w / 2) * u[0], cy + (r + w / 2) * u[1])

    def inner(t):
        w = weight(p, t + 90)
        u = unit(t)
        return (cx + (r - w / 2) * u[0], cy + (r - w / 2) * u[1])

    ao = solve_angle(lambda t: outer(t)[1], cy + k, 0.0, 89.9)
    ai = solve_angle(lambda t: inner(t)[1], cy + k, 0.0, 89.9)
    c = Contour(outer(ao))
    c.curve(outer, ao, 360.0)         # round to the right side at centre height
    c.line(inner(360.0))              # radial cut at 0 deg is horizontal
    c.curve(inner, 360.0, ai)
    bowl = Stroke("G.bowl", "bowl", [c], [("M", (cx + r * math.cos(math.radians(ao)), cy + k)),
                                          ("A", r, 1, True, (cx + r, cy))], p.wv, butt=False)
    yb = cy + j(p) + p.wh / 2
    bar = line_stroke("G.bar", "beam", (cx + 2.0, yb), (cx + R, yb), p.wh)
    return Glyph("G", 2 * R, 5.0, 8.0, [bowl, bar], "G")


def glyph_H(p: Params, W=90.0) -> Glyph:
    l = line_stroke("H.stem_left", "stem", (p.wv / 2, 0.0), (p.wv / 2, p.H), p.wv)
    r = line_stroke("H.stem_right", "stem", (W - p.wv / 2, 0.0), (W - p.wv / 2, p.H), p.wv)
    bar = line_stroke("H.bar", "beam", (p.wv + j(p), p.mid), (W - p.wv - j(p), p.mid), p.wh)
    return Glyph("H", W, 10.0, 10.0, [l, bar, r], "H")


def glyph_L(p: Params, W=70.0) -> Glyph:
    stem = line_stroke("L.stem", "stem", (p.wv / 2, p.wh + j(p)), (p.wv / 2, p.H), p.wv)
    base = line_stroke("L.base", "beam", (0.0, p.wh / 2), (W, p.wh / 2), p.wh)
    return Glyph("L", W, 10.0, 2.0, [stem, base], "L")


def glyph_I(p: Params) -> Glyph:
    return Glyph("I", p.wv, 10.0, 10.0,
                 [line_stroke("I.stem", "stem", (p.wv / 2, 0.0), (p.wv / 2, p.H), p.wv)], "I")


# --------------------------------------------------------------------------
# LAYOUT
# --------------------------------------------------------------------------

# Pair kerning (units, added to side-bearings). Line 1 pairs adjusted over two
# visual passes (full-line render at 1900-2000 px); line-2 pairs are placeholders.
KERN = {
    ("Q", "U"): -2.0, ("U", "O"): -1.0, ("O", "TES"): -1.0, ("TES", "D"): -3.0,
    ("D", "O"): -1.0, ("O", "N"): 0.0, ("N", "E"): -3.0,
    # line 2
    ("T", "E"): 0.0, ("E", "C"): 0.0, ("O", "L"): 0.0, ("L", "O"): -4.0,
    ("O", "G"): 0.0, ("G", "I"): 0.0, ("I", "E"): 0.0, ("E", "S"): 0.0,
}


@dataclass
class Placed:
    glyph: Glyph
    x: float


def layout(glyphs: list[Glyph], track: float) -> list[Placed]:
    out, x = [], 0.0
    prev = None
    for g in glyphs:
        if prev is not None:
            x += prev.glyph.width + prev.glyph.rsb + g.lsb + track + KERN.get((prev.glyph.name, g.name), 0.0)
        out.append(Placed(g, x))
        prev = out[-1]
    return out


def line1(p: Params) -> list[Placed]:
    gs = [glyph_Q(p), glyph_U(p), glyph_O(p), glyph_TES(p), glyph_D(p), glyph_O(p, "O2"),
          glyph_N(p), glyph_E(p)]
    gs[5].name = "O"  # kerning class
    pl = layout(gs, 6.0 + p.track)
    pl[5].glyph.strokes[0].name = "O2.ring"
    return pl


def line2(p: Params, target_width: float) -> tuple[list[Placed], float]:
    word = "TECHNOLOGIES"
    make = {"T": glyph_T, "E": glyph_E, "C": glyph_C, "H": glyph_H, "N": glyph_N, "O": glyph_O,
            "L": glyph_L, "G": glyph_G, "I": glyph_I, "S": glyph_S}
    gs = [make[ch](p) for ch in word]
    base = layout(gs, 0.0)
    natural = base[-1].x + base[-1].glyph.width
    track = (target_width - natural) / (len(gs) - 1)
    return layout(gs, track), track


def ink_box(placed: list[Placed]):
    xs, ys = [], []
    for pl in placed:
        for s in pl.glyph.strokes:
            for c in s.contours:
                for x, y in c.points(8):
                    xs.append(x + pl.x)
                    ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


# --------------------------------------------------------------------------
# SVG OUTPUT
# --------------------------------------------------------------------------


def fmt(v: float) -> str:
    s = f"{v:.2f}"
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return "0" if s in ("-0", "") else s


@dataclass
class Xf:
    """design (y-up) -> SVG (y-down): X = ox + s*x, Y = oy - s*y"""
    ox: float
    oy: float
    s: float

    def pt(self, p: Pt, dx=0.0) -> str:
        return f"{fmt(self.ox + self.s * (p[0] + dx))} {fmt(self.oy - self.s * p[1])}"


def contour_d(c: Contour, xf: Xf, dx: float) -> str:
    parts = []
    for cmd in c.cmds:
        if cmd[0] == "M":
            parts.append("M" + xf.pt(cmd[1], dx))
        elif cmd[0] == "L":
            parts.append("L" + xf.pt(cmd[1], dx))
        else:
            parts.append("C" + " ".join(xf.pt(q, dx) for q in cmd[1:]))
    return "".join(parts) + "Z"


def center_d(cmds, xf: Xf, dx: float) -> str:
    parts = []
    for cmd in cmds:
        if cmd[0] == "M":
            parts.append("M" + xf.pt(cmd[1], dx))
        elif cmd[0] == "L":
            parts.append("L" + xf.pt(cmd[1], dx))
        else:
            _, r, large, ccw, q = cmd
            rr = fmt(r * xf.s)
            parts.append(f"A{rr} {rr} 0 {large} {0 if ccw else 1} " + xf.pt(q, dx))
    return "".join(parts)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def group_svg(placed: list[Placed], xf: Xf, fill: str, gid: str, records=None, line_name="") -> str:
    out = [f'<g id="{gid}" fill="{fill}">']
    for gi, pl in enumerate(placed):
        out.append(f'<g id="{gid}-{gi}-{slug(pl.glyph.name)}">')
        for s in pl.glyph.strokes:
            d = "".join(contour_d(c, xf, pl.x) for c in s.contours)
            sid = f"{gid}-{gi}-{slug(s.name)}"
            out.append(f'<path id="{sid}" d="{d}"/>')
            if records is not None:
                pts = [(xf.ox + xf.s * (x + pl.x), xf.oy - xf.s * y)
                       for c in s.contours for x, y in c.points(24)]
                x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
                x1, y1 = max(p[0] for p in pts), max(p[1] for p in pts)
                records.append({
                    "id": sid, "line": line_name, "glyph": pl.glyph.name, "glyph_index": gi,
                    "name": s.name, "role": s.role,
                    "weight": round(s.width * xf.s, 3),
                    "centerline": center_d(s.center, xf, pl.x),
                    "outline": d,
                    "bbox": [round(x0, 2), round(y0, 2), round(x1 - x0, 2), round(y1 - y0, 2)],
                    "butt_reproducible": s.butt,
                    "modulated": s.modulated,
                    **({"note": s.note} if s.note else {}),
                })
        out.append("</g>")
    out.append("</g>")
    return "\n".join(out)


def tile_path(pid, x, y, w, h, fill) -> str:
    return (f'<path id="{pid}" fill="{fill}" d="M{fmt(x)} {fmt(y)}H{fmt(x + w)}V{fmt(y + h)}'
            f'H{fmt(x)}Z"/>')


def svg_doc(w: float, h: float, title: str, desc: str, body: str, bg: str | None = None, pid="") -> str:
    bgr = tile_path(f"{pid}-bg", 0, 0, w, h, bg) if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}" '
            f'width="{fmt(w)}" height="{fmt(h)}" role="img" aria-labelledby="{pid}-title">\n'
            f'<title id="{pid}-title">{title}</title>\n<desc id="{pid}-desc">{desc}</desc>\n'
            f'{bgr}{body}\n</svg>\n')


# Wordmark geometry (shared by all variants) ---------------------------------

SCALE = 4.0          # SVG px per design unit for wordmark files
LINE_GAP = 30.0      # space between line 1 baseline area and line 2 cap line (units)
L2_CAP = 36.0        # line-2 cap height in line-1 units
OPTICAL_IN = 1.4     # line 2 starts this far inside the Q's round edge (units)


def build_lines(p1: Params):
    L1 = line1(p1)
    x0, y0, x1, y1 = ink_box(L1)
    target = (x1 - x0 - OPTICAL_IN) / (L2_CAP / 100.0)  # in line-2 units
    L2, track2 = line2(LINE2, target)
    return L1, (x0, y0, x1, y1), L2, track2


def wordmark_body(p1: Params, fill: str, pid: str, ox: float, oy: float, s: float,
                  records=None, fill2=None) -> tuple[str, float, float]:
    """Return (svg group, width, height) of the two-line wordmark at scale s,
    with its top-left ink corner at (ox, oy)."""
    L1, (x0, y0, x1, y1), L2, _ = build_lines(p1)
    h1 = (y1 - y0)
    base1 = oy + s * y1
    xf1 = Xf(ox - s * x0, base1, s)
    g1 = group_svg(L1, xf1, fill, f"{pid}-l1", records, "QUOTESDONE")
    s2 = s * L2_CAP / 100.0
    top2 = base1 + s * (-y0) + s * LINE_GAP
    base2 = top2 + s2 * 100.0
    l2x0 = ink_box(L2)[0]
    xf2 = Xf(ox + s * OPTICAL_IN - s2 * l2x0, base2, s2)
    g2 = group_svg(L2, xf2, fill2 or fill, f"{pid}-l2", records, "TECHNOLOGIES")
    width = s * (x1 - x0)
    height = (base2 - oy)
    return g1 + "\n" + g2, width, height


def line1_only_body(p1, fill, pid, ox, oy, s):
    L1 = line1(p1)
    x0, y0, x1, y1 = ink_box(L1)
    xf = Xf(ox - s * x0, oy + s * y1, s)
    return group_svg(L1, xf, fill, f"{pid}-l1"), s * (x1 - x0), s * (y1 - y0)


def mark_body(p: Params, fill: str, pid: str, size: float, pad_frac=0.17, at=(0.0, 0.0)):
    g = glyph_Q(p)
    pl = [Placed(g, 0.0)]
    x0, y0, x1, y1 = ink_box(pl)
    avail = size * (1 - 2 * pad_frac)
    s = avail / max(x1 - x0, y1 - y0)
    # optical centring: centre the bowl (not the tail) slightly left of middle
    bowl_w = 2 * (ring_radius(p) + p.wv / 2)
    ink_w = (x1 - x0) * s
    ox = (size - ink_w) / 2 - s * x0 + s * 0.5 * ((x1 - x0) - bowl_w) * 0.35
    oy = (size - (y1 - y0) * s) / 2 + s * y1
    return group_svg(pl, Xf(ox + at[0], oy + at[1], s), fill, f"{pid}-q")


# --------------------------------------------------------------------------
# WRITERS
# --------------------------------------------------------------------------

DESC = "QUOTESDONE TECHNOLOGIES wordmark, concept R2-3 Engineered. Outlined custom lettering."


def write(name: str, text: str):
    (OUT / name).write_text(text, encoding="utf-8")


def build_all():
    pad = 60.0
    records: list = []

    # wordmark variants (two lines)
    variants = [("wordmark-light.svg", CARBON, None, "wl"),
                ("wordmark-dark.svg", ALLOY, None, "wd"),
                ("wordmark-onecolour.svg", BLACK, None, "w1"),
                ("wordmark-compact.svg", CARBON, None, "wc")]
    for fname, fill, bg, pid in variants:
        p1 = COMPACT if "compact" in fname else MASTER
        recs = records if fname == "wordmark-light.svg" else None
        body, w, h = wordmark_body(p1, fill, pid, pad, pad, SCALE, recs)
        title = "QUOTESDONE TECHNOLOGIES" + (" (compact: joints closed, for small sizes)" if "compact" in fname else "")
        write(fname, svg_doc(w + 2 * pad, h + 2 * pad, title, DESC, body, bg, pid))
    wm_w, wm_h = wordmark_body(MASTER, CARBON, "tmp", 0, 0, SCALE)[1:]

    # line-1 only (for signage / tight spaces)
    body, w, h = line1_only_body(MASTER, CARBON, "w1l", pad, pad, SCALE)
    write("wordmark-line1-light.svg", svg_doc(w + 2 * pad, h + 2 * pad, "QUOTESDONE", DESC, body, None, "w1l"))

    # mark
    write("mark.svg", svg_doc(800, 800, "QUOTESDONE TECHNOLOGIES mark (Q)",
                              "Companion mark: the Q from the wordmark, one motion ending on the baseline.",
                              mark_body(MARK, CARBON, "mk", 800), None, "mk"))
    write("mark-small.svg", svg_doc(800, 800, "QUOTESDONE TECHNOLOGIES mark (Q), small-size cut",
                                    "Joint closed for use at 32px and below.",
                                    mark_body(MARK_SMALL, CARBON, "ms", 800), None, "ms"))
    write("mark-dark.svg", svg_doc(800, 800, "QUOTESDONE TECHNOLOGIES mark (Q), reversed",
                                   "Alloy Q on Carbon tile.",
                                   mark_body(MARK, ALLOY, "md", 800), CARBON, "md"))

    # horizontal lockup: Q tile at the height of line 1 | two-line wordmark
    s = SCALE
    m_s = s * 103.2                      # line-1 ink height (cap + overshoots)
    gap = m_s * 0.36
    for fname, ink, ground, pid, ttl in (
            ("lockup-horizontal.svg", CARBON, ALLOY, "hl", ""),
            ("lockup-horizontal-dark.svg", ALLOY, CARBON, "hd", " (reversed)")):
        tile = tile_path(f"{pid}-tile", pad, pad, m_s, m_s, ink)
        mk = mark_body(MARK, ground, f"{pid}-m", m_s, pad_frac=0.2, at=(pad, pad))
        body, w, h = wordmark_body(MASTER, ink, pid, pad + m_s + gap, pad, s)
        write(fname, svg_doc(pad + m_s + gap + w + pad, h + 2 * pad,
                             "QUOTESDONE TECHNOLOGIES horizontal lockup" + ttl, DESC,
                             tile + mk + body, None, pid))

    # stacked lockup: mark centred above wordmark
    m_s2 = s * 150.0
    body, w, h = wordmark_body(MASTER, CARBON, "st", pad, pad + m_s2 + s * 46.0, s)
    mk2 = mark_body(MARK, CARBON, "st-m", m_s2, pad_frac=0.0, at=(pad + (w - m_s2) / 2, pad))
    write("lockup-stacked.svg", svg_doc(w + 2 * pad, h + m_s2 + s * 46.0 + 2 * pad,
                                        "QUOTESDONE TECHNOLOGIES stacked lockup", DESC, mk2 + body, None, "st"))

    # strokes.json (from wordmark-light.svg coordinates)
    L1, box, L2, track2 = build_lines(MASTER)
    order = 0
    for r in records:
        r["order"] = order
        order += 1
    doc = {
        "name": "QUOTESDONE TECHNOLOGIES wordmark, concept R2-3 Engineered",
        "source_svg": "wordmark-light.svg",
        "coordinate_system": "SVG user units of wordmark-light.svg viewBox; x right, y DOWN; "
                             "fill-rule nonzero",
        "viewBox": f"0 0 {fmt(wm_w + 2 * pad)} {fmt(wm_h + 2 * pad)}",
        "design_units": {"cap_height_line1": 100, "svg_px_per_unit_line1": SCALE,
                         "svg_px_per_unit_line2": SCALE * L2_CAP / 100.0},
        "params_line1": MASTER.__dict__, "params_line2": LINE2.__dict__,
        "line2_tracking_units": round(track2, 3),
        "how_to_animate": {
            "draw_on": "stroke the 'centerline' with stroke-width = 'weight', stroke-linecap butt, "
                       "and animate stroke-dashoffset; valid exactly where butt_reproducible is true. "
                       "Otherwise use the centre-line stroke as a mask over the 'outline' fill.",
            "assemble": "members are separate paths; animate each 'outline' in 'order' "
                        "(translate in from its joint, then settle). Joints are 2.4 units (9.6 px).",
            "extrude_3d": "each 'outline' is a single closed shape (rings have outer+inner subpaths) "
                          "suitable for THREE.ExtrudeGeometry / SVGLoader.",
            "weights_vary": "strokes with modulated=true change weight along their length (beams wh, "
                            "sides wv); a stroked centre line uses one nominal weight, so finish the "
                            "reveal by swapping to the outline.",
        },
        "strokes": records,
    }
    write("strokes.json", json.dumps(doc, indent=1))


# --------------------------------------------------------------------------
# VALIDATION
# --------------------------------------------------------------------------

ALLOWED = {"svg", "title", "desc", "g", "path"}
FORBIDDEN = {"text", "tspan", "font", "font-face", "style", "image", "use", "foreignObject", "script"}


def validate():
    ok = True
    for f in sorted(OUT.glob("*.svg")):
        raw = f.read_text(encoding="utf-8")
        root = ET.fromstring(raw)          # raises on malformed XML
        tags = {el.tag.split("}")[-1] for el in root.iter()}
        bad = (tags - ALLOWED) | (tags & FORBIDDEN)
        if "transform" in raw:
            bad.add("transform attribute")
        ids = [el.get("id") for el in root.iter() if el.get("id")]
        dup = {i for i in ids if ids.count(i) > 1}
        refs = re.findall(r'(?:href|url\()', raw)
        title = root.find("{http://www.w3.org/2000/svg}title")
        problems = []
        if bad:
            problems.append(f"forbidden elements {bad}")
        if dup:
            problems.append(f"duplicate ids {sorted(dup)[:5]}")
        if refs:
            problems.append("external/internal refs present")
        if title is None or not (title.text or "").strip():
            problems.append("missing <title>")
        print(f"  {'OK ' if not problems else 'BAD'} {f.name:32s} {len(ids):4d} ids  {len(raw)/1024:6.1f} KB"
              + ("  " + "; ".join(problems) if problems else ""))
        ok &= not problems
    json.loads((OUT / "strokes.json").read_text())
    print("  OK  strokes.json parses")
    if not ok:
        sys.exit("SVG validation failed")


# --------------------------------------------------------------------------
# PREVIEW
# --------------------------------------------------------------------------

PREVIEW_HTML = """<!doctype html><html><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1800px;background:#D9D7D1;font-family:'Inter',sans-serif;color:%(carbon)s}
.sec{padding:70px 90px;position:relative}
.lab{position:absolute;left:24px;top:18px;font:600 13px/1 'Inter';letter-spacing:.14em;text-transform:uppercase;opacity:.55}
.light{background:%(alloy)s}.dark{background:%(carbon)s;color:%(alloy)s}.white{background:#fff}
.big img{width:100%%;display:block}
.row{display:flex;gap:70px;align-items:flex-end}
.cap{font:500 13px/1.4 'Inter';opacity:.6;margin-top:10px}
.sign{height:300px;background:linear-gradient(#8C8880,#77736B);display:flex;align-items:center;justify-content:center}
.band{background:%(carbon)s;width:1560px;height:150px;display:flex;align-items:center;justify-content:center;box-shadow:0 30px 60px rgba(0,0,0,.35)}
.paper{background:#fff;width:820px;height:520px;padding:64px 70px;box-shadow:0 18px 50px rgba(0,0,0,.18);position:relative}
.paper .addr{position:absolute;right:70px;top:66px;text-align:right;font:400 12px/1.7 'Inter';color:%(graphite)s}
.paper .body{margin-top:120px;font:400 13px/1.8 'Inter';color:#44484F;width:560px}
.tile{width:220px;height:220px;border-radius:48px;display:flex;align-items:center;justify-content:center}
.tiny{display:flex;gap:40px;align-items:center}
</style></head><body>
<div class="sec light big"><span class="lab">Wordmark, light (Carbon on Alloy)</span><img src="wordmark-light.svg"></div>
<div class="sec dark big"><span class="lab">Wordmark, dark (Alloy on Carbon)</span><img src="wordmark-dark.svg"><img src="lockup-horizontal-dark.svg" style="width:760px;margin-top:50px"></div>
<div class="sec white"><span class="lab">One colour, black &amp; lockups</span>
 <div class="row" style="align-items:center;gap:90px">
  <img src="wordmark-onecolour.svg" style="width:760px">
  <img src="lockup-horizontal.svg" style="width:820px">
 </div>
 <div class="row" style="margin-top:60px;align-items:center;gap:90px">
  <img src="lockup-stacked.svg" style="width:520px">
  <div>
   <div class="tiny"><img src="wordmark-compact.svg" style="width:240px"><img src="wordmark-compact.svg" style="width:160px"><img src="wordmark-compact.svg" style="width:110px"></div>
   <div class="cap">Compact cut (joints closed) at 240 / 160 / 110 px wide</div>
   <div class="tiny" style="margin-top:28px"><img src="wordmark-light.svg" style="width:240px"><img src="wordmark-light.svg" style="width:160px"></div>
   <div class="cap">Master cut at 240 / 160 px: joints start to fill, use compact below ~480 px</div>
  </div>
 </div>
</div>
<div class="sec light"><span class="lab">Mark at 512 / 32 / 16 px</span>
 <div class="row">
  <img src="mark.svg" style="width:512px;height:512px;background:#fff">
  <div><img src="mark.svg" style="width:32px"> <img src="mark.svg" style="width:16px"><div class="cap">master</div></div>
  <div><img src="mark-small.svg" style="width:32px"> <img src="mark-small.svg" style="width:16px"><div class="cap">small cut</div></div>
  <div style="background:%(carbon)s;padding:16px"><img src="mark-dark.svg" style="width:32px"> <img src="mark-dark.svg" style="width:16px"></div>
  <div class="tile" style="background:%(carbon)s"><img src="mark-dark.svg" style="width:220px;border-radius:48px"></div>
  <div><div class="tile" style="background:%(rhod)s"><img src="mark-onecolour-carbon.svg" style="width:220px"></div>
  <div class="cap">App-icon tiles: Carbon / Rhodamine accent</div></div>
 </div>
</div>
<div class="sec" style="padding:0"><span class="lab" style="color:#fff;z-index:2">Signage line mock</span>
 <div class="sign"><div class="band"><img src="wordmark-line1-dark.svg" style="height:62px"></div></div>
</div>
<div class="sec light" style="display:flex;gap:80px;align-items:flex-start"><span class="lab">Letterhead corner</span>
 <div class="paper"><img src="lockup-horizontal.svg" style="width:300px">
  <div class="addr">QUOTESDONE TECHNOLOGIES L.L.C.<br>Dubai, United Arab Emirates<br>quotesdone.technologies</div>
  <div class="body">Dear partner,<br><br>Placeholder letter copy to judge the lockup at its real size on A4: the wordmark here is about 300 px wide, the size it would print at the top-left of a letterhead.</div>
 </div>
 <div class="paper" style="width:600px"><img src="lockup-stacked.svg" style="width:250px"></div>
</div>
</body></html>
"""


def build_preview():
    # helper variants used by the preview only
    body, w, h = line1_only_body(MASTER, ALLOY, "w1d", 60, 60, SCALE)
    write("wordmark-line1-dark.svg", svg_doc(w + 120, h + 120, "QUOTESDONE (reversed)", DESC, body, None, "w1d"))
    write("mark-onecolour-carbon.svg", svg_doc(800, 800, "QUOTESDONE TECHNOLOGIES mark (Q), Carbon",
                                               "Carbon Q, transparent.", mark_body(MARK, CARBON, "mc", 800), None, "mc"))
    html = PREVIEW_HTML % {"carbon": CARBON, "alloy": ALLOY, "graphite": GRAPHITE, "rhod": RHODAMINE}
    (OUT / "preview.html").write_text(html, encoding="utf-8")


def render_png(html="preview.html", png="preview.png", width=1800):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": width, "height": 1000}, device_scale_factor=1)
        pg.goto((OUT / html).as_uri())
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT / png), full_page=True)
        b.close()


if __name__ == "__main__":
    build_all()
    build_preview()
    validate()
    if "--no-png" not in sys.argv:
        render_png()
        print("  OK  preview.png")
