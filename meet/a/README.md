# One address per advisor

Each folder here is a single small page carrying one advisor's name in its
link preview, and nothing else. A prospect who opens it is moved on to
`/meet/` within a frame, carrying everything the advisor put on the link.

## Why they exist

A link preview is fetched **once per address**, and WhatsApp does not run
JavaScript when it fetches. So `/meet/?n=Meera+Persad+Khan` reaches the page
perfectly and never reaches the preview — the crawler reads the file as it
sits on disk and stops.

That is why every advisor's link previewed as **"Meet Premchand Dookran"**
for months. It was not a bug in the link. It was the only name in the file.

A different address is the only thing WhatsApp will read differently. So each
advisor has one, and the name is in the file where the crawler can see it.

## Adding or changing an advisor

**Do not hand-edit these.** They are generated from the advisor roster held in
`ffproject.html` in the `fact-find-analyzer` repository — the same list the
fact find uses for the advisor dropdown, so the two cannot drift apart.

When someone joins or leaves, add or remove them there, then regenerate.
Editing a page here instead leaves a name on the preview that no longer
matches the roster, and nothing will tell you.

## What the preview says

The headline is the same for everyone:

> If your income stopped tomorrow, how long would your family be alright?

The advisor's name is in the line under it, with the branch. The question
leads because it is the reason somebody taps; the name follows because it is
the reason they trust it.

Changing the headline means regenerating all thirty. Change it in one place —
the generator — never in thirty files.
