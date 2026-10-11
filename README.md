# RickyRampersadTermLIfe

Ricky Rampersad Branch 26000, Chaguanas, Trinidad. Guardian Life.

## Deploying the site — drag `querypal`, not this folder

**The site lives in [`querypal/`](querypal/).** That is the folder that goes onto
Netlify → Deploys. Not this one.

On 11 October 2026 this folder was dragged onto Netlify by mistake and
querymypolicy.com went down — it served a 343-byte `Index.html` scaffold that
had been sitting here unused, so the site looked "live" while Query Pal was
gone. That file has been deleted. This note replaces it.

The folder you drag must have these sitting **directly** inside it:

```
querypal/
  index.html        the app  (~320 KB)
  qp-shield.png     the mark
  _redirects        /wall, /story, and the catch-all
  wall.html  story.html  404.html  manifest.webmanifest  service-worker.js
  film/  docs/  tests/
```

If you can see `CLAUDE.md`, `README.md` or `TermRates` in the folder you are
about to drag, you are one level too high — go into `querypal` first.

A drag-and-drop deploy **replaces every file on the site**, so it has to be the
whole `querypal` folder every time, never a few changed files. The Netlify
project is not linked to this repository: pushing here publishes nothing.

After deploying, check it worked — the home page should be about 320 KB, not
300 bytes:

```bash
curl -sS -o /dev/null -w '%{size_download} bytes\n' https://querymypolicy.com
```

`querypal/README.md` has the rest: the backend, the Apps Script patch, and the
rules that do not bend.
