# Feature map (v3.3)

Process order, with the transition points between processes marked. "Lives in" says which system owns the data: **Legacy** = the existing TA app (applicants apply there; this tool only reads), **Tool** = this tool, **Both** = pulled from legacy, annotated here. From v3.3 the legacy app is only the collector (applications, course setup, history). Rankings, decisions, student replies and all email live in this tool.

| # | Feature | Lives in | Overlap / redundancy | Outside integration (where) | Demo status |
|---|---|---|---|---|---|
| | **1. SETUP (before the term)** | | | | |
| 1 | Course audience (graduate, undergraduate, both) | Legacy (edit-class screen), mirrored here | Differs from the TA/UGCA toggle: this decides who can *apply*, the toggle only filters what you *see*. Local edits are marked "Differs from legacy app" | Read from legacy. A real change must be made in legacy, because it controls what applicants see on the form | Works as a planning what-if |
| 2 | Slots by role (TA, UGCA, proctor, fractional) | Legacy, mirrored here | Need is shown in several screens but derived from here | Read from legacy edit-class screen | Works as a planning what-if |
| 3 | Application form questions (grad vs undergrad) | Legacy | None. This tool only lists what the form must ask | Edits to the two existing legacy forms: add resume (grad), supervisor and research area (grad), citizenship in the sync, show teaching experience to grads only | Requirements list only |
| | **2. APPLICANT INTAKE (applicants apply in the legacy app)** | | | | |
| 4 | Applicant sync | Legacy → Tool | None | Legacy app, read-only scrape (Eric). Also pulls course setup and TA history | Mock (Refresh button) |
| 5 | Applicant card (answers, skills, coursework, history) | Legacy data, read-only here | Workspace chips repeat part of it | Legacy app; resume file access | Works on fake data. Shows "Applied through legacy TA app form" |
| 6 | HR tier (computed, overridable) | Tool, from legacy TA history | Two tier labels: degree and HR tier | Multi-year TA history from legacy | Works, rule assumed |
| 7 | Employment eligibility and ITA / English warnings | Legacy data | Two similar fields: dataset "spoken English" and ITA status | Legacy and/or HR (source unclear) | Works |
| 8 | GRA cross-check (paste list, flag, block) | Tool (office note) | One shared button, on Applicants and the course row | Grant admins' list, keyed by EID today | Works |
| 9 | GRA add-back to pool | Tool | Same control as #8 | None | Works |
| 10 | Transcript check box | Tool (office note) | Overlaps with the self-reported "took this course (grade)" chip | Transcripts (UT system, or by hand today) | Works (manual box) |
| 11 | TA / UGCA / Both toggle | Tool | See #1 | None | Works |
| 12 | Priority queue (PhD, undergrad, master's last) | Tool | Dashboard "PhDs to place first" says the same | None | Works |
| | **Transition: Intake → Faculty ranking.** Applicants who chose a course (and are allowed by its audience) become that professor's pool. A late applicant can reopen the need for a window. | Legacy → Tool | Audience rule and pool facts used in both stages | Legacy sync | |
| | **3. FACULTY RANKING WINDOWS** | | | | |
| 13 | Open window for one professor or all | Tool | Dashboard "Reopen ranking" vs windows "Reopen window" are separate actions, named differently | Email sender account | Window works, email mock |
| 14 | Reminders, extend, close, reopen | Tool | Same open / extend / close wording as student windows (#29) | Email sender account | Works, email mock |
| 15 | Response tracker and CSV | Tool | Dashboard shows a ranking summary and a windows chip | None | Works |
| 16 | Mock email reply | Tool | Two ways a professor can respond (tool or email) | Shared mailbox read | Mock |
| 17 | Faculty view (own course only, rank, backups, comments, checks, submit; locked until window opens) | Tool | Admin "Copy list for the professor" is a workaround for professors who skip the tool | UT sign-in, faculty to course mapping from legacy | Works, fake sign-in |
| 18 | Notification bell | Tool | Same events as tracker and audit log | Email or push later | Works in-app |
| | **Transition: Ranking → Placement.** A submitted ranking appears beside each candidate. If a professor hasn't submitted, you get pool facts and the copied list. | Tool | "Copy list" and the faculty ranking page do the same job | None | |
| | **4. PLACEMENT (office)** | | | | |
| 19 | Course workspace (pool, facts, professor rank, FTE, decision, role, note) | Tool | Dashboard repeats draft and confirmed numbers | None. Decisions stay here (read-only toward legacy) | Works |
| 20 | Role per assignment (TA, AI, UGCA) | Tool | None | Possibly HR appointment types | Works |
| 21 | Conflict checks | Tool | One renderer for Dashboard and course views. Publish shows a summary | None | Works |
| 22 | Dashboard | Tool | Overlaps with #15, #18, #21 | None | Works |
| | **Transition: Placement → Publish.** Only accepted assignments pass, with no blocking issues. Warnings need a written note. | Tool | Same checks as #21 | None | |
| | **5. PUBLISH TO FACULTY** | | | | |
| 23 | Publish gate with override notes | Tool | Same data as #21 | None | Works |
| 24 | Versioned publication and diff ("Faculty versions") | Tool | Second numbering next to HR drafts. Cross-linked when they match | None | Works |
| 25 | Faculty "Published plan" view and notice | Tool | None | UT sign-in | Works |
| | **Transition: Publish ↔ HR.** The same accepted rows feed a publish version and an HR draft, with separate counters. They cross-link when identical. | Tool | #24 vs #26 | None | |
| | **6. HR DRAFTS (the single HR export)** | | | | |
| 26 | Numbered HR draft with added / removed / changed rows | Tool | Replaces the old per-version CSV | HR receives the result (email or spreadsheet) | Works |
| 27 | HR spreadsheet text, with tier and citizenship | Tool | One place for HR output | Real HR column list; who may see citizenship | Mock (copy only) |
| 28 | HR email text | Tool (outbox) | Goes to the one outbox (#36) | Email to HR | Mock |
| | **Transition: Publish → Students.** The student response window must be open before notifying. Each new version starts closed. | Tool | Same window idea as #14 | None | |
| | **7. STUDENTS** | | | | |
| 29 | Student response window (open, reply-by date, close) | Tool | Same open / extend / close wording as #14 | None | Works, no student page yet |
| 30 | Notify students (email text, to outbox) | Tool | Email goes to the one outbox | Email sender; student emails come with the applicant record | Mock |
| 31 | Reply tracking (confirmed, declined, waiting) | Tool | Manual log remains for replies sent by plain email | Student reply link or page (to build) | Mock ("Simulate a student reply") plus manual |
| 32 | Per-student extension | Tool | Similar to #14 extend | None | Works, date only |
| 33 | Declined student → professor's backups → replacement | Tool | Uses the backup list from #17 | None | Works |
| | **Transition: Decline → Placement loop.** A replacement goes back to the workspace, changes the next HR draft (removed row) and needs a new published version. | Tool | #19, #24, #26 | None | |
| | **8. AFTER PUBLISH** | | | | |
| 34 | Faculty concerns (raise, review, close or adjust) | Tool | Overlaps with declines: both cause revisions | None | Works |
| 35 | Revision draft / fresh draft from a version | Tool | Same loop as declines | None | Works |
| | **9. CROSS-CUTTING** | | | | |
| 36 | Mail tab: one outbox for professors, students and HR, plus mock inbox | Tool | Replaces four separate email displays | Email sender, shared mailbox | Mock |
| 37 | Audit log | Tool | Overlaps with bell and tracker | A real database | Works, resets on reload |
| 38 | Role switcher and privacy boundary | Tool | None | UT sign-in | Fake |
| 39 | Walkthrough and reset | Demo | Demo only | None | Demo only |

## Decisions so far (Oct 9)

1. Student notices are sent from this tool.
2. Student accept / decline most likely happens through this tool (to confirm with the legacy app owner).
3. Course audience and slots stay owned by the legacy app for the first version. This tool reads them. Edits here are planning only.
4. After integration the legacy app only collects information and supports. All emails (professors, students, HR) and all ranks and decisions are in this tool.

## Still open

- Can this tool ever write course audience / slots back to the legacy app (needed if it becomes the owner)?
- Which graduate-form changes can be made in the legacy app, and by whom?
- Where does a student reply page live, and how do students sign in?

