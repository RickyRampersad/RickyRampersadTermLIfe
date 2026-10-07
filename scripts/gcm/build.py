#!/usr/bin/env python3
"""
Group Client Management build - Ricky Rampersad Branch (Branch 26000)

Pulls open and completed Salesforce tasks for every group client in the register,
then writes code-locked pages into /groupclientmanagement:
  index.html          staff page (one code per staff member)
  client.html         the clients' door: a client types their code and is taken to their page
  <slug>.html         one page per client (one code per client)

The register (group names, Salesforce match words, client contacts) is client
data, so it never sits in this repository: the site publishes the repository
root. It comes from the GCM_CLIENTS secret, or from --clients pointing at a file
outside the repository.

Secrets come from environment variables, never from the repository:
  SF_DOMAIN           e.g. rickyrampersadbranch.my.salesforce.com
  SF_CLIENT_ID        connected app consumer key
  SF_CLIENT_SECRET    connected app consumer secret
  GCM_CODES           JSON: {"clients": {"<slug>": "CODE"}, "staff": {"Name": "CODE"}}
  GCM_CLIENTS         the register, as JSON (see README.md for its shape)
  GCM_BASE_URL        e.g. https://rickyrampersadbranch.com/groupclientmanagement

Local test without Salesforce:  python build.py --clients reg.json --fixture fixture.json --out /tmp/gcm
Build from a saved Salesforce pull (the SOQL in fetch(), every group at once):
                                python build.py --clients reg.json --records tasks.json
"""
import argparse, base64, datetime as dt, hashlib, json, os, re, sys, urllib.parse, urllib.request
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
API = "v60.0"
ITER = 310000
TZ = dt.timezone(dt.timedelta(hours=-4))  # Trinidad and Tobago
MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

# ---------- Salesforce ----------
def sf_login():
    domain = os.environ["SF_DOMAIN"].replace("https://", "").strip("/")
    body = urllib.parse.urlencode({"grant_type": "client_credentials",
        "client_id": os.environ["SF_CLIENT_ID"], "client_secret": os.environ["SF_CLIENT_SECRET"]}).encode()
    with urllib.request.urlopen(urllib.request.Request(f"https://{domain}/services/oauth2/token", data=body)) as r:
        tok = json.load(r)
    return tok["instance_url"], tok["access_token"]

def sf_query(inst, token, soql):
    url, out = f"{inst}/services/data/{API}/query?q={urllib.parse.quote(soql)}", []
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as r:
            res = json.load(r)
        out += res["records"]
        url = inst + res["nextRecordsUrl"] if res.get("nextRecordsUrl") else None
    return out

def client_filter(c):
    q = lambda s: s.replace("\\", "\\\\").replace("'", "\\'")
    parts = [f"What.Name LIKE '%{q(p)}%' OR Subject LIKE '%{q(p)}%'" for p in c["match"]]
    if c.get("accountIds"):
        parts.append("WhatId IN (" + ",".join(f"'{a}'" for a in c["accountIds"]) + ")")
    return "(" + " OR ".join(parts) + ")"

FIELDS = "Id, Subject, Type, Status, ActivityDate, CreatedDate, CompletedDateTime, LastModifiedDate, Owner.Name, Who.Name, What.Name, What.Type"

def fetch(c, inst, token, year):
    f = client_filter(c)
    open_ = sf_query(inst, token, f"SELECT {FIELDS}, WhatId FROM Task WHERE IsClosed = false AND {f} ORDER BY ActivityDate ASC NULLS LAST LIMIT 500")
    done = sf_query(inst, token, f"SELECT {FIELDS}, WhatId FROM Task WHERE IsClosed = true AND CreatedDate >= {year}-01-01T00:00:00Z AND {f} LIMIT 2000")
    return [t for t in open_ if matches(t, c)], [t for t in done if matches(t, c)]

def matches(t, c):
    """SOQL LIKE finds a match word anywhere, inside other words too: a group whose
    match word is five letters of "electrocardiogram" was given another person's
    medical requirement, name and policy number. So every task the query returns is
    kept only when it sits on one of the group's own accounts, or a match word
    starts a word in its subject or its record's name. A single match word must
    also end one ("ACME" never matches "Acmeline"); a name of several words may
    run on ("ACME & CO" matches "ACME & COMPANY")."""
    if t.get("WhatId") and t["WhatId"][:15] in {a[:15] for a in c.get("accountIds", [])}:
        return True
    text = " ".join([t.get("Subject") or "", nm(t, "What")])
    def hit(w):
        end = "" if re.search(r"\s", w.strip()) else r"(?![A-Za-z0-9])"
        return re.search(r"(?<![A-Za-z0-9])" + re.escape(w.strip()) + end, text, re.I)
    return any(hit(w) for w in c["match"])

