#!/usr/bin/env python3
"""Draw the Premium Bridge mark and lockups, as set in the identity sheet.

The mark is the coin: one large coin carrying a $, breaking into smaller
coins beside it: one big premium, turned into easy payments. Colours are
Trust Blue (ink #08131C / #0E2535, sky #7DD3FC → #0E7490). The $ and the
wordmark are outlines (glyphs.json), so every copy looks the same whether
or not a font loads. Writes, into premium-finance/:

  mark.svg           the coin mark alone, for dark backgrounds
  mark-light.svg     the coin mark alone, for white
  logo.svg           the app tile (two satellite coins), social image source
  favicon.svg        the 48-unit favicon (one satellite coin), as the sheet has it
  lockup.svg         mark + "Premium / Bridge", on dark
  lockup-light.svg   mark + "Premium / Bridge", on white

then `node tools/premium-bridge/render-mark.js` rasterises logo.png (the
app tile, 256px) and lockup-light.png (the e-mail masthead; Gmail strips SVG).

    python3 tools/premium-bridge/build-mark.py
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'premium-finance'
G = json.loads((HERE / 'glyphs.json').read_text())

SKY, SKY2, CYAN, SKY_L = '#38BDF8', '#7DD3FC', '#0E7490', '#0EA5E9'
INK9, INK8, INK7, TEXT = '#08131C', '#0B1A26', '#0E2535', '#EAF6FF'


def grad(gid, a, b):
    return (f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>')


def coins(paint):
    """The primary mark, on the identity sheet's 84-unit grid."""
    return (f'<g transform="translate(6,8)" fill="none" stroke="{paint}">'
            '<circle cx="26" cy="40" r="24" stroke-width="3.6"/>'
            '<circle cx="62" cy="25" r="9.5" stroke-width="2.8"/>'
            '<circle cx="69" cy="51" r="7" stroke-width="2.3"/>'
            '<circle cx="55" cy="63" r="5" stroke-width="2"/>'
            f'<path d="{G["dollar_25"]}" fill="{paint}" stroke="none"/></g>')


def mark(light=False):
    a, b = (SKY_L, CYAN) if light else (SKY2, CYAN)
    # viewBox cropped to the drawing with an even margin, so it sits true beside text
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 20 80 58">'
            f'<defs>{grad("m", a, b)}</defs>{coins("url(#m)")}</svg>\n')


def tile():
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104">'
            f'<defs>{grad("bg", INK7, INK9)}{grad("ic", SKY2, SKY_L)}</defs>'
            '<rect width="104" height="104" rx="24" fill="url(#bg)"/>'
            '<rect x=".5" y=".5" width="103" height="103" rx="23.5" fill="none" stroke="rgba(56,189,248,.35)"/>'
            '<g transform="translate(22,20)" fill="none" stroke="url(#ic)">'
            '<circle cx="24" cy="34" r="20" stroke-width="3.4"/>'
            '<circle cx="52" cy="22" r="8" stroke-width="2.6"/>'
            '<circle cx="58" cy="44" r="6" stroke-width="2.2"/>'
            f'<path d="{G["dollar_21"]}" fill="url(#ic)" stroke="none"/></g></svg>\n')


def favicon():
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
            f'<rect width="48" height="48" rx="11" fill="{INK7}"/>'
            f'<circle cx="20" cy="26" r="11" fill="none" stroke="{SKY}" stroke-width="2.6"/>'
            f'<circle cx="34" cy="17" r="4.5" fill="none" stroke="{SKY}" stroke-width="2"/>'
            f'<path d="{G["dollar_12"]}" fill="{SKY}"/></svg>\n')


def lockup(light=False):
    a, b = (SKY_L, CYAN) if light else (SKY2, CYAN)
    first = INK8 if light else TEXT
    second = CYAN if light else 'url(#w)'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 98">'
            f'<defs>{grad("w", a, b)}</defs>'
            f'<g transform="translate(4,6)">{coins("url(#w)")}</g>'
            f'<path d="{G["premium_29"]}" fill="{first}"/>'
            f'<path d="{G["bridge_29"]}" fill="{second}"/></svg>\n')


def main():
    files = {
        'mark.svg': mark(), 'mark-light.svg': mark(light=True),
        'logo.svg': tile(), 'favicon.svg': favicon(),
        'lockup.svg': lockup(), 'lockup-light.svg': lockup(light=True),
    }
    for name, svg in files.items():
        (OUT / name).write_text(svg)
    print('wrote', ', '.join(files), 'to', OUT)
    print('now: node tools/premium-bridge/render-mark.js   (logo.png, lockup-light.png)')


if __name__ == '__main__':
    main()
