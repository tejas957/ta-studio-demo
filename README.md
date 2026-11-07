# TA Studio Desk (demo)

A clickable, single-file demo of the TA scheduling workflow for the CS office. Open `index.html` in a browser. No server needed.

**Synthetic data only.** Applicants are fictional aliases from the small dataset in `data/seed.json` (from `ta-scheduler-mvp-dataset`). No PID, SSN or real student information. The demo EIDs (like `ce4103`) are made up so the EID-based GRA check can be tried.

## Presenting (Nov 10, CS department and IT)
Press **Start the guided demo** in the orange bar. It runs Spring 2027 from the very start on the synthetic set, 13 steps, each with **Show me** and **Do it for me**. See `docs/TUESDAY_RUN_SHEET.md` for the talk track and `docs/PRODUCTION_PLAN.md` for what IT is being asked for.

## New in v6 (from the Nov 3 meeting and Doug's Nov 6 email)
- **Two scenarios** (orange bar): *Spring 2027 from the start* (nothing opened yet, for the start-to-finish run) and *Fall 2026 in progress* (the earlier demo state; the tests use it).
- **Guided demo**: a docked panel that walks a whole term: setup → history → windows → professor ranks → office decides → publish → offers → a student answers → replace and re-publish → HR draft → UGCA roster → what IT needs.
- **Graduate / Undergraduate lists** when adding someone who did not apply (Assignments), with search and PhD / Master's groups.
- **Professors say what they want** per person (full-time, half-time, or UGCA hours; "Backup" otherwise) and leave a note to the office. Submitting turns those into requested rows. Undergraduates can be requested in the same list.
- **History** tab: the past UGCA and TA list by semester. Imports Doug's Excel file directly (every tab; header or no header; EIDs cleaned; "fall 23"/"spr 24" read as semesters) or pasted cells. Matching by EID marks each applicant **new or returning**. "Add <term> to the history" appends the published term.
- **Training**: a new UGCA (never one before) needs training; tick it complete on the UGCA roster, or email the new UGCAs.
- **Pay rates per term** (Setup): PhD, master's first time, master's returning, AI, UGCA hourly. Raise all by a percent over last term. A master's student who TA'd in the fall is "returning" in the spring automatically. Rates are placeholders.
- **Graduate records** (History): EID, gender, international, program, imported from the grad office list, used only in the HR draft.
- **HR drafts**: tier, rate, pay, new/return, international, gender, EID and confirmed columns; a column chooser; Copy for Excel; the draft and its email are made automatically on publish (switchable).
- **UGCA roster** tab: replaces the UGCA spreadsheet (assigned to whom, hours, offer sent, confirmed Y, new/returning, training, pay). Copy for Excel uses the spreadsheet's columns.
- **Student offer page**: View as a student with a published offer to accept or decline; the answer lands in Students, the roster and the professor's published plan. Offer emails include pay and the reply link.
- **Remove from pool with a reason** (Applicants): GRA / other support turns blue, anything else red, with an "Add back" undo.
- **Applicants**: new/returning column; "Chose N classes" flag for applications listing more than 10.
- **Navigation**: numbered tabs in the order the work happens, reference pages (History, Mail, Concerns, Audit log) set apart, and a one-line tip on each page (hideable). The Oct 14 checklist moved into a closed panel on the Fall 2026 dashboard.
- **Legacy pull**: requested classes are matched by label, then loosely (ignoring "CS", punctuation, case), then by course number; UGCA requests without an id are matched the same way. The sync file reports how many applicants are linked to a course (Setup → Data source in live mode). The pull no longer reads the SSN field.

## Ask box (Oct 29)
Top right of every admin page (or press `/`): type what you want to do. On the published page, Claude matches it against a fixed catalog of what TA Studio and the legacy app can do (`ASK` in `build/template.html`) and answers in one line with "Take me there" or a link to the legacy page. If neither does it, it gives the quickest workaround and saves the request with a feature idea for Tejas (Setup > Requests from the Ask box; stored in the page's `requests` collection). Claude is sent the question and the catalog only, never student data. In a local copy, or if Claude is not allowed, keyword matching answers and a request can be copied instead. Add a catalog entry whenever a feature is added.

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
# If the copied cookie is refused (the UTCS sign-in ties it to the browser), pull from inside the signed-in tab instead:
pbcopy < scraper/browser-dump.js   # paste into DevTools > Console on any TA admin page; downloads ~/Downloads/legacy-dump.json (GET only)
npm run sync:dump                  # parses that file offline into sync/payload.json
npm run test:live   # mock site -> scraper -> app, end to end
```
Open the app, go to Setup, and choose the file under "Load a sync file". Loading a newer file later keeps the office's work.

Legacy colors in the app: yellow = commitment student (must place, raises a "Must place" warning, counted as a PhD), blue = has a GRA (excluded like the grant-admin list), red = declined or graduated (excluded; a refresh reports who turned red).

## Develop
```
npm install
npm run build   # template.html + data/seed.json -> index.html
npm test        # jsdom tests: tests/smoke.js and tests/nov.js
```
The only expected jsdom message is the unimplemented `scrollTo`.

See `docs/INTEGRATION.md` for the integration seam, the assumptions, and the open decisions.
