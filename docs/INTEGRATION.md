# Integration prep (v3)

This is the groundwork for connecting the demo to the existing TA app. It is **not** the roadmap. The roadmap comes after the v3 details are settled with Doug and Eric.

## Principle: pull only

The new tool reads from the legacy app and never writes back (agreed with Eric on Oct 6). Everything Doug needs downstream (HR spreadsheet, student emails, professor emails) has to be produced here.

## The seam in the code

All applicant and course data enters through one place, so the synthetic data can be swapped for scraped data without touching the views.

| Piece (in `build/template.html`) | What it does today | What replaces it |
|---|---|---|
| `SEED` (from `data/seed.json`) | Eric's small synthetic dataset | A payload built from the legacy app |
| `ingest(payload)` | Adds new applicants, preferences, skills, coursework and history after load | The same function, called by a real sync |
| `LEGACY_FEED` | Two fake "late" applicants for the Refresh button | A real pull of new applicants |
| `removeAdded()` | Undoes a sync on Reset | Not needed in production |
| `EXT` | Fields the dataset does not have (see below) | Real fields from the application form or legacy app |

### Payload shape

Same tables and column names as `ta-scheduler-mvp-dataset`, plus one extra key:

```
{ applicants:[], applications:[], course_preferences:[], applicant_skills:[],
  applicant_coursework:[], teaching_history:[],
  ext:{ "<application_id>": { cit, ita, sup, area, intern, tex, yr, hrs } } }
```

## Fields the demo adds beyond Eric's dataset

All values in the demo are invented. Where each would really come from is a guess to confirm.

| Field | Used for | Likely source |
|---|---|---|
| `cit` citizenship | HR spreadsheet, office-only | Application form or legacy app (Doug says it is recorded but not exported) |
| `ita` ITA workshop or English test status | Warning on assignment | Legacy app or application form |
| `sup`, `area` supervisor, research area | Applicant card for faculty and office | Grad application form (new question) |
| `intern` resume summary | Applicant card | Grad application form (resume upload, new) |
| `tex` teaching experience wanted | Applicant card | Grad application form |
| `yr`, `hrs` class year, hours per week | UGCA applicant card | UGCA application form |
| Course `aud` and `slots` (TA, UGCA, Proctor) | Who sees a course, how many of each | Legacy "edit class" screen |
| Transcript checked | Office checkbox | Created here by the office |
| HR tier | HR spreadsheet | Computed here (rule below) |

## One place for each job (v3.1 cleanup)

- **Email:** one outbox (`queueOut`) for professors, students and HR.
- **HR output:** the HR drafts tab only. The old per-version CSV on Publish is gone. Publish versions and HR drafts cross-link when they match.
- **Windows:** faculty and student windows use the same words: open, extend, close.
- **GRA:** the Applicants tab manages the flag. The course row has the same button for in-context add-back. The queue list only links out.
- **Issues:** one renderer for the Dashboard and course views. Publish shows a summary and links.

## Rules the demo assumes (confirm with Doug)

- **HR tier:** PhD; master's with a prior TA term = Masters 1 (returning); other master's = Masters 2; undergraduate = UGCA. The office can override per student.
- **HR draft contents:** only accepted assignments. Each draft is numbered and compared with the one before it: added (green), removed (red), changed (yellow).
- **GRA:** matched students are flagged and blocked, but stay visible and can be added back with one click. A later re-run of the list does not re-flag someone who was added back.
- **Student response window:** must be open before students are notified. New versions start closed.
- **Course audience:** a student who is not allowed on a course is hidden from its pool. An existing assignment for them blocks publishing.

## Mocked in v3 (nothing real happens)

- Email to professors, students and HR. Everything is drafted into one outbox (the Mail tab) and marked queued, not sent. A real sender would work from that same outbox.
- Reading professor replies from a mailbox ("Mock reply" button).
- The legacy app refresh.
- Sign-in. The role switcher is not security.

## Decisions to settle before the roadmap

1. Who may see citizenship and EID? The PRD excludes both, Doug needs them in the HR output.
2. Does Eric scrape on demand, on a schedule, or from an export file? What does the legacy app expose?
3. How are students matched across systems (GRA list is by EID today)? Where is that key stored?
4. Where does this run (hosting, login, data retention)? Who approves storing citizenship?
5. Which email account sends mail, and who approves it?
6. Real HR spreadsheet columns and tier rules (need a sample from Doug).
7. Do TAs and UGCAs share one course queue or have separate slot counts? (Demo: separate slots, one workspace.)
8. Is "accepted only" the right content for an HR draft?

## Needed from Doug and Eric

- Doug: a sample HR spreadsheet (names removed), the tier rules, and a login for Eric to the legacy app (about half an hour to set up).
- Eric: how the scrape will run, and what fields it can reach.
