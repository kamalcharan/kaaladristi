#!/usr/bin/env python3
"""
scan_theme_contrast.py — find hardcoded text/background colors that will
break when a file's surrounding theme is CSS-variable-driven (light/dark
or multi-theme apps).

The bug class this catches: a component uses var(--bg)/var(--card)/
var(--surface-*) etc. for its background (theme-aware — it WILL change
color when the theme flips), but a `color:` value nearby is a literal
hex/rgb (theme-blind — it will NOT change). When the background flips
light and the text stays a fixed near-white (or vice versa), the text
becomes unreadable. This is exactly the class of bug this skill was
built to catch after finding it live in a login screen (near-white text
hardcoded over an input whose background correctly flipped to light).

This is a heuristic regex scanner, not a CSS/JSX parser — it flags
CANDIDATES for a human (or the calling agent) to triage, not confirmed
bugs. False positives happen (e.g. white text intentionally fixed over
an always-colored badge/button background is correct, not a bug).

Usage:
    python3 scan_theme_contrast.py <directory> [--ext tsx,ts,jsx,js,vue,svelte]

Exit code is always 0 — this is a reporting tool, not a CI gate (a
project can wire the JSON output into one if it wants a gate).
"""
import argparse
import json
import re
import sys
from pathlib import Path

THEME_VAR_BG_RE = re.compile(
    r"(background(?:Color)?|bg)\s*[:=]\s*['\"`]?[^'\"`;\n]*var\(--(?:bg|card|surface[\w-]*|panel[\w-]*)",
    re.IGNORECASE,
)
LITERAL_COLOR_PROP_RE = re.compile(
    r"\bcolor\s*:\s*['\"`]?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))",
)
HEX_RE = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
RGB_RE = re.compile(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)")


def hex_to_rgb(h: str):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def relative_luminance(rgb) -> float:
    def chan(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (chan(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def classify(color: str):
    rgb = None
    if HEX_RE.match(color):
        rgb = hex_to_rgb(color)
    else:
        m = RGB_RE.match(color)
        if m:
            rgb = tuple(float(x) for x in m.groups())
    if rgb is None:
        return None, None
    lum = relative_luminance(rgb)
    if lum > 0.6:
        return "light", lum
    if lum < 0.2:
        return "dark", lum
    return "mid", lum


def scan_file(path: Path):
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    theme_aware = bool(THEME_VAR_BG_RE.search(text))
    findings = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        m = LITERAL_COLOR_PROP_RE.search(line)
        if not m:
            continue
        color = m.group(1)
        cls, lum = classify(color)
        if cls in ("light", "dark") and theme_aware:
            findings.append(
                {
                    "file": str(path),
                    "line": lineno,
                    "color": color,
                    "luminance_class": cls,
                    "luminance": round(lum, 3) if lum is not None else None,
                    "severity": "high",
                    "reason": (
                        f"file uses var(--bg)/var(--card)/var(--surface*) "
                        f"(theme-flips) but this text color ({color}, "
                        f"{cls}) is a fixed literal — verify it stays "
                        f"readable in the OTHER theme mode too."
                    ),
                    "snippet": line.strip()[:160],
                }
            )
    return findings


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("directory")
    ap.add_argument("--ext", default="tsx,ts,jsx,js,vue,svelte")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = ap.parse_args()

    exts = {f".{e.strip().lstrip('.')}" for e in args.ext.split(",")}
    root = Path(args.directory)
    if not root.exists():
        print(f"error: {root} does not exist", file=sys.stderr)
        sys.exit(1)

    all_findings = []
    for path in root.rglob("*"):
        if path.suffix not in exts:
            continue
        if any(part in {"node_modules", "dist", "build", ".git"} for part in path.parts):
            continue
        all_findings.extend(scan_file(path))

    if args.json:
        print(json.dumps(all_findings, indent=2))
        return

    if not all_findings:
        print("No theme/hardcoded-color mismatch candidates found.")
        return

    by_file = {}
    for f in all_findings:
        by_file.setdefault(f["file"], []).append(f)

    print(f"{len(all_findings)} candidate(s) across {len(by_file)} file(s):\n")
    for file, items in sorted(by_file.items()):
        print(f"  {file}")
        for it in items:
            print(f"    L{it['line']}: {it['color']} ({it['luminance_class']}) — {it['snippet']}")
        print()

    print(
        "Each of these is a CANDIDATE — this file mixes a CSS-var background "
        "(which changes with theme) and a literal text color (which does not). "
        "Confirm each by reading the surrounding component: if the background "
        "at that point is theme-driven, the text color should be too (route it "
        "through the matching semantic text token, e.g. var(--text-primary))."
    )


if __name__ == "__main__":
    main()
