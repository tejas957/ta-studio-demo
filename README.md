# TA Studio Desk (demo)

A clickable, single-file demo of the TA scheduling workflow for the CS office. Open `index.html` in a browser. No server needed.

**Synthetic data only.** Applicants are fictional aliases from the small dataset in `data/seed.json` (from `ta-scheduler-mvp-dataset`). No PID, EID, SSN or real student information.

## What it shows (v3)
- Admin: dashboard, faculty ranking windows, assignments workspace, applicants and GRA cross-check, versioned publishing with gating, student notification tracking, concerns, audit log
- Faculty: ranking their own course only, backups, submit, published plan, concerns
- Faculty windows: open a window for one professor or all, queued email text, notifications, a response tracker with a copyable CSV, and a mock professor email reply
- HR drafts: numbered drafts with added/removed/changed rows, an estimated HR tier, spreadsheet text and email text
- Setup: per-course audience (graduate, undergraduate, both) and slots by role, plus the different application questions for graduate and undergraduate applicants
- Applicants: TA / UGCA / Both toggle, grad and UGCA intake details, transcript check, GRA "add back to pool", and a mock Refresh from the legacy app
- Students: the response window must be open before students are notified, with per-student extensions

## Not connected
- **Email is not sent.** Windows, reminders, HR drafts and student notices only draft the text.
- The legacy app link and the mailbox are mocked.
- Everything lives in memory and resets on reload.
- CSV output is copy-only.

## Develop
```
npm install
npm run build   # template.html + data/seed.json -> index.html
npm test        # jsdom smoke test
```
The only expected jsdom message is the unimplemented `scrollTo`.

See `docs/INTEGRATION.md` for the integration seam, the assumptions, and the open decisions.
