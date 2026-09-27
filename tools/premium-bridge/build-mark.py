#!/usr/bin/env python3
"""Draw the Premium Bridge mark in one theme's colours.

The mark is a five-piece arch (the premium carried across in instalments)
over a deck, with a dot part-way across. Writes, into premium-finance/:

  logo.svg        the mark on its tile — nav, footer, social image
  favicon.svg     the same file (browsers read it at 16–48px)
  mark-light.svg  the mark alone, for a white page or a document

then `node render-mark.js` rasterises logo.svg to logo.png, the copy the
e-mails link to (Gmail strips SVG).

    python3 tools/premium-bridge/build-mark.py trust

The page itself draws the mark inline with CSS variables, so it follows the
page's theme by itself; these files do not, which is why they are rebuilt
whenever THEME in premium-finance/index.html changes. Keep MARKS in step
with the --mark* tokens in that page.
"""
import math
import pathlib
import sys

# theme: (tile, arch start, arch end, deck on the tile, dot, deck on white)
MARKS = {
    'harbour':  ('#0E1B2C', '#10A58E', '#8BE8D2', '#F6F2E9', '#F5A524', '#0E1B2C'),
    'midnight': ('#060C1C', '#B8941F', '#F0D066', '#F4F1E8', '#7DD3FC', '#0A1228'),
    'trust':    ('#0E2535', '#0EA5E9', '#7DD3FC', '#F4F8FB', '#F59E0B', '#0B1A26'),
    'emerald':  ('#0A160F', '#15A06A', '#34D399', '#F4F6F4', '#E9C46A', '#0E1B14'),
    'forest':   ('#0F1C16', '#C08A2D', '#E9C46A', '#F7F3EA', '#4CAF7D', '#13261C'),
    'coral':    ('#161B22', '#E11D48', '#FB7185', '#F7F7F9', '#FDBA74', '#10141A'),
    'indigo':   ('#14132B', '#65A30D', '#A3E635', '#F6F6FB', '#818CF8', '#0D0C1C'),
}

OUT = pathlib.Path(__file__).resolve().parents[2] / 'premium-finance'


def arches(n=5, gap=5.5):
    """Five arcs of one circle through (9,50) and (55,50), crest at y=24."""
    hx, sag = 23, 26
    r = (hx * hx + sag * sag) / (2 * sag)
    cx, cy = 32, 24 + r
    edge = math.degrees(math.asin(hx / r))
    span = (2 * edge - gap * (n - 1)) / n

    def pt(t):
        a = math.radians(t)
        return cx + r * math.sin(a), cy - r * math.cos(a)

    out = []
    for i in range(n):
        t0 = -edge + i * (span + gap)
        (x0, y0), (x1, y1) = pt(t0), pt(t0 + span)
        out.append(f'<path d="M{x0:.2f} {y0:.2f} A{r:.2f} {r:.2f} 0 0 1 {x1:.2f} {y1:.2f}"/>')
    return ''.join(out)


def svg(tile, a, b, deck, dot, on_tile=True):
    rect = f'<rect width="64" height="64" rx="16" fill="{tile}"/>' if on_tile else ''
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        f'<defs><linearGradient id="pb" x1="0" y1="1" x2="1" y2="0">'
        f'<stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient></defs>\n'
        f'{rect}<g transform="translate(0,-5)">'
        f'<g fill="none" stroke="url(#pb)" stroke-width="6" stroke-linecap="butt">{arches()}</g>\n'
        f'<line x1="7" y1="41" x2="57" y2="41" stroke="{deck}" stroke-width="3.4" stroke-linecap="round"/>\n'
        f'<circle cx="45" cy="41" r="3.6" fill="{dot}"/>\n'
        '</g>\n</svg>\n'
    )


def main():
    theme = sys.argv[1] if len(sys.argv) > 1 else 'trust'
    if theme not in MARKS:
        sys.exit(f'unknown theme {theme!r}; one of {", ".join(MARKS)}')
    tile, a, b, deck, dot, deck_light = MARKS[theme]
    on_tile = svg(tile, a, b, deck, dot)
    (OUT / 'logo.svg').write_text(on_tile)
    (OUT / 'favicon.svg').write_text(on_tile)
    (OUT / 'mark-light.svg').write_text(svg(tile, a, b, deck_light, dot, on_tile=False))
    print(f'{theme}: logo.svg, favicon.svg, mark-light.svg written to {OUT}')
    print('now: node tools/premium-bridge/render-mark.js   (writes logo.png)')


if __name__ == '__main__':
    main()
