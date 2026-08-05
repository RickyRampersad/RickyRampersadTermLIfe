# DNS Backup — rickyrampersadbranch.com

Saved on 2026-08-05, before switching the domain from the GoDaddy Website
Builder site to the new GitHub Pages site.

## The record that was removed (the old website connection)

| Type | Name | Data                | TTL    |
|------|------|---------------------|--------|
| A    | @    | WebsiteBuilder Site | 1 Hour |

This single record was what pointed rickyrampersadbranch.com at the old
GoDaddy "Websites + Marketing" builder site. The builder site itself was
NOT deleted — it remains in the GoDaddy account.

## How to bring the old site back (if ever wanted)

1. Log in to godaddy.com → My Products → Websites + Marketing
2. Open the old website → Settings → Domain
3. Connect the domain rickyrampersadbranch.com — GoDaddy recreates the
   "WebsiteBuilder Site" record automatically.
4. Delete the four GitHub Pages A records listed below (Name @).

## The records that replaced it (the new GitHub Pages site)

| Type  | Name | Data                      |
|-------|------|---------------------------|
| A     | @    | 185.199.108.153           |
| A     | @    | 185.199.109.153           |
| A     | @    | 185.199.110.153           |
| A     | @    | 185.199.111.153           |
| CNAME | www  | rickyrampersad.github.io  |

## Records left untouched (email and other services — do not modify)

| Type  | Name              | Data                                     |
|-------|-------------------|------------------------------------------|
| NS    | @                 | ns55.domaincontrol.com.                  |
| NS    | @                 | ns56.domaincontrol.com.                  |
| CNAME | autodiscover      | autodiscover.outlook.com.                |
| CNAME | bounces.cloud2.em | cbounces.cloud2.em.secureserver.net.     |
| CNAME | bounces.em        | cbounces.em.secureserver.net.            |
| CNAME | calendar          | calendar.secureserver.net.               |
| CNAME | email             | email.secureserver.net.                  |
| CNAME | fax               | fax.secureserver.net.                    |
| CNAME | files             | files.secureserver.net.                  |

(The full DNS zone had 34 records; the rest were not part of the website
switch. The NS, autodiscover and secureserver records run email/calendar
services and must never be changed as part of website work.)
