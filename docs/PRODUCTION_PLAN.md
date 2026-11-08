# TA Studio: path to production (for the meeting with CS IT)

Prepared for the meeting with Doug and Dan Machold (CS IT), Tuesday, November 10, 2026. The 3-minute version is the "TA Studio: 3-Minute Pitch" deck; this page has the detail behind it.

## What exists today

- **TA Studio demo** (`index.html`): one self-contained page. It runs the whole staffing cycle on synthetic data: the office sets up the term, professors rank, the office decides, publishes, sends offers, collects accepts and declines, builds the HR draft and keeps the UGCA roster. Nothing is stored on a server and no email is sent.
- **Read-only pull from the legacy TA app** (`scraper/`): reads the admin pages (classes, applicants, detail pages, the HR draft table) and writes one JSON file in the app's own shape. It sends only GET requests and has been tested against a mock copy of the legacy site (`mock-legacy/`). With the real site it currently needs a copied browser session, which is fragile. That is the main thing a production version should replace.
- **Tests**: `npm test` (smoke and Nov 3 features, jsdom) and `npm run test:live` (mock site → pull → app).

## How it fits the current TA app

```
Students and professors ──apply / set classes──▶ Legacy TA app (apps.cs.utexas.edu/taproc)
                                                  stays the official record: applications,
                                                  classes, TA history, official removals
                                                        │  read only, nothing written back
                                                        ▼
                                                  TA Studio
                                                  rankings, decisions, published versions,
                                                  offers and replies, HR draft, UGCA roster,
                                                  UGCA/TA history
                                                        │  email + spreadsheets
                                                        ▼
                                          Professors · Students · HR (sheet in Box)
```

- Nothing changes for applicants: they keep applying on the TA app's forms.
- TA Studio never writes to the TA app. Anything we need to know about an applicant is asked on the TA app's form and reaches us through the read.
- Today the read goes through the TA app's admin pages (HTML, GET only). In production it should be a database view or a small read-only API that IT approves. The app has one entry point for this data (`ingest` / the sync payload), so changing how we read does not touch the screens.

## Security

**Now (demo):**
- Synthetic students only. Nothing is stored on a server; state lives in the browser page and resets on reload. No email is sent; everything sits in a Mail tab.
- The TA app reader sends only GET requests and has a guard that refuses any form submit or POST (tested against a mock copy of the site).
- SSNs and PIDs are never read. Real student data never goes into GitHub; test fixtures use fake names, EIDs, emails and phones.
- Imported spreadsheets (the UGCA history, the graduate records) stay in the page's memory only.

**In production:**
- **Sign-in:** UT EID through CS's sign-in system. Three roles: the office sees everything; a professor sees only their own classes and the applicants to them; a student sees only their own offer.
- **Hosting:** a CS server or VM inside the department network, HTTPS only.
- **Storage:** an encrypted database (at rest and in transit), daily backups, and an audit log of every change (who, what, when). The demo already keeps that log.
- **TA app access:** a read-only service account or view, with credentials in the server's secret store, never in the code or the repo.
- **Data minimization:** read only the fields the tool uses. Citizenship, international status and gender are office-only and appear only in the HR draft.
- **Review:** IT reviews the code and the data-access spec before the tool touches real data. Retention and logging follow CS policy.

## What we are asking IT for

| # | Need | Why | Options |
|---|---|---|---|
| 1 | **Read access to the TA app's data** | Today the pull reads HTML pages with a copied session. Page layout changes break it, and it cannot run on a schedule. | (a) A read-only database view or replica of the applicant, class, request and assignment tables. (b) A small read-only JSON endpoint in the TA app. (c) A copy of the TA app's code, so we can write (a) or (b) and you review it. Dan's earlier idea of moving it to a server where access can be granted fits here. |
| 2 | **Hosting** | A place to run the web app and its database. | A department VM or container host, behind the CS network. The app is a static front end plus a small API. |
| 3 | **Sign-in with UT EID** | Three kinds of users: the office (admin), professors (only their classes), students (only their own offer). | UT's single sign-on (Shibboleth/SAML or whatever CS uses for its web apps). Roles come from the course list (professor) and the published offers (student). |
| 4 | **Email sending** | Window notices, reminders, offers, résumé requests and HR drafts are already drafted in the tool. | A department sender account or relay the app may use, plus a shared mailbox to read replies (optional, later). |
| 5 | **Encrypted database** | The term's work (rankings, decisions, versions, replies) and the multi-year UGCA/TA history live here. | Postgres (or what CS already runs) with encryption at rest, daily backups, and access limited to the app. |
| 6 | **A data-access decision** | The HR draft carries citizenship, international status and gender. | Decide who may see them. Today only the office role sees them, never professors or students. |

## Data the tool holds

- From the legacy app (read only): applicant names, EIDs, emails, program, degree level, requested classes, language skills, coursework, TA history, row colors (commitment, GRA, declined).
- Created in the tool: rankings and comments, office decisions, published versions, student replies, résumé requests, notes.
- Imported by the office: the past UGCA/TA list (name, EID, semester) and the graduate student list (EID, gender, international status, program).
- **Not stored:** SSNs or PIDs. The pull ignores those fields.

## Next actions

| Who | Action | When |
|---|---|---|
| Dan / IT | Pick the data-access option (view, read-only API, or code access) and a host; name one contact | Proposed: Nov 20 |
| Dan / IT | Share CS's requirements for a new web app (security review, sign-in, logging, retention) | With the above |
| Doug | Send the column headers of the UGCA sheet (tab 1), grad TA HR sheet (tab 3) and grad student list (tab 4), plus this year's pay rates | Proposed: Nov 17 |
| Doug | Decide who may see citizenship, international status and gender | Before the pilot |
| Tejas | Share the repository with IT for review; write a one-page spec of every field TA Studio reads | When a contact is named |
| Tejas + IT | Connect to the agreed data source; add EID sign-in and the database | After access |
| Doug + Tejas | Pilot one term's UGCA roster and HR draft beside the current spreadsheet | Term to agree |

## Proposed phases

1. **Access and hosting** (needs 1, 2): read-only data access, a host, a repository IT can see (the code is on GitHub today).
2. **Sign-in and storage** (needs 3, 5): replace the in-page state with the database; office-only first.
3. **Pilot with the office** for one term's UGCAs: roster, history, HR draft. Email still copied by hand.
4. **Professors and students**: ranking windows and offer pages with sign-in; turn on sending (need 4).
5. **Retire the spreadsheets**: the UGCA roster and HR draft replace the Box spreadsheet.

## Open questions for Dan

- Which of options 1(a), 1(b), 1(c) is acceptable, and who would review code that touches the TA app?
- Where should it be hosted, and what does CS require for a new web app (security review, logging, retention)?
- Which sign-in system should a CS-internal tool use?
- Is there a department email relay an app may send from?
