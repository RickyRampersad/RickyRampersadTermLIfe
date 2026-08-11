# Pension Application Wizard — setup & maintenance

The wizard lives at **`/pension/`** (`rickyrampersadbranch.com/pension/`, or the
short link `/pension`). It takes a company-owned (Section 134) pension case from
a blank screen to a signed-ready application:

1. **Section 134 computation** — the maximum the company may contribute
   tax-free, the BIR approval form, and the employer's plan.
2. **Declaration 1** — the employee's details, their own contribution, their
   plan and beneficiaries, with the real Guardian PDF filled in live.
3. **Declaration 2** — the third-party declaration, because the company owns
   the policy.
4. **KYC** — ID, utility bill, pay slip, beneficiary ID.
5. **Review & submit** — one Full Package PDF (cover, both declarations, the
   auto-built salary deduction form, and the KYC images) plus the branch email.

Everything runs in the client's browser. Case data is held in that browser's
`localStorage` and never leaves the device except in the PDFs the agent
downloads and the email they choose to send.

---

## Part 1 — Deploying

The site is a plain static site; the wizard is just another folder in it. Push
to the branch Netlify builds and it is live. `netlify.toml` already sets:

- `publish = "."` and `functions = "netlify/functions"`
- `/pension` → `/pension/`
- `X-Frame-Options: DENY`, `nosniff` and `Referrer-Policy: no-referrer` on
  `/pension/*`
- a one-year immutable cache on `/pension/assets/*`

Netlify installs the one dependency in `package.json` (`@anthropic-ai/sdk`)
automatically. There is no build step.

> **On GitHub Pages** the pages all work, but Netlify functions do not exist
> there — RIA (below) falls back to its built-in answers. Everything else,
> including every PDF, is unaffected.

---

## Part 2 — Turning on RIA, the assistant

RIA is the gold button in the bottom-right of the wizard. It answers questions
about the current step using the live case on screen.

1. Get an API key from <https://console.anthropic.com> → **API keys**.
2. In Netlify: **Site configuration → Environment variables → Add a variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: the key (starts with `sk-ant-`)
   - Scope: leave it on all deploy contexts.
3. Redeploy (**Deploys → Trigger deploy → Deploy site**).

That is the whole setup. The key stays on Netlify's servers — the browser never
sees it, because the browser talks to `/api/pension-ai`
(`netlify/functions/pension-ai.mjs`), which talks to Anthropic.

**Without the key nothing breaks.** The endpoint returns "not configured" and
the wizard silently uses the built-in answers it has always had.

### Optional environment variables

| Variable | Default | What it does |
| --- | --- | --- |
| `PENSION_AI_MODEL` | `claude-opus-5` | Which model answers. |
| `PENSION_AI_EFFORT` | `low` | `low`, `medium`, `high`, `xhigh`, `max`. Higher = more thorough, slower, dearer. |
| `PENSION_AI_ALLOWED_ORIGINS` | — | Extra comma-separated hosts allowed to call the endpoint. The site's own domains and `*.netlify.app` are always allowed. |

### What it costs, and the guard rails

Each question is a short exchange — roughly a US cent or two at `low` effort,
depending on how much case context is on screen. To stop a public endpoint with
the branch's key from being used as a free chatbot, the function:

- accepts POST only, and only from the branch's own domains,
- caps the case context at 24 000 characters and the conversation at 12
  messages of 4 000 characters each,
- caps each answer at 2 000 tokens,
- rate-limits to 25 questions per 5 minutes per IP address,
- ships a system prompt that keeps RIA on this application and nothing else.

The rate limit is per running function instance, so it slows casual abuse
rather than stopping a determined attacker. If the branch ever sees unexpected
spend, set a monthly limit on the Anthropic console and rotate the key.

The branch's own instructions to RIA — the Section 134 rules, the document
list, the tone — are in `SYSTEM_PROMPT` at the top of
`netlify/functions/pension-ai.mjs`. Edit that file to change what RIA knows or
how it speaks.

---

## Part 3 — Maintenance

### Replacing a blank Guardian form

The blanks are real PDFs in `pension/assets/`:

| File | Form |
| --- | --- |
| `RRB_Declaration1_blank.pdf` | Declaration 1 (employee) |
| `RRB_Declaration2_blank.pdf` | Declaration 2 (third party) |
| `RRB_Salary_blank.pdf` | Salary deduction authority |

Drop in the replacement under the same name. The wizard fills these by **field
name**, so if Guardian reissues a form with renamed fields, the matching
`setText(...)` calls in `buildD1` / `buildD2` / `buildSal` inside
`pension/index.html` need updating too. Bump `CACHE` in `pension/sw.js` after
any asset change so devices that cached the old form pick up the new one.

### Adding an agent to the dropdown

In `pension/index.html`, find `<!-- AGENT LIST -->` in Step 1 and add an
`<option>` line under it.

### Offline use

The wizard registers a service worker (`pension/sw.js`) that keeps the page,
the PDF engine and the three blank forms on the device. After one online visit
an agent can work a full case with no signal — only RIA needs the network.
Change the wizard, bump `CACHE` in `sw.js`.

### The case file

The toolbar under the header shows that the case is saved on that device, and
offers:

- **Export case** — writes the typed case to a `.json` file (a backup, or a way
  to carry a case to another device). Uploaded ID photos are deliberately *not*
  in the file.
- **Import** — opens an exported case, replacing what is on the device.
- **New case** — clears the device and starts empty.
