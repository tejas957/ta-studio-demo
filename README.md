# TA Studio Desk (demo)

A clickable, single-file demo of the TA scheduling workflow for the CS office. Open `index.html` in a browser. No server needed.

**Synthetic data only.** Applicants are fictional aliases from the small dataset in `data/seed.json` (from `ta-scheduler-mvp-dataset`). No PID, EID, SSN or real student information.

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
npm run test:live   # mock site -> scraper -> app, end to end
```
Open the app, go to Setup, and choose the file under "Load a sync file". Loading a newer file later keeps the office's work.

Legacy colors in the app: yellow = commitment student (must place, raises a "Must place" warning), blue = has a GRA (excluded like the grant-admin list), red = declined or graduated (excluded).

## Develop
```
npm install
npm run build   # template.html + data/seed.json -> index.html
npm test        # jsdom smoke test
```
The only expected jsdom message is the unimplemented `scrollTo`.

See `docs/INTEGRATION.md` for the integration seam, the assumptions, and the open decisions.
