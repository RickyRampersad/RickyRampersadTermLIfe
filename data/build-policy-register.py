#!/usr/bin/env python3
"""
Build the Claims TT policy register from CLIENT_PORTFOLIO__c.

The vehicle register (build-vehicle-register.py) is what lets a motor
claimant type a number plate; this is the same idea for every other line —
health, life, pension, personal accident. A claimant types their policy or
plan number, proves it is theirs (last four digits of the phone on file, or
their date of birth), and their details fill themselves in.

Input — either of:

  1. A Salesforce REPORT export (CSV) of CLIENT PORTFOLIO with the columns:
     Record Type / POLICY # / Product Name / Contact: Full Name (or
     INSURANCE PORTFOLIO Name) / Email / Home Tele / Home Phone /
     Date Of Birth / Expiry Date
         python3 data/build-policy-register.py --report portfolio-export.csv

  2. Saved JSON pages from SOQL (the shape the Salesforce API returns:
     {"records": [...]}) — how the health register was first built:
         python3 data/build-policy-register.py --soql page1.json page2.json ...

Output: policy-register.csv NEXT TO THE INPUT — one row per policy, ready
to import into the PRIVATE Claims TT sheet's "Policy Register" tab — plus a
quarantine list of rows whose policy number is unusable, and a coverage
report.

None of these files belong in this repository: the repo is public and
served as a website. The data/ folder gitignores *.csv and *.json, and the
inputs should be deleted once the import is done.
"""

import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict

FIELDS = ["Policy Key", "Policy #", "Line", "Client", "Email", "Mobile",
          "DOB", "Product", "Expiry", "Portfolio"]


def norm_key(value):
    """TQG0897-00014-00 and 'tqg 0897 00014 00' are the same policy."""
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def clean(value):
    v = (value or "").strip()
    return "" if v in {",", "-", "N/A", "NA", "TBA", "TBD", "NONE", "None"} else v


def pick_mobile(*candidates):
    """First candidate that looks like a phone number wins."""
    for c in candidates:
        digits = re.sub(r"\D", "", clean(c))
        if len(digits) >= 7:
            return clean(c)
    return ""


def rows_from_report(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            g = lambda *names: next((row[n] for n in names if n in row and row[n]), "")
            yield {
                "line": g("Record Type", "RecordType.Name", "Record Type Name"),
                "policy": g("POLICY #", "POLICY__c", "Policy #"),
                "product": g("Product Name", "Product_Name__c"),
                "client": g("Contact: Full Name", "Contact Full Name", "Contact__r.Name",
                            "INSURANCE PORTFOLIO Name", "Name"),
                "email": g("Email", "Email__c"),
                "tel": g("Home Tele", "Home_Tele__c"),
                "phone": g("Home Phone", "Home_Phone__c"),
                "dob": g("Date Of Birth", "Date_Of_Birth__c"),
                "expiry": g("Expiry Date", "Expiry_Date__c"),
                "portfolio": g("INSURANCE PORTFOLIO Name", "Name"),
            }


def rows_from_soql(paths):
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        for r in data.get("records", []):
            rt = (r.get("RecordType") or {}).get("Name", "")
            contact = (r.get("Contact__r") or {}).get("Name", "")
            yield {
                "line": rt, "policy": r.get("POLICY__c"),
                "product": r.get("Product_Name__c"), "client": contact or r.get("Name"),
                "email": r.get("Email__c"), "tel": r.get("Home_Tele__c"),
                "phone": r.get("Home_Phone__c"), "dob": r.get("Date_Of_Birth__c"),
                "expiry": r.get("Expiry_Date__c"), "portfolio": r.get("Name"),
            }


def filled(record):
    return sum(1 for v in record.values() if v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", help="Salesforce report export (CSV)")
    ap.add_argument("--soql", nargs="+", help="Saved SOQL JSON page(s)")
    ap.add_argument("--out", help="Output directory (default: beside the input)")
    args = ap.parse_args()

    if not args.report and not args.soql:
        sys.exit(__doc__)

    source = rows_from_report(args.report) if args.report else rows_from_soql(args.soql)
    out_dir = args.out or os.path.dirname(os.path.abspath(args.report or args.soql[0]))

    by_key = {}
    quarantined = []
    total_in = 0

    for raw in source:
        total_in += 1
        key = norm_key(raw["policy"])
        record = {
            "Policy Key": key,
            "Policy #": clean(raw["policy"]),
            "Line": clean(raw["line"]).title().replace("(Group)", "(Group)"),
            "Client": clean(raw["client"]),
            "Email": clean(raw["email"]).lower(),
            "Mobile": pick_mobile(raw["tel"], raw["phone"]),
            "DOB": clean(raw["dob"]),
            "Product": clean(raw["product"]),
            "Expiry": clean(raw["expiry"]),
            "Portfolio": clean(raw["portfolio"]),
        }
        if len(key) < 4:
            quarantined.append({
                "Portfolio": record["Portfolio"], "Client": record["Client"],
                "Line": record["Line"],
                "Why": "no policy number" if not key else "policy number too short: " + record["Policy #"],
            })
            continue
        # Same policy number twice: keep whichever row knows more.
        if key not in by_key or filled(record) > filled(by_key[key]):
            by_key[key] = record

    register = sorted(by_key.values(), key=lambda r: (r["Line"], r["Client"].lower()))

    out_csv = os.path.join(out_dir, "policy-register.csv")
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(register)

    out_q = os.path.join(out_dir, "policy-register-quarantine.csv")
    if quarantined:
        with open(out_q, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(quarantined[0].keys()))
            w.writeheader()
            w.writerows(quarantined)

    total = len(register)
    print(f"{total_in} portfolio rows  ->  {total} distinct policies")
    print(f"quarantined: {len(quarantined)}\n")
    print("Coverage (a claimant can be verified by mobile OR date of birth)")
    for field in ["Client", "Email", "Mobile", "DOB", "Product", "Expiry"]:
        n = sum(1 for r in register if r[field])
        print(f"  {field:10} {n:5}/{total}  {100 * n // total if total else 0}%")
    verifiable = sum(1 for r in register
                     if len(re.sub(r"\D", "", r["Mobile"])) >= 4 or r["DOB"])
    print(f"\n  verifiable online          {verifiable:5}/{total}  {100 * verifiable // total if total else 0}%")
    by_line = defaultdict(int)
    for r in register:
        by_line[r["Line"]] += 1
    print("\nBy line: " + ", ".join(f"{k} {v}" for k, v in sorted(by_line.items(), key=lambda x: -x[1])))
    print(f"\nwrote {out_csv}")
    if quarantined:
        print(f"wrote {out_q}")


if __name__ == "__main__":
    main()
