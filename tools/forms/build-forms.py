#!/usr/bin/env python3
"""
Build the branch's six own forms from tools/forms/forms.json.

    python3 tools/forms/build-forms.py

Written 22 October 2026, when the homepage's six JotForm links were
replaced: a JotForm submission never reached the branch's sheet, never got
a reference, and never landed in anybody's day, so the loop was never
closed. Each page here posts q.quote to the Service Questionnaire backend
(apps-script/Quotes.gs) and the client sees their reference on screen.

EDIT forms.json, NEVER a generated page: one run rewrites all six.

Each page is real HTML — every field is in the markup, so the form reads
and fills with forms/form.js blocked. The script adds the conditional
fields, the validation summary, the send and the done screen.
"""

import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SPEC = os.path.join(HERE, 'forms.json')

# The same /exec the other six front ends hold. If the deployment URL ever
# changes it changes in all of them together — see CLAUDE.md.
API = ("https://script.google.com/macros/s/"
       "AKfycbxdW5mVcK6DZbq4qnCj1l1cJvjsTYWZ9UMH91H6yC_NrElNYpGd1vRyJH1W_1mcu61woQ/exec")

SUPPORT = 'support@rickyrampersadbranch.com'
TEL     = '(868) 226-6461'
TEL_H   = '+18682266461'

# Lucide's published rules: 24x24 canvas, exactly 2px stroke, round joins and
# caps, >=1px padding inside the canvas. One stroke weight across the set is
# what makes it read as designed. Every icon is aria-hidden with no
# accessible name; the text beside it is the label.
ICONS = {
  'car':      '<path d="M5 17h14M6.5 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM20.5 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/><path d="M4 17v-4l2-5h12l2 5v4"/><path d="M6 13h12"/>',
  'house':    '<path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z"/><path d="M9.5 20v-6h5v6"/>',
  'shield':   '<path d="M12 3.5 20 7v5c0 5-3.4 8-8 9.5C7.4 20 4 17 4 12V7l8-3.5Z"/><path d="M8.8 12.2 11 14.4l4.2-4.6"/>',
  'building': '<path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15"/><path d="M14 9h5a1 1 0 0 1 1 1v10"/><path d="M3 20h18M7.5 8h3M7.5 12h3M7.5 16h3M17 13h0M17 16.5h0"/>',
  'doc':      '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z"/><path d="M14 3v4h4M9 12.5h6M9 16h6"/>',
  'bolt':     '<path d="M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5L13.5 3Z"/>',
  'clock':    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  'lock':     '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  'phone':    '<path d="M6.5 3.5h3l1.5 4-2 1.5a10.5 10.5 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"/>',
  'arrow':    '<path d="M5 12h14M13 6l6 6-6 6"/>',
}