def from_records(records, c, year):
    """The same split as fetch(), over a saved pull of every group's tasks at once."""
    mine = [t for t in records if matches(t, c)]
    open_ = sorted([t for t in mine if not t.get("IsClosed")], key=lambda t: t.get("ActivityDate") or "9999")
    done = [t for t in mine if t.get("IsClosed") and (t.get("CreatedDate") or "") >= f"{year}-01-01"]
    return open_, done

# ---------- shaping ----------
def nm(rec, key):
    v = rec.get(key)
    return (v or {}).get("Name", "") if isinstance(v, dict) else ""

def category(t):
    s = (t.get("Subject") or "").upper()
    if re.search(r"T-\s*LIFE|GROUP LIFE", s): return "Group Life"
    if re.search(r"T-\s*HEALTH|GROUP HEALTH", s): return "Group Health"
    if re.search(r"PENSION", s): return "Group Pensions"
    if re.search(r"AUDIT|CONFIRMATION", s): return "Audit and confirmations"
    if re.search(r"ENROL|JOINER|NEW MEMBER", s): return "Member enrolments"
    if re.search(r"TERMINAT|RESIGN|LEAVER", s): return "Member terminations"
    if re.search(r"CLAIM", s): return "Claims"
    return t.get("Type") or "Other service items"

ORDER = ["Group Life","Group Health","Group Pensions","Member enrolments","Member terminations","Claims","Audit and confirmations"]

def title(t, client_names):
    s = t.get("Subject") or ""
    m = re.search(r"T-\s*(LIFE|HEALTH|PENSIONS)\s*GROUP-?\s*(Renewal|Billing)\s*Date\s*-\s*(\d{1,2})/(\d{1,2})/(\d{4})", s, re.I)
    if m:
        kind = {"LIFE":"Group Life","HEALTH":"Group Health","PENSIONS":"Group Pensions"}[m.group(1).upper()]
        what = "renewal billing" if m.group(2).lower() == "renewal" else "billing"
        return f"{kind} {what}, {MONTHS[int(m.group(3))-1]} {m.group(5)}"
    s = re.sub(r"^(DRAFT:|URGENT:)\s*", "", s, flags=re.I)
    for n in client_names:
        s = re.sub(re.escape(n), "", s, flags=re.I)
    s = re.sub(r"\s*[-–|]\s*$", "", re.sub(r"\s{2,}", " ", s)).strip(" -–|")
    return s[:1].upper() + s[1:] if s else "Service item"

STATUS = {"waiting on someone else": "Awaiting your confirmation", "not started": "Scheduled",
          "in progress": "In progress with us", "deferred": "On hold"}

def done_text(cat, status):
    st = (status or "").lower()
    if cat in ("Group Life","Group Health","Group Pensions"):
        return ("Billing prepared and issued to you. Waiting for your confirmation." if "waiting" in st
                else "Billing being reconciled by our team before it is confirmed with you.")
    if cat == "Audit and confirmations":
        return "Request received. Our team is preparing the confirmation."
    if "waiting" in st:
        return "Our part is complete. Waiting for information or confirmation from you."
    return "Our team is working on this item."

# An employer sees its plan's administration, never a member's health: an item that
# names a medical requirement, a claim or a diagnosis stays on the staff page and is
# left off the client's. Extend it in the register with "privateSubjectPatterns".
PRIVATE = [r"MEDICAL", r"CLAIM", r"DIAGNOS", r"HOSPITAL", r"SURGER", r"CARDIO", r"\bECG\b", r"\bLAB\b", r"BLOOD", r"PRESCRIPTION", r"DOCTOR", r"\bAPS\b", r"\bPMAR\b"]

def private(t, cfg):
    s = t.get("Subject") or ""
    return any(re.search(p, s, re.I) for p in PRIVATE + cfg.get("privateSubjectPatterns", []))

# A copy of an e-mail that Salesforce logged as a task ("Email: ...") is not a piece of
# work: it closes the moment it is logged. Over 2026 they were 615 of the groups'
# 1,176 completed tasks, so counting them would show a client an on-time record of
# nearly 100% that the work itself does not have. The automatic birthday e-mail is
# the same, and its subject is the flow's own template ("$Record.FirstName"): most of
# one group's completed items were birthday wishes to its staff.
LOGGED_MAIL = r"^\s*(<p>)?\W*(Email|Re|Fwd?)\s*:|\$Record\.|Happy Birthday"

