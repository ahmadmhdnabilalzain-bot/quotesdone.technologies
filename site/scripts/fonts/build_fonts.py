#!/usr/bin/env python3
"""
Build the self-hosted WOFF2 files in public/fonts/ from the pinned @fontsource packages.

Why a script: the upstream files carry more than the site needs (Archivo ships wght 100-900 and
wdth 62-125). We cut the variable axes down to the ranges the type system uses and subset to
the Latin range, which takes the critical file under the font budget (structure-v1 §4.1:
<= 2 preloaded files, <= 90 KB Latin). Archivo and Fragment Mono declare no Reserved Font Name
(checked in their LICENSE files), so a subset may keep the family name under OFL 1.1.

Inputs  : node_modules/@fontsource-variable/archivo (5.3.0), node_modules/@fontsource/fragment-mono (5.3.0)
Outputs : src/assets/fonts/archivo-latin-var.woff2, src/assets/fonts/fragment-mono-latin-400.woff2,
          public/fonts/LICENSE-*.txt
Needs   : Python 3 with fonttools >= 4.40 and brotli (`pip install fonttools brotli`).
Run     : python3 scripts/fonts/build_fonts.py   (from site/). Set FONTS_VERBOSE=1 for detail.
The outputs are committed, so `npm run build` never needs Python.
"""
from __future__ import annotations

import io
import logging
import os
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

log = logging.getLogger("fonts")
SITE = Path(__file__).resolve().parents[2]
NM = SITE / "node_modules"
OUT = SITE / "src" / "assets" / "fonts"          # bundled by Vite: hashed names, cached immutable
LICENCES = SITE / "public" / "fonts"           # served beside the site so the OFL text travels with the fonts

# Google Fonts' "latin" range, plus arrows and the multiplication sign. Keep in sync with the
# unicode-range in src/styles/fonts.css.
LATIN_RANGE = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
    "U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD"
)

# Axis ranges the type system uses (docs/typography.md). Weights: 400 / 500 / 600 only.
ARCHIVO_AXES = {"wght": (400, 600), "wdth": (100, 125)}

# OpenType features kept: kerning, ligatures, tabular/lining/oldstyle figures, fractions,
# case-sensitive forms, slashed zero, and the stylistic sets the font offers.
FEATURES = ["kern", "liga", "calt", "locl", "mark", "mkmk", "tnum", "pnum", "lnum", "onum",
            "case", "zero", "frac", "sups", "sinf", "ss01", "ss02", "ss03", "ccmp"]


def parse_unicodes(spec: str) -> list[int]:
    cps: list[int] = []
    for part in spec.split(","):
        part = part.strip().removeprefix("U+")
        if "-" in part:
            a, b = part.split("-")
            cps.extend(range(int(a, 16), int(b, 16) + 1))
        else:
            cps.append(int(part, 16))
    return cps


def subset_font(font: TTFont, out: Path) -> None:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.name_IDs = ["*"]          # keep copyright, licence and family names (OFL requires the notice)
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.hinting = False           # browsers on the targets render unhinted outlines well; saves bytes
    opts.desubroutinize = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=parse_unicodes(LATIN_RANGE))
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)
    log.info("wrote %s (%d bytes)", out.relative_to(SITE), out.stat().st_size)


def require(path: Path) -> Path:
    if not path.exists():
        log.error("missing input %s: run `npm install` in site/ first", path)
        sys.exit(1)
    return path


def build_archivo() -> None:
    src = require(NM / "@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2")
    font = TTFont(src)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes}
    log.info("archivo source axes %s", axes)
    font = instancer.instantiateVariableFont(font, ARCHIVO_AXES, updateFontNames=False)
    # Round-trip through bytes: subsetting an instanced font in memory hits a lazy-gvar KeyError
    # (fontTools 4.69). A reload gives the subsetter a clean, fully decompiled font.
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    subset_font(TTFont(buf), OUT / "archivo-latin-var.woff2")


def build_mono() -> None:
    src = require(NM / "@fontsource/fragment-mono/files/fragment-mono-latin-400-normal.woff2")
    subset_font(TTFont(src), OUT / "fragment-mono-latin-400.woff2")


def copy_licences() -> None:
    for pkg, name in (("@fontsource-variable/archivo", "archivo"), ("@fontsource/fragment-mono", "fragment-mono")):
        shutil.copyfile(require(NM / pkg / "LICENSE"), LICENCES / f"LICENSE-{name}.txt")


def main() -> None:
    logging.basicConfig(level=logging.INFO if os.environ.get("FONTS_VERBOSE") else logging.WARNING,
                        format="[fonts] %(message)s")
    logging.getLogger("fontTools").setLevel(logging.WARNING)
    OUT.mkdir(parents=True, exist_ok=True)
    LICENCES.mkdir(parents=True, exist_ok=True)
    build_archivo()
    build_mono()
    copy_licences()
    for f in sorted(OUT.glob("*.woff2")):
        print(f"{f.name}: {f.stat().st_size} bytes")


if __name__ == "__main__":
    main()
