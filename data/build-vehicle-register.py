#!/usr/bin/env python3
"""
Build the Claims TT vehicle register from the Salesforce risk-details export.

Risk Details holds one row per vehicle *per policy year*, and each year tends
to carry a different fragment of the truth — a chassis number recorded once in
2019 and never again, a model that only appears on the latest row. Merging the
rows for a vehicle recovers all of it into a single current record, which is
what lets a claimant type a number plate and have the form fill itself in.

    python3 data/build-vehicle-register.py

Writes data/vehicle-register.csv (import into the PRIVATE Claims sheet) and
prints a coverage report plus a quarantine list of registrations that are not
registrations.

The output holds client names, emails and mobiles. It belongs in the private
Claims spreadsheet, never in a folder the website serves.
"""

import csv
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "risk-details.csv")
OUTPUT = os.path.join(HERE, "vehicle-register.csv")
QUARANTINE = os.path.join(HERE, "vehicle-register-quarantine.csv")

FIELDS = [
    "Reg Key", "Vehicle Reg", "Policy Key", "Policy #", "Client", "Email", "Mobile",
    "Make", "Model", "Year", "Chassis #", "Engine #", "Coverage Type",
    "Insured Value (TT$)", "Windscreen (TT$)", "Carrier", "Cover From", "Cover To",
    "Vehicle Status", "Years Insured",
]

# Fields where the most recent policy year wins outright.
CURRENT_WINS = {
    "Vehicle Reg", "Policy #", "Client", "Coverage Type", "Insured Value (TT$)",
    "Windscreen (TT$)", "Carrier", "Cover From", "Cover To", "Vehicle Status",
    "Years Insured", "Email", "Mobile",
}


def norm_reg(value):
    """PDJ-3899, PDJ 3899 and pdj3899 are the same vehicle."""
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def norm_policy(value):
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def clean(value):
    """Salesforce concatenation formulas emit a bare ',' when every part is empty."""
    v = (value or "").strip()
    if v in {",", ", ,", "-", "N/A", "NA", "TBA", "TBD"}:
        return ""
    return v


def clean_client(value):
    """Names arrive as '", Rampersad,Sandra, HH"' — strip the packing."""
    v = clean(value).strip('"').strip()
    v = re.sub(r"^[,\s]+|[,\s]+$", "", v)
    v = re.sub(r"\s*,\s*(HH|H/H)\s*$", "", v, flags=re.I)   # household marker
    parts = [p.strip() for p in v.split(",") if p.strip()]
    if len(parts) >= 2:                                      # "Surname, Given" -> "Given Surname"
        return f"{parts[1]} {parts[0]}".strip()
    return parts[0] if parts else ""


def is_plausible_reg(key):
    """A T&T plate is 5-8 alphanumerics. Chassis numbers (17) and junk are not."""
    return 4 <= len(key) <= 8 and any(c.isdigit() for c in key)


def sort_key(row):
    """Most recent cover end date last, so it wins."""
    return (clean(row.get("To")) or "", clean(row.get("From")) or "")


def main():
    if not os.path.exists(SOURCE):
        sys.exit(f"Cannot find {SOURCE}")

    with open(SOURCE, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))

    by_vehicle = defaultdict(list)
    quarantined = []

    for row in rows:
        key = norm_reg(row.get("Vehicle Reg"))
        if not key:
            continue
        if not is_plausible_reg(key):
            quarantined.append({
                "Value in Vehicle Reg": clean(row.get("Vehicle Reg")),
                "Client": clean_client(row.get("Client")),
                "Policy #": clean(row.get("Policy #")),
                "Why": "17 characters — looks like a chassis number" if len(key) == 17
                       else "no digits — looks like a make or a placeholder" if not any(c.isdigit() for c in key)
                       else f"{len(key)} characters — not a plate",
            })
            continue
        by_vehicle[key].append(row)

    register = []
    for key, group in by_vehicle.items():
        group.sort(key=sort_key)
        current = group[-1]
        merged = {"Reg Key": key}

        for field, source in [
            ("Vehicle Reg", "Vehicle Reg"), ("Policy #", "Policy #"), ("Client", "Client"),
            ("Email", "Email"), ("Mobile", "Mobile"), ("Make", "Make"), ("Model", "Model"),
            ("Year", "Year"), ("Chassis #", "Chassis #"), ("Engine #", "Engine #"),
            ("Coverage Type", "Coverage Type"), ("Insured Value (TT$)", "Insured Value (TT$)"),
            ("Windscreen (TT$)", "Windscreen (TT$)"), ("Carrier", "Carrier"),
            ("Cover From", "From"), ("Cover To", "To"), ("Vehicle Status", "Vehicle Status"),
            ("Years Insured", "Years Insured"),
        ]:
            value = clean_client(current.get(source)) if field == "Client" else clean(current.get(source))
            if not value and field not in CURRENT_WINS:
                # Backfill from any year — this is what recovers chassis and engine numbers.
                for older in reversed(group[:-1]):
                    value = clean(older.get(source))
                    if value:
                        break
            if not value and field in {"Email", "Mobile", "Client"}:
                # Contact details are worth recovering from any year too.
                for older in reversed(group[:-1]):
                    value = clean_client(older.get(source)) if field == "Client" else clean(older.get(source))
                    if value:
                        break
            merged[field] = value

        merged["Policy Key"] = norm_policy(merged["Policy #"])
        register.append(merged)

    register.sort(key=lambda r: (r["Client"].lower(), r["Vehicle Reg"]))

    with open(OUTPUT, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(register)

    if quarantined:
        with open(QUARANTINE, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(quarantined[0].keys()))
            writer.writeheader()
            writer.writerows(quarantined)

    # ── report ──
    total = len(register)
    print(f"{len(rows)} risk rows  ->  {total} distinct vehicles")
    print(f"quarantined: {len(quarantined)} rows whose registration is not a registration\n")

    print("Prefill coverage")
    for field in ["Policy #", "Make", "Model", "Year", "Chassis #", "Engine #",
                  "Coverage Type", "Insured Value (TT$)", "Email", "Mobile"]:
        n = sum(1 for r in register if r[field])
        print(f"  {field:22} {n:4}/{total}  {100 * n // total if total else 0}%")

    # What a claimant would actually experience.
    strong = sum(1 for r in register if r["Make"] and r["Model"] and r["Chassis #"])
    usable = sum(1 for r in register if r["Make"] and r["Model"])
    verifiable = sum(1 for r in register if len(re.sub(r"\D", "", r["Mobile"])) >= 4)
    print(f"\n  full prefill (make + model + chassis)  {strong:4}/{total}  {100 * strong // total if total else 0}%")
    print(f"  usable prefill (make + model)          {usable:4}/{total}  {100 * usable // total if total else 0}%")
    print(f"  can self-verify by mobile              {verifiable:4}/{total}  {100 * verifiable // total if total else 0}%")

    keys = len({r["Reg Key"] for r in register}) + len({r["Policy Key"] for r in register if r["Policy Key"]})
    print(f"\n  {keys} lookup keys (plate + policy number)")
    print(f"\nwrote {OUTPUT}")
    if quarantined:
        print(f"wrote {QUARANTINE}")


if __name__ == "__main__":
    main()
