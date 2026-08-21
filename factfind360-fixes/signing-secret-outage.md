# The sign-in outage, and why every cheap test missed it

Found by probing the live deployment after the tap-to-approve release.

## What was broken

`rrbLogin` ends with `token: rrbMintSession_(email, person)`. That calls
`rrbSign_` → `rrbSecret_()`, which threw:

```js
if (!s) throw new Error('No signing secret — run rrbInitSecret() once.');
```

`rrbInitSecret()` had never been run. So a **correct** password threw and
returned Google's raw error page. Nobody could sign in — agents or managers.

## Why it looked healthy

Every quick check passes against a broken system, which is what makes this
worth writing down:

| Probe | Result | Why it told us nothing |
|---|---|---|
| `?action=ping` | `alive` | never signs anything |
| `?action=login` with a bad password | clean `Incorrect name or password.` | rejects **before** minting a session |
| `?action=roster` unauthenticated | correctly blocked | rejects before verifying a signature |

The rejection paths all return early. Only the success path reaches the
signer — so the system was dead precisely where nothing convenient tested it.

It was isolated by finding the boundary. `rrbVerifyToken` returns early for a
malformed token and only then calls `rrbSign_`:

```
?action=decide&t=(none)      -> our page      (returns before signing)
?action=decide&t=nodothere   -> our page      (returns before signing)
?action=decide&t=aaa.bbb     -> Google error  (reaches rrbSign_)
```

That pinpointed the throw to the signing step with no access to the console.

## Fixes

**1. The secret creates itself.** Auth for the whole branch should not hang on
someone remembering a setup function. `rrbSecret_()` now generates 32 random
bytes on first use, under a `LockService` lock with a re-read inside it so two
simultaneous first requests cannot mint different secrets. An existing secret
is returned untouched — this can never rotate a live key.

**2. Nothing a manager taps shows Google's error page.** The `decide` and
`decide_note` routes return HTML, so they sit outside `doGet`'s error handling
and had none of their own. They now carry their own `try/catch`, with a second
fallback if even `rrbPage_` is unavailable. The message says plainly that the
decision was **not** recorded, because the failure mode that matters is a
manager believing they approved something when nothing was written.

## Verified

Against an empty ScriptProperties, simulating the exact broken state:

```
start: ScriptProperties empty = true
rrbSecret_: no signing secret existed — generated one.
token minted: eyJlbSI6InJpY2t5LnJhbXBlcn…  (148 chars)
secret stored : true (32 bytes of entropy)
same secret across calls : true
same body -> same signature : true
lock used : true | lock released : true
existing secret preserved : true
```

## The lesson worth keeping

A health check that only exercises rejection paths proves the system is good
at saying no. Sign-in needs a probe that reaches the success path — otherwise
the next outage of this shape is equally invisible.
