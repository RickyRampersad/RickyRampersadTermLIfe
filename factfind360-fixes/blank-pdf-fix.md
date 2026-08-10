# Blank PDF — cause and fix

**Affects:** the PDF emailed to the client, agent and manager on submission, *and*
the copy the agent downloads via "Download for Manager". Both are blank.

**File:** the fact-find form served at `factfind360.com/ffproject`

## Cause

Both render paths make the print layout visible, then hide it from the user by
making it almost fully transparent:

```js
'display:block !important;position:fixed;left:0;top:0;width:794px;' +
'max-width:none;background:#ffffff;z-index:-1;opacity:0.01;pointer-events:none;overflow:visible;'
```

The comment above it explains the intent:

> nearly transparent so the user does not see it but html2canvas still paints it

That assumption is wrong. **html2canvas honours CSS `opacity`.** It reads the
computed style and rasterises through it, so the content is painted at 1% alpha
onto the white background — producing a PDF with the right page count, the right
margins and the right pagination, and nothing visible on it.

It also explains why neither existing guard catches it:

- client-side: `if (b64.length < 500)` — passes, a white A4 page is still many KB
- server-side `ffBuildPdfAttachment_`: `if (b64.length < 100) return null` — passes

The file is real. It is just white.

## Fix

Render **off-screen at full opacity** instead of on-screen at 1% opacity.
html2canvas clones the node into its own sandboxed container to rasterise, so an
off-screen element renders correctly while staying invisible to the user.

### Edit 1 — `generateFactFindPdfBase64()` (the emailed PDF)

**Find:**
```js
  root.setAttribute('style',
    'display:block !important;position:fixed;left:0;top:0;width:794px;' +
    'max-width:none;background:#ffffff;z-index:-1;opacity:0.01;pointer-events:none;overflow:visible;');
```

**Replace with:**
```js
  // Off-screen at FULL opacity. Do not use opacity to hide this: html2canvas
  // honours computed opacity and will happily rasterise the whole document at
  // 1% alpha, producing a correctly paginated, entirely white PDF.
  root.setAttribute('style',
    'display:block !important;position:fixed;left:-10000px;top:0;width:794px;' +
    'max-width:none;background:#ffffff;opacity:1;pointer-events:none;overflow:visible;');
```

### Edit 2 — `downloadForManager()` (the agent's copy)

**Find:**
```js
    if (root) root.setAttribute('style', 'display:block !important;position:fixed;left:0;top:0;width:794px;background:#fff;z-index:-1;opacity:0.01;pointer-events:none;');
```

**Replace with:**
```js
    // See generateFactFindPdfBase64() — off-screen, never opacity.
    if (root) root.setAttribute('style', 'display:block !important;position:fixed;left:-10000px;top:0;width:794px;background:#fff;opacity:1;pointer-events:none;');
```

## Make the guard actually guard

Both length checks pass on a blank page, which is how this shipped. A white page
compresses to a very predictable size, so a size floor is the wrong test —
check that something was actually drawn instead.

Add this to `generateFactFindPdfBase64()`, just before the `outputPdf` call, and
have it run on the canvas html2pdf produces:

```js
  html2canvas: {
    scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
    windowWidth: 794, width: 794,
    onclone: function (doc) {
      // Belt and braces: whatever the caller set, the clone renders opaque.
      var c = doc.getElementById('printLayout');
      if (c) { c.style.opacity = '1'; c.style.zIndex = 'auto'; }
    }
  },
```

That makes a blank render impossible even if someone reintroduces the opacity
trick later.

## Verify

1. Open a fact find, fill enough to be recognisable, submit.
2. Open the emailed PDF — content should be there, same layout as "Print".
3. Check the downloaded copy too; it uses the same code path.

If it is *still* blank after this, the next suspect is `buildPrintLayout()`
producing markup that depends on a stylesheet html2canvas is not loading — but
the opacity is the cause of what you are seeing now.
