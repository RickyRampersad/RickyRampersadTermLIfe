#!/usr/bin/env python3
"""Generate the GCM_CODES secret. Run once, paste the output into GitHub > Settings >
Secrets and variables > Actions > New repository secret, name GCM_CODES.
Keep a copy somewhere safe, never in this repository.

  python new_codes.py --clients reg.json --keep drco-3c0048c79a=EXISTING-CODE \\
      "Ricky Rampersad" "Kamla Dookran" "Elizabeth Lee"

A code is four letters of the group's name, which anyone could guess, then twelve
random characters, which is what actually locks the page. The locked pages stay
in the public history of this repository, so the random part has to hold up to
an offline guess for years; eight characters would not. --keep carries a code a
client already holds into the new set unchanged.
"""
import argparse, json, os, re, secrets

A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
part = lambda: "".join(secrets.choice(A) for _ in range(4))

ap = argparse.ArgumentParser()
ap.add_argument("staff", nargs="*", default=["Ricky Rampersad"])
ap.add_argument("--clients", help="the register, from a file outside the repository (else GCM_CLIENTS)")
ap.add_argument("--keep", action="append", default=[], help="slug=CODE, a code a client already holds")
a = ap.parse_args()

cfg = json.load(open(a.clients)) if a.clients else json.loads(os.environ["GCM_CLIENTS"])
keep = dict(k.split("=", 1) for k in a.keep)
clients = {c["slug"]: keep.get(c["slug"]) or f"{re.sub('[^A-Z]', '', c['name'].upper())[:4]}-{part()}-{part()}-{part()}"
           for c in cfg["clients"]}
staff = {name: f"STAFF-{part()}-{part()}-{part()}" for name in a.staff}
print(json.dumps({"clients": clients, "staff": staff}, indent=2))
