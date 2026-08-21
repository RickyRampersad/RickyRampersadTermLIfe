# Branch Insights — the drill-down dashboard

`insights.html`. Signs in with the same credentials as the dashboard, pulls
once from the token-gated `action=data`, and computes every figure in the
browser. That is what makes drill-down instant: clicking an agent re-derives
the whole page from data already in memory, with no round trip.

Scope comes from the server. `rrbDataSecure_` filters rows to the signed-in
person's scope before they leave the script, so a unit manager opening this
page sees their unit and nothing else. The page cannot widen its own view.

## What is on it

Six KPI tiles with inline sparklines, then: adoption since launch, the
pipeline funnel, an agent table, a manager table, time-to-decision
distribution, product mix, a day×hour submission heatmap, and a named
attention list.

Range selector — 7d / 30d / 90d / since launch — drives everything. Clicking
any agent or manager row filters the entire page and raises a chip to clear it.

## Decisions worth recording

**Median, never mean.** One case stuck 54 days drags a mean into fiction, and
a manager who does not believe a number stops reading the page.

**The distribution, not just the middle.** Time-to-decision is banded rather
than averaged. Median 2.8 days hides five cases past a fortnight, and those
five are where clients go cold.

**Each attention category is capped at four.** Without it, whichever failure is
most common buries every other kind and the panel stops being a list of what to
do next. What was hidden is stated rather than silently dropped.

**Limited-scope cases are counted but excluded from the ratio.** A Specific
Need Only case has no assessed need to divide into, so including it would drag
every agent's recommend-ratio down for doing nothing wrong. The agent table
marks how many they have.

**Charts are hand-rolled SVG and CSS.** No chart library, so nothing to load,
nothing to break offline, and no version to keep patched.

## What this cannot tell you, and why

**Products *sold*.** The fact find records what was recommended. Nothing in it
records what was issued. The panel is labelled "recommended, not sold" for that
reason. The Salesforce export sheet holds the issued side — joining the two is
a real piece of work, not a screen.

**Time from fact find to sale.** Same gap. Submission to decision is here.
Decision to policy issued needs that join.

**How agents spend their days.** There is no time tracking in this system and
inventing one from timestamps would be a fiction. The two honest proxies are
here instead: the day×hour heatmap of when fact finds are actually submitted,
and interview-to-submission lag. A branch that only writes up on Friday
afternoon is writing from memory, and that shows.

## A caveat that belongs on the page

Per-agent samples are small. At current volumes a per-agent ratio rests on a
handful of cases, which is enough for a fact ("three of these have sat over a
week") and not enough for a verdict ("this agent under-recommends"). The
measures are built now so the history accumulates.
