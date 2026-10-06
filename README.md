# TA Studio Desk (demo)

A clickable, single-file demo of the TA scheduling workflow for the CS office. Open `index.html` in a browser. No server needed.

**Synthetic data only.** Applicants are fictional aliases from the small dataset in `data/seed.json` (from `ta-scheduler-mvp-dataset`). No PID, EID, SSN or real student information.

## What it shows
- Admin: dashboard, faculty ranking windows, assignments workspace, applicants and GRA cross-check, versioned publishing with gating, student notification tracking, concerns, audit log
- Faculty: ranking their own course only, backups, submit, published plan, concerns
- Faculty windows: open a window for one professor or all, queued email text, notifications, and a response tracker with a copyable CSV

## Not connected
- **Email is not sent.** Windows and reminders only queue the text.
- Everything lives in memory and resets on reload.
- CSV output is copy-only.

## Develop
```
npm install
npm run build   # template.html + data/seed.json -> index.html
npm test        # jsdom smoke test
```
The only expected jsdom message is the unimplemented `scrollTo`.
