# Running these

Five Playwright suites. They have lived in a session scratchpad twice and been
lost both times, which is why they are in the repository now.

```bash
python3 -m http.server 8899 --bind 127.0.0.1    # from the repository root
node csec/tests/writing.js                       # the writing paper and its decode step
node csec/tests/papers.js                        # Mathematics and ELA papers, the index, the honesty note
node csec/tests/guides.js                        # the method library, and who is shown which methods
node csec/tests/scope.js                         # every page, every role: nothing secondary is visible

node csec/tests/mock-code.js &                   # stands in for the Apps Script
node csec/tests/signin.js                        # passwordless sign-in, e-mailed codes, the sign-in log
```

`mock-code.js` answers the `code` / `verify` / `signin` actions exactly as
`gs/csec-sync.gs` does, so the sign-in suite runs with nothing deployed.

`writing.js` is the one that matters most: it checks that calling a letter a
story is caught and explained before the child writes a word. That is the
mistake the suite exists for.

`guides.js` guards the other half of it. A guide is a method for one
examination, so a child sitting SEA must be shown SEA methods and nothing from
the secondary ladder — before this, every child was shown all of them, and the
CSEC essay guides buried the SEA writing ones. It also holds the writing guides
to the real paper: they link to the papers, because writing is practised by
writing, and a multiple-choice question cannot ask a child to answer a topic.

`scope.js` holds the product to what it is for. Since 16 October 2026 the hub
is for the SEA alone: a switch at the top of `csec/data/curriculum.js` cuts
every secondary subject, question, guide, level and resource out of the data
before any page reads it, and this suite walks every page as a student, a
parent and a teacher and fails on any visible trace of the old ladder — CSEC,
CXC, the SBA, a Form. It reads what a person reads, never the script, where
`CSEC.esc` and `window.CSEC_GUIDES` are code names and stay.
