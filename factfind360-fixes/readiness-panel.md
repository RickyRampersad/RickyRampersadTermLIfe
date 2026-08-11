# "Ready to submit?" — live completeness and quality for the agent

Injected into `FFPROJECT.html` before `</body>`; source kept here as
`readiness-panel.js`. Already applied in the site zip.

## The problem

The manager side already had a full RAI checklist with severity bands, priority
alignment checks and the line *"RAI advises; the decision and accountability are
yours."* The agent had none of it — they got a wall of "Cannot submit. Missing:"
only after pressing the button. That is what made the end of the form confusing.

## What it does

A panel above the submit button, updating on every keystroke, split in two:

- **Needed before you can submit** — the hard gate, with a progress bar
- **Worth checking — will not stop you submitting** — quality prompts

Quality prompts computed from real fields:

| Prompt | From |
|---|---|
| Each concept should link to an identified need | `recNRec` with no `recNNeed` |
| Affordability — premium is N% of stated surplus | Σ `recNPrem` ÷ `cashSurplus_calc` |
| No cash surplus recorded | premium present, surplus zero |
| Client priorities not stated in their own terms | `goal1Need` empty |
| Priority order may not match the client's | `rec1Need` ≠ `goal1Need` |
| Needs analysis quality is N/100 | `naqScore` < 55 |

## One source of truth

`rrbReadiness()` is the **only** implementation of the agent gate —
`submitForm()` calls it rather than holding its own copy. Two copies drift, and
a panel that says "ready" while the button refuses is worse than no panel.

## Credit where due

The rubric wording — *each concept links to an identified need*, *client
priorities stated in their own terms*, *affordability confirmation is explicit*,
and the reminder to *confirm whether each figure is monthly or annual* — is
taken from a prototype of a rebuilt FactFind360. That prototype has no backend,
but its framing of fact-find quality was better than what was here, and it is
the right framing.

## Verified

In headless Chromium: empty form 10 blockers at 0%; filled, 100% with the
affordability, priority and quality prompts all firing correctly. No page
errors. PDF generation unchanged at 1,073,256 bytes.