def ic(name, cls=''):
    body = ICONS.get(name, ICONS['arrow'])
    c = (' class="%s"' % cls) if cls else ''
    return ('<svg%s aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
            'stroke-linejoin="round">%s</svg>' % (c, body))


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def field(f, fkey):
    """One field, as a .f block inside the grid."""
    k    = f['k']
    fid  = '%s-%s' % (fkey, k)
    t    = f.get('t', 'text')
    req  = bool(f.get('req'))
    wide = f.get('w') != 's' and t not in ('radio',)
    show = f.get('showIf', '')
    cls  = ['f']
    if wide or t in ('textarea', 'radio', 'check'):
        cls.append('f-wide')
    attrs = ' data-show="%s"' % esc(show) if show else ''
    if f.get('short'):
        attrs += ' data-short="%s"' % esc(f['short'])

    star = '<span class="req" aria-hidden="true">*</span>' if req else ''
    help_ = ('<span class="help" id="%s-h">%s</span>' % (fid, esc(f['help']))) if f.get('help') else ''
    desc  = ' aria-describedby="%s-h"' % fid if f.get('help') else ''
    r     = ' required' if req else ''

    if t == 'check':
        return ('<div class="%s"%s><label class="check" for="%s">'
                '<input type="checkbox" id="%s" name="%s" value="Yes"%s>'
                '<span>%s%s</span></label>%s</div>'
                % (' '.join(cls), attrs, fid, fid, k, r, esc(f['label']), star, help_))

    if t == 'radio':
        opts = f['opts']
        two  = ' two' if max(len(o) for o in opts) <= 22 else ''
        rows = ''.join(
            '<label class="opt"><input type="radio" name="%s" id="%s"%s value="%s"%s>'
            '<span>%s</span></label>'
            % (k, fid if i == 0 else '%s-%d' % (fid, i), '' if i else '', esc(o),
               r if i == 0 else '', esc(o))
            for i, o in enumerate(opts))
        return ('<div class="%s"%s><fieldset style="border:0;padding:0;margin:0;background:none;box-shadow:none">'
                '<legend class="q" style="font-size:var(--f--1);font-weight:600;padding:0;margin:0">%s%s</legend>'
                '%s<div class="opts%s">%s</div></fieldset></div>'
                % (' '.join(cls), attrs, esc(f['label']), star, help_, two, rows))

    if t == 'select':
        opts = ''.join('<option value="%s">%s</option>' % (esc(o), esc(o)) for o in f['opts'])
        ctrl = ('<select id="%s" name="%s"%s%s><option value="">Choose&hellip;</option>%s</select>'
                % (fid, k, r, desc, opts))
    elif t == 'textarea':
        ctrl = ('<textarea id="%s" name="%s" rows="%d"%s%s></textarea>'
                % (fid, k, f.get('rows', 3), r, desc))
    elif t == 'money':
        ctrl = ('<span class="money"><span>TT$</span>'
                '<input type="text" inputmode="numeric" id="%s" name="%s" '
                'pattern="[0-9 ,.]*" placeholder="150,000"%s%s></span>' % (fid, k, r, desc))
    else:
        more = ''
        if t == 'number':
            more += ' inputmode="numeric"'
            if 'min' in f: more += ' min="%s"' % f['min']
            if 'max' in f: more += ' max="%s"' % f['max']
        if t == 'date':
            # the bound is set by form.js at load: a "today" written into the
            # markup is wrong the next morning
            more += ' data-past' if f.get('past', 'dob' in k) else ''
            more += ' data-future' if f.get('future') else ''
        if f.get('ac'):
            more += ' autocomplete="%s"' % f['ac']
        if f.get('ph'):
            more += ' placeholder="%s"' % esc(f['ph'])
        ctrl = '<input type="%s" id="%s" name="%s"%s%s%s>' % (t, fid, k, more, r, desc)

    return ('<div class="%s"%s><label for="%s">%s%s</label>%s%s</div>'
            % (' '.join(cls), attrs, fid, esc(f['label']), star, ctrl, help_))


def section(sec, fkey):
    fields = ''.join(field(f, fkey) for f in sec['fields'])
    return ('<fieldset><legend>%s</legend><div class="grid">%s</div></fieldset>'
            % (esc(sec['name']), fields))


STEPS = {
  'quote': ['Sales support checks it against our rates and your record, the same working day.',
            'A licensed agent calls you at the time you chose and talks you through the price.',
            'Happy with it? We put the cover on and you get the policy documents.'],
  'enrol': ['Sales support checks it against your record and your workplace plan.',
            'We e-mail you the enrolment form and the payment authority to sign.',
            'Sign it, send it back, and your first contribution goes on the next run.'],
  'apply': ['The branch opens your file under this reference straight away.',
            'A licensed agent calls you at the time you chose.',
            'Five health questions, no medical exam, and the cover is issued.'],
}


def page(f, common):
    key   = f['key']
    kind  = f['dir'].split('/')[0]
    steps = STEPS.get(kind, STEPS['quote'])
    depth = f['dir'].count('/') + 1          # how far up the root is

    secs = [common['you']] + f['sections'] + [common['last']]
    body = ''.join(section(s, key) for s in secs)

    cfg = {
        'api': API, 'code': f['code'], 'line': f['line'], 'title': f['title'],
        'support': SUPPORT, 'steps': steps,
        'done_line': f.get('done_line',
            'Your request is with the branch team, and your reference is below. '
            'Keep it — quote it whenever you call us about this.'),
    }
    for extra in ('finish_url', 'finish_label', 'done_extra'):
        if f.get(extra):
            cfg[extra] = f[extra]

    note = (('<div class="note"><strong>Before you start.</strong> %s</div>' % esc(f['note']))
            if f.get('note') else '')

    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} &mdash; Ricky Rampersad Branch</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#faf9f2">
<link rel="icon" href="/site-icon.svg" type="image/svg+xml">
<meta property="og:title" content="{title} &mdash; Ricky Rampersad Branch">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/forms/form.css">
</head>
<body>

<header class="topbar">
  <a class="brand" href="/"><img src="/site-mark.svg" alt="" width="30" height="30"><span>Ricky Rampersad Branch</span></a>
  <span class="spacer"></span>
  <a class="tel" href="tel:{telh}">{phone_ic}<span>{tel}</span></a>