def excluded(t, c, cfg):
    s = t.get("Subject") or ""
    if re.search(LOGGED_MAIL, s, re.I): return True
    if (t.get("Type") or "") in cfg.get("excludeTypes", []): return True
    return any(re.search(p, s, re.I) for p in cfg.get("excludeSubjectPatterns", []) + c.get("excludeSubjectPatterns", []))

def d(s): return s[:10] if s else None

def shape(c, open_, done, cfg):
    names = [c["name"]]
    groups = {}
    for t in open_:
        if excluded(t, c, cfg): continue
        cat = category(t)
        groups.setdefault(cat, []).append({
            "id": t["Id"], "title": title(t, names),
            "ref": nm(t, "What") if (t.get("What") or {}).get("Type") == "TRANSACTIONS__c" else "",
            "for": nm(t, "Who") or c.get("primaryContactName", ""), "by": nm(t, "Owner"),
            "status": STATUS.get((t.get("Status") or "").lower(), "In progress with us"),
            "opened": d(t.get("CreatedDate")), "dueISO": d(t.get("ActivityDate")),
            "done": done_text(cat, t.get("Status")), "private": private(t, cfg)})
    ordered = [{"name": k, "items": groups[k]} for k in ORDER if k in groups] + \
              [{"name": k, "items": v} for k, v in groups.items() if k not in ORDER]
    rec = {}
    for t in done:
        if excluded(t, c, cfg): continue
        cat = category(t); r = rec.setdefault(cat, {"completed": 0, "onTime": 0, "days": 0})
        fin = d(t.get("CompletedDateTime") or t.get("LastModifiedDate")); start = d(t.get("CreatedDate")); due = d(t.get("ActivityDate"))
        r["completed"] += 1
        if fin and (not due or fin <= due): r["onTime"] += 1
        if fin and start: r["days"] += max(0, (dt.date.fromisoformat(fin) - dt.date.fromisoformat(start)).days)
    rows = []
    for k in ORDER + [k for k in rec if k not in ORDER] + [g["name"] for g in ordered]:
        if any(r["type"] == k for r in rows) or (k not in rec and k not in groups): continue
        r = rec.get(k, {"completed": 0, "onTime": 0, "days": 0})
        rows.append({"type": k, "completed": r["completed"], "onTime": r["onTime"],
                     "avgDays": round(r["days"] / r["completed"]) if r["completed"] else 0,
                     "open": len(groups.get(k, []))})
    return ordered, rows

# ---------- crypto ----------
b64 = lambda b: base64.b64encode(b).decode()
norm = lambda code: "".join(ch for ch in code.upper() if ch.isalnum())
def kdf(code, salt): return PBKDF2HMAC(hashes.SHA256(), 32, salt, ITER).derive(norm(code).encode())

def lock_single(obj, code):
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(kdf(code, salt)).encrypt(iv, json.dumps(obj, separators=(",", ":")).encode(), None)
    return {"salt": b64(salt), "iv": b64(iv), "ct": b64(ct), "iter": ITER}

def lock_multi(obj, codes):
    key, iv = os.urandom(32), os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(obj, separators=(",", ":")).encode(), None)
    wraps = []
    for name, code in codes.items():
        salt, wiv = os.urandom(16), os.urandom(12)
        inner = json.dumps({"k": b64(key), "who": name}).encode()
        wraps.append({"salt": b64(salt), "iv": b64(wiv), "ct": b64(AESGCM(kdf(code, salt)).encrypt(wiv, inner, None))})
    return {"iter": ITER, "iv": b64(iv), "ct": b64(ct), "wraps": wraps}

# ---------- main ----------
def fmt_long(day): return f"{day.day} {MONTHS[day.month-1]} {day.year}"

def door_key(code):
    """What the clients' door looks a code up by: a hash of its first four characters,
    so the door page does not list the groups' prefixes in readable form."""
    return hashlib.sha256(norm(code)[:4].encode()).hexdigest()[:16]

