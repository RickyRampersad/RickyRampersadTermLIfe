#!/usr/bin/env python3
"""Draw the Premium Bridge mark in one theme's colours.

The mark is a suspension bridge inside a shield: the shield says the policy
stays protected while the client pays, the bridge says the premium is carried
across; the dot on the deck is the client part-way over. Writes, into
premium-finance/:

  logo.svg        the mark on its tile — social image, apple-touch source
  favicon.svg     the same file (browsers read it at 16–48px)
  mark-light.svg  the mark alone, for a white page or a document

and, with --inline, prints the two inline copies the page's nav and footer
carry (drawn from CSS variables, so they follow ?theme= by themselves).
Then `node tools/premium-bridge/render-mark.js` rasterises logo.svg to
logo.png, the copy the e-mails link to (Gmail strips SVG).

    python3 tools/premium-bridge/build-mark.py trust

Keep MARKS in step with the --mark* tokens in premium-finance/index.html.
"""
import pathlib
import sys

# theme: (tile, shield start, shield end, bridge on the tile, dot, bridge on white)
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


def drawing(deck, dot, grad):
    """The shapes, on a 64-unit square. `grad` is the shield's paint."""
    return (
        f'<rect x="13" y="39" width="38" height="5" fill="{deck}"/>'                        # deck
        f'<rect x="21.75" y="14" width="4.5" height="29" rx="1" fill="{deck}"/>'            # towers
        f'<rect x="37.75" y="14" width="4.5" height="29" rx="1" fill="{deck}"/>'
        f'<path d="M11 33Q16 29 24 16Q32 44 40 16Q48 29 53 33" fill="none" stroke="{deck}" '
        'stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'               # main cable
        f'<rect x="28.75" y="35.5" width="6.5" height="3.5" rx="1.75" fill="{dot}"/>'        # the client, crossing
        '<path d="M15 8H49C51.2 8 53 9.8 53 12V31C53 44 44.5 52.5 32 56.5C19.5 52.5 11 44 11 31V12C11 9.8 12.8 8 15 8Z" '
        f'fill="none" stroke="{grad}" stroke-width="4.5" stroke-linejoin="round"/>'          # shield
    )


def gradient(gid, a, b, css=False):
    stop = (lambda o, c: f'<stop offset="{o}" style="stop-color:{c}"/>') if css else \
           (lambda o, c: f'<stop offset="{o}" stop-color="{c}"/>')
    return f'<defs><linearGradient id="{gid}" x1="0" y1="1" x2="1" y2="0">{stop(0, a)}{stop(1, b)}</linearGradient></defs>'


def svg(tile, a, b, deck, dot, on_tile=True):
    rect = f'<rect width="64" height="64" rx="16" fill="{tile}"/>' if on_tile else ''
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'{gradient("pb", a, b)}{rect}{drawing(deck, dot, "url(#pb)")}</svg>\n')


def inline(gid, size):
    """The page's copy: every colour a CSS variable, so it follows the theme."""
    return (f'<svg viewBox="0 0 64 64" width="{size}" height="{size}" aria-hidden="true">'
            f'{gradient(gid, "var(--marka)", "var(--markb)", css=True)}'
            '<rect width="64" height="64" rx="16" style="fill:var(--marktile)"/>'
            + drawing('var(--markdeck)', 'var(--markdot)', f'url(#{gid})')
              .replace('fill="var(--markdeck)"', 'style="fill:var(--markdeck)"')
              .replace('stroke="var(--markdeck)"', 'style="stroke:var(--markdeck)"')
              .replace('fill="var(--markdot)"', 'style="fill:var(--markdot)"')
            + '</svg>')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--inline' in sys.argv:
        print(inline('pbn', 36))
        print(inline('pbf', 30))
        return
    theme = args[0] if args else 'trust'
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