</header>

<main id="page">
  <div class="lede layout">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{lede}</p>
    <p class="meta">
      <span>{clock_ic}About {mins}</span>
      <span>{lock_ic}Goes straight to the branch &mdash; never to a third party</span>
      <span>{line_ic}{line}</span>
    </p>
    {note}
  </div>

  <form class="layout" data-form="{key}" novalidate>
    <div class="err" id="err" role="alert" hidden></div>
    <noscript>
      <div class="note" style="border-color:var(--warn);background:var(--warn-bg)">
        <strong>This form needs JavaScript to send itself.</strong> Fill it in to see what we ask,
        then call the branch on <a href="tel:{telh}">{tel}</a> or e-mail
        <a href="mailto:{support}">{support}</a> and we will take it over the phone.
      </div>
    </noscript>
{body}
    <div class="send">
      <button class="btn" type="submit">{cta}{arrow_ic}</button>
      <p>Your reference appears on screen the moment you press send.</p>
    </div>
  </form>
</main>

<footer>
  <div class="layout">
    <span>Ricky Rampersad Branch &middot; Guardian Life of the Caribbean</span>
    <span class="spacer"></span>
    <a href="tel:{telh}">{tel}</a>
    <a href="mailto:{support}">{support}</a>
    <a href="/">Back to the branch</a>
  </div>
</footer>

<script>window.RRB_FORM = {cfg};</script>
<script src="/forms/form.js" defer></script>

<!-- rrb-views -->
<script>
(function(){{var u='RRB_VIEWS_URL';if(u.indexOf('http')!==0)return;try{{
(new Image()).src=u+'?p='+encodeURIComponent(location.pathname)+'&r='+encodeURIComponent((document.referrer||'').slice(0,200))+'&z='+Date.now();
}}catch(e){{}}}})();
</script>
</body>
</html>
""".format(
        title=esc(f['title']), desc=esc(f['lede'])[:155], eyebrow=esc(f['eyebrow']),
        lede=esc(f['lede']), mins=esc(f['mins']), line=esc(f['line']), note=note,
        key=key, body=body, cta=esc(f['cta']),
        tel=TEL, telh=TEL_H, support=SUPPORT,
        phone_ic=ic('phone'), clock_ic=ic('clock'), lock_ic=ic('lock'),
        line_ic=ic(f['icon']), arrow_ic=ic('arrow'),
        cfg=json.dumps(cfg, ensure_ascii=False),
    )


INDEX_CSS = """
.cards { display: grid; gap: var(--sp-s);
         grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
         margin-top: var(--sp-m); }
.qcard { display: flex; flex-direction: column; gap: var(--sp-2xs);
         padding: var(--sp-m); background: var(--card);
         border: 1px solid var(--line); border-radius: var(--r-l);
         box-shadow: var(--e1); text-decoration: none; color: var(--body);
         position: relative; transition: border-color var(--t-fast) var(--ease),
                                         translate var(--t-mid) var(--ease); }
.qcard::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
                box-shadow: var(--e3); opacity: 0; transition: opacity var(--t-mid) var(--ease);
                pointer-events: none; }
.qcard:hover { border-color: var(--action); }
.qcard:hover::after { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .qcard:hover { translate: 0 -3px; }      /* an opacity, never a box-shadow */
  /* on load, not on scroll: a card held at opacity 0 below the fold is a
     door nobody knows is there */
  .cards > * { animation: rise var(--t-slow) var(--ease-out) both; }
  .cards > :nth-child(1) { animation-delay:  40ms } .cards > :nth-child(2) { animation-delay:  90ms }
  .cards > :nth-child(3) { animation-delay: 140ms } .cards > :nth-child(4) { animation-delay: 190ms }
  .cards > :nth-child(5) { animation-delay: 240ms } .cards > :nth-child(6) { animation-delay: 290ms }
}
.qcard .ic { display: grid; place-items: center; width: 44px; height: 44px;
             border-radius: var(--r-m); background: var(--action-lt); color: var(--action-dk); }
.qcard .ic svg { width: 24px; height: 24px; }
.qcard h2 { font-size: var(--f-1); }
.qcard p { font-size: var(--f--1); color: var(--muted); text-wrap: pretty; flex: 1 1 auto; }
.qcard .go { font-size: var(--f--2); font-weight: 700; color: var(--action);
             letter-spacing: .03em; display: inline-flex; align-items: center; gap: .35em; }