def load_register(path):
    if path: return json.load(open(path))
    if os.environ.get("GCM_CLIENTS"): return json.loads(os.environ["GCM_CLIENTS"])
    local = os.path.join(HERE, "clients.json")   # git-ignored, for a build on one's own machine
    if os.path.exists(local): return json.load(open(local))
    sys.exit("No register: set GCM_CLIENTS or pass --clients <file outside the repository>.")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", help="JSON file of Salesforce records keyed by client slug, for offline testing")
    ap.add_argument("--records", help="a saved Salesforce pull of every group's tasks ({records:[...]} or a list)")
    ap.add_argument("--clients", help="the register, from a file outside the repository")
    ap.add_argument("--out", default=os.path.join(ROOT, "groupclientmanagement"))
    a = ap.parse_args()

    cfg = load_register(a.clients)
    codes = json.loads(os.environ.get("GCM_CODES", "{}"))
    base = os.environ.get("GCM_BASE_URL", cfg.get("baseUrl", "")).rstrip("/")
    today = dt.datetime.now(TZ).date()
    respond_by = today + dt.timedelta(days=(4 - today.weekday()) % 7 or 7)  # next Friday
    client_tpl = open(os.path.join(HERE, "templates", "client.html")).read()
    staff_tpl = open(os.path.join(HERE, "templates", "staff.html")).read()
    door_tpl = open(os.path.join(HERE, "templates", "door.html")).read()

    if a.fixture: fx = json.load(open(a.fixture))
    elif a.records:
        recs = json.load(open(a.records)); recs = recs.get("records", recs) if isinstance(recs, dict) else recs
    else: inst, token = sf_login()

    os.makedirs(a.out, exist_ok=True)
    staff_clients, problems, door = [], [], {}
    for c in cfg["clients"]:
        if not c.get("enabled", True): continue
        code = codes.get("clients", {}).get(c["slug"])
        if not code:
            # Slug only: on a public repository the Actions log is public too.
            problems.append(f"No access code for {c['slug']}; page not built."); continue
        door.setdefault(door_key(code), []).append(c["slug"])
        if a.fixture:
            open_, done = fx.get(c["slug"], {}).get("open", []), fx.get(c["slug"], {}).get("done", [])
        elif a.records:
            open_, done = from_records(recs, c, today.year)
        else:
            open_, done = fetch(c, inst, token, today.year)
        groups, rows = shape(c, open_, done, cfg)
        page = {"client": c["name"], "asAt": fmt_long(today), "respondBy": f"Friday {fmt_long(respond_by)}",
                "sendTo": cfg["responseInbox"], "cc": cfg["responseCc"], "groups": groups,
                "record": {"period": f"January to {fmt_long(today)}", "rows": rows}, "sample": False}
        shown = [{"name": g["name"], "items": [i for i in g["items"] if not i["private"]]} for g in groups]
        left = {g["name"]: len(g["items"]) for g in shown}
        rows_c = [{**r, "open": left.get(r["type"], 0)} for r in rows]
        mine = {**page, "groups": [g for g in shown if g["items"]],
                "record": {**page["record"], "rows": [r for r in rows_c if r["completed"] or r["open"]]}}
        html = client_tpl.replace("__PAYLOAD__", json.dumps(lock_single(mine, code))).replace("__SLUG__", c["slug"])
        open(os.path.join(a.out, f"{c['slug']}.html"), "w").write(html)
        staff_clients.append({**page, "slug": c["slug"], "link": f"{base}/{c['slug']}.html", "code": code,
                              "to": c.get("to", []), "ccClient": c.get("cc", []), "greeting": c.get("greeting", "")})

    staff_codes = codes.get("staff", {})
    if not staff_codes:
        problems.append("No staff codes in GCM_CODES; staff page not built.")
    else:
        staff = {"builtAt": dt.datetime.now(TZ).strftime("%d %b %Y, %I:%M %p").lstrip("0"), "branch": cfg["branch"],
                 "responseInbox": cfg["responseInbox"], "clients": staff_clients}
        html = staff_tpl.replace("__PAYLOAD__", json.dumps(lock_multi(staff, staff_codes)))
        open(os.path.join(a.out, "index.html"), "w").write(html)

    for k, v in door.items():
        if len(v) > 1: problems.append(f"Codes for {', '.join(v)} start with the same four characters; the door opens only the first. Give one a new code.")
    open(os.path.join(a.out, "client.html"), "w").write(door_tpl.replace("__DOOR__", json.dumps(door, sort_keys=True)))

    for p in problems: print("WARNING:", p, file=sys.stderr)
    print(f"Built {len(staff_clients)} client page(s) into {a.out}")

if __name__ == "__main__":
    main()
