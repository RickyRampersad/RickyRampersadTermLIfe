# Running these

Two Playwright suites. They have lived in a session scratchpad twice and been
lost both times, which is why they are in the repository now.

```bash
python3 -m http.server 8899 --bind 127.0.0.1    # from the repository root
node csec/tests/writing.js                       # the writing paper and its decode step
node csec/tests/papers.js                        # Mathematics and ELA papers, the index, the honesty note
```

`writing.js` is the one that matters most: it checks that calling a letter a
story is caught and explained before the child writes a word. That is the
mistake the suite exists for.
