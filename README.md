# TA Studio Desk (demo)

A clickable, single-file demo of the TA scheduling workflow for the CS office. Open `index.html` in a browser. No server needed.

**Synthetic data only.** Applicants are fictional aliases from the small dataset in `data/seed.json` (from `ta-scheduler-mvp-dataset`). No PID, SSN or real student information. The demo EIDs (like `ce4103`) are made up so the EID-based GRA check can be tried.

## New in v5 (from the Oct 14 walkthrough with Doug)
- Appointments: UGCAs in hours per week (any number, up to 20; a full UGCA is 15). TAs and AIs are full-time or half-time. HR output lists hours for UGCAs.
- Roles are TA, AI and UGCA. "Proctor" (the old name for UGCA) is gone. Two half-time AIs can co-teach a class.
- Course need is TA FTE + AI FTE + UGCA hours (Setup).
- GRA cross-check matches on EID first; name-only matches are listed separately for a second look.
- Commitment students (yellow / the Commitment students page) are treated as PhDs even if they applied as master's, and must be placed.
- A refresh from the legacy app reports anyone who turned red (declined) and blocks their assignment.
- Applicant card lists every course applied for, in the student's order, with the discussion-section choice (office only). The workspace labels "Student's choice" and "Professor's rank".
- Request résumé (one student or everyone without one), with the reply's attachment pulled onto the card (mock). UGCA résumés come from the legacy form.
- Email applicants: one message to everyone in a filter, or to one student from their card.
- Professors can browse all applicants (switch on Faculty windows, per professor too). They see names and qualifications only, never course choices. Their picks show as "Did not apply, picked by <professor>".
- Course list CSV import (Setup): blank GUIDs are filled in from the term (2026-9-1, 2026-9-2, ...); re-importing adds new classes and updates changed ones.

## What it shows (v3)
- Admin: dashboard, faculty ranking windows, assignments workspace, applicants and GRA cross-check, versioned publishing with gating, student notification tracking, concerns, audit log
- Faculty: ranking their own course only, backups, submit, published plan, concerns
- Faculty windows: open, extend or close a window for one professor or all, a response tracker with a copyable CSV, notifications, and a mock professor email reply
- Mail: one outbox for every email the tool would send (professors, students, HR) plus a mock inbox
- HR drafts (the single HR export): numbered drafts with added/removed/changed rows, an estimated HR tier, spreadsheet text and email text
- Setup: per-course audience (graduate, undergraduate, both) and slots by role, plus the different application questions for graduate and undergraduate applicants
- Applicants (read from the legacy TA app, where they apply): TA / UGCA / Both toggle, grad and UGCA intake details, transcript check, GRA "add back to pool", and a mock Refresh from the legacy app
- Students: the response window must be open before students are notified, with per-student extensions

## Not connected
- **Email is not sent.** Windows, reminders, HR drafts and student notices only draft the text.
- The legacy app link and the mailbox are mocked.
- Everything lives in memory and resets on reload.
- CSV output is copy-only.

## Live mode (read-only sync from the legacy app)
The app can load a sync file made by the scraper. In live mode it shows the legacy applicants, classes, assignments and colors instead of the synthetic set. Nothing is written back and no email is sent.
```
npm run mock        # fake legacy site on http://127.0.0.1:8787/taproc/index.php (fake data only)
npm run sync:mock   # scrapes the fake site into samples/mock-payload.json (committed, fake)
npm run sync        # REAL app: needs LEGACY_COOKIE (see docs/LEGACY_APP_MAP.md); writes sync/payload.json (git-ignored)
npm run sync:lean   # REAL app, courses and applicants only (no assignments, HR draft or professor emails)
npm run test:live   # mock site -> scraper -> app, end to end
```
Open the app, go to Setup, and choose the file under "Load a sync file". Loading a newer file later keeps the office's work.

Legacy colors in the app: yellow = commitment student (must place, raises a "Must place" warning, counted as a PhD), blue = has a GRA (excluded like the grant-admin list), red = declined or graduated (excluded; a refresh reports who turned red).

## Develop
```
npm install
npm run build   # template.html + data/seed.json -> index.html
npm test        # jsdom smoke test
```
The only expected jsdom message is the unimplemented `scrollTo`.

See `docs/INTEGRATION.md` for the integration seam, the assumptions, and the open decisions.