.qcard .go svg { width: 16px; height: 16px; }
"""


def index(forms):
    """One page listing the six, so /quote/ is a door and not a 404."""
    cards = ''.join(
        '<a class="qcard" href="/%s/"><span class="ic">%s</span><h2>%s</h2><p>%s</p>'
        '<span class="go">%s %s</span></a>'
        % (f['dir'], ic(f['icon']), esc(f['line']),
           esc(f['lede'].split('.')[0] + '.'),
           'Start' if f['dir'].split('/')[0] != 'quote' else 'Get a price', ic('arrow'))
        for f in forms)

    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quote &amp; apply &mdash; Ricky Rampersad Branch</title>
<meta name="description" content="Request a quotation or start an application with the Ricky Rampersad Branch of Guardian Life of the Caribbean. Your reference comes back on screen.">
<meta name="theme-color" content="#faf9f2">
<link rel="icon" href="/site-icon.svg" type="image/svg+xml">
<meta property="og:title" content="Quote &amp; apply &mdash; Ricky Rampersad Branch">
<meta property="og:description" content="Request a quotation or start an application. Your reference comes back on screen.">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/forms/form.css">
<style>{css}</style>
</head>
<body>

<header class="topbar">
  <a class="brand" href="/"><img src="/site-mark.svg" alt="" width="30" height="30"><span>Ricky Rampersad Branch</span></a>
  <span class="spacer"></span>
  <a class="tel" href="tel:{telh}">{phone_ic}<span>{tel}</span></a>
</header>

<main>
  <div class="lede layout">
    <span class="eyebrow">Quote &amp; apply</span>
    <h1>Start it here, and we have it.</h1>
    <p>Every one of these is our own form. It files on the branch's worklist the moment
       you press send, your reference appears on screen, and a licensed agent calls you
       at the time you choose.</p>
    <p class="meta">
      <span>{lock_ic}Straight to the branch &mdash; never to a third party</span>
      <span>{clock_ic}Two to four minutes each</span>
    </p>
  </div>
  <div class="layout">
    <div class="cards">{cards}</div>
    <div class="note" style="margin-bottom:var(--sp-xl)"><strong>Health cover</strong> is quoted on our
      health system, and <strong>term life</strong> can be issued instantly on Xpress Life &mdash;
      both are linked from <a href="/">the branch home page</a>. Already insured with us and need
      something else? <a href="/service/">Tell us on our service review</a> or call the branch.</div>
  </div>
</main>

<footer>
  <div class="layout">
    <span>Ricky Rampersad Branch &middot; Guardian Life of the Caribbean</span>
    <span class="spacer"></span>
    <a href="tel:{telh}">{tel}</a>
    <a href="mailto:{support}">{support}</a>
    <a href="/">Back to the branch</a>
  </div>
</footer>

<!-- rrb-views -->
<script>
(function(){{var u='RRB_VIEWS_URL';if(u.indexOf('http')!==0)return;try{{
(new Image()).src=u+'?p='+encodeURIComponent(location.pathname)+'&r='+encodeURIComponent((document.referrer||'').slice(0,200))+'&z='+Date.now();
}}catch(e){{}}}})();
</script>
</body>
</html>
""".format(css=INDEX_CSS.strip(), cards=cards, tel=TEL, telh=TEL_H, support=SUPPORT,
           phone_ic=ic('phone'), lock_ic=ic('lock'), clock_ic=ic('clock'))


def main():
    spec = json.load(open(SPEC, encoding='utf-8'))
    wrote = []
    for f in spec['forms']:
        d = os.path.join(ROOT, f['dir'])
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, 'index.html')
        html = page(f, spec['common'])
        with open(p, 'w', encoding='utf-8') as fh:
            fh.write(html)
        n = len([1 for s in ([spec['common']['you']] + f['sections'] + [spec['common']['last']])
                 for _ in s['fields']])
        wrote.append((f['dir'] + '/', n, len(html)))
    p = os.path.join(ROOT, 'quote', 'index.html')
    html = index(spec['forms'])
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(html)
    wrote.append(('quote/ (the index)', 0, len(html)))

    w = max(len(x[0]) for x in wrote)
    print('%-*s  %5s  %7s' % (w, 'page', 'asks', 'bytes'))
    for d, n, b in wrote:
        print('%-*s  %5d  %7d' % (w, d, n, b))
    print('\n%d pages. Shared: forms/form.css, forms/form.js. Backend: apps-script/Quotes.gs (q.quote).' % len(wrote))


if __name__ == '__main__':
    main()
