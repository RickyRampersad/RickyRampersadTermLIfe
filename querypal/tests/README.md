# Query Pal attachment tests

Two suites covering photo **and document** attachments.

```bash
cd querypal/tests

# backend: buildAttachments_ in QueryPal_Backend_v6.gs, with Apps Script stubbed
node attachments.backend.test.js

# frontend: drives index.html in Chromium with real PDF / Word / PNG files
NODE_PATH=/opt/node22/lib/node_modules node attachments.browser.test.mjs
```

Both print `N passed, 0 failed` and exit non-zero on failure. Test fixtures
(PDF, .docx, PNG, a rejected .exe, an oversized file) are generated into
`fixtures/` on each run, so no binaries live in the repo — `fixtures/` is
disposable and git-ignored.

The browser suite needs Playwright. If `NODE_PATH` differs on your machine,
run it from wherever `playwright` is installed, or `npm i -D playwright`.

## What is covered

**Backend** — mixed document types attach with the correct MIME; executables
and HTML are rejected; oversized files are dropped without killing the rest;
filenames are stripped of path separators and CRLF; the older single-file
payload still works; `files[]` takes priority so nothing is attached twice;
the 6-file cap and malformed base64 are handled.

**Frontend** — the picker accepts documents and multiple files; PDFs and Word
docs keep their own type while photos are compressed to JPEG; each file shows
a chip (icon for documents, thumbnail for photos); rejected files explain
themselves; individual removal works and a removed file can be re-picked;
attachments reset when the query type changes; no page errors.

## Not covered here

Live email delivery. After redeploying the Apps Script, send one real query
with `TEST_MODE = true` and confirm the attachments arrive in the test inbox —
see the deployment notes in the commit message.
