# Integration checklist (top to bottom)

Principle: the legacy app collects (applications, course setup, TA history) and supports. This tool holds everything after that: faculty rankings, office decisions, student replies, HR drafts and every email. Email is built but not sent until we choose to switch it on.

"Need from you" lines are what to paste or send so we can build that step. "Output" is what we can show Doug when the step is done.

## Phase 0. Decisions and access
Output: nothing visible, but nothing else can start without it.
- [ ] Get a login to the legacy app for the scraper (Doug / Eric, about half an hour)
- [ ] Confirm scraping on demand versus on a schedule, and whether the legacy app has any export
- [ ] Confirm who owns course audience and slots in version 1 (assumed: legacy owns, this tool reads)
- [ ] Confirm whether this tool may ever write course changes back to the legacy app
- [ ] Decide where the tool is hosted and who can sign in (Doug, other staff, professors, students)
- [ ] Confirm the term to use for the first real run (current term, or a past one as a rehearsal)
- Need from you: Doug and Eric's answers; who administers the legacy app

## Phase 1. Pull from the legacy app (the biggest piece)
Output: the real fall applicants, courses, professors and FTEs shown in this tool. See docs/LEGACY_APP_MAP.md for what the HTML showed.
- [x] Screens and fields identified from the HTML: TA classes, proctor classes, TA applicants list, TA applicant page, UGCA list and modal, assignments, draft table
- [x] Row colors identified: commitment (yellow), other_support (blue), declined and other (red)
- [ ] Get `bg_colors.css` and every row class name (including Graduated)
- [ ] Get the course page, the assignments and drafts URLs, the UGCA assignments view and the top of an applicant page
- [ ] Get the "Download this draft" file header (this is the HR column list)
- [ ] Settle where the scraper runs and how it logs in (UTCS username and password): a read-only or service account, credentials never in the repo, never in this chat
- [ ] Build the parser on fake fixtures (names, EIDs, emails and phones rewritten), GET only, with a guard that refuses any POST
- [ ] Applicants: id, name, EID, status, GRA (no / yes / applied), available, assignments, New/Return, Degree, AI, GPA, updated, row color
- [ ] Applicant page: contact, citizenship, English status, supervisor, admission date, degrees, TA history (parse "CS 363M, Prof, Fall 2024 semester"), skills table, research list, requested classes, grades and professor comments
- [ ] UGCA: modal fetch URL, major, graduation, experience, resume link, requested courses with section ids
- [ ] Courses: section id, course number, title, professor (re-read every sync, show changes), needed, assigned
- [ ] Resolve a TA request that lists a class name only (several sections) to a section id
- [ ] Assignments page: course, student, percent, agreement (Yes / Sent time)
- [ ] Professor matching: legacy "LAST, F" string to a faculty page entry, with a manual review list
- [ ] Add to the model: commitment, other-support and declined flags; GRA "applied"; HR accounting fields; English assessment; "In Candidacy"
- [ ] Keep the filters Doug uses in the legacy list (Search, color) and map each to a filter here
- [ ] Refresh on demand with a "what changed" log (new, changed, removed, professor change)
- [ ] Compare counts with the legacy screens until they match (166 TA applicants, 264 UGCA, 118 TA classes, 101 proctor classes, 78 assignments)
- Need from you: the "Still needed" list in docs/LEGACY_APP_MAP.md, and Doug's answers to its questions

## Phase 2. Real storage and sign-in
Output: data survives a reload; each person sees only what they should.
- [ ] Replace the in-memory state with a database (rankings, decisions, drafts, versions, windows, outbox, audit log)
- [ ] Sign-in by role: office, professor (own course only), later student
- [ ] Professor to course mapping from Phase 1
- [ ] Keep citizenship and other office-only fields hidden from professors
- [ ] Backups and an export of everything
- Need from you: whether UT sign-in (EID) is available or an emailed link is acceptable

## Phase 3. Contact details
Output: every professor and student has a real email address on file.
- [ ] Student emails: take them from the applicant record in Phase 1 (check they are populated for every applicant)
- [ ] Professor emails: collect from the UT CS department faculty bios pages (scrape once, then review by hand)
- [ ] Match each professor in the legacy app to a bio-page entry; list the ones that do not match
- [ ] Add a screen where Doug can correct any address
- [ ] Decide what happens when an address is missing or bounces
- Need from you: the faculty directory link; a list of any professors known to use a different address (lecturers, visitors)

## Phase 4. Email (built, sending off)
Output: every email looks exactly as it would, sits in the outbox, and nothing is sent.
- [ ] Wire all email types to real addresses: professor window open, reminder, extension, closed; published plan notice; student assignment notice; student reminder; HR draft email
- [ ] Final wording of each template (Doug reviews)
- [ ] A "dry run" mode that only fills the outbox (the default), and a per-type switch to send for real later
- [ ] A test mode that sends only to Doug's own address
- [ ] Choose the sending account (shared office mailbox or UT address) and get permission to send from it
- [ ] Reply handling: where professor and student replies by email land, and whether we read that mailbox
- [ ] Record send time, delivery failure and reply in the tracker
- Need from you: sender account decision; the wording Doug uses today; whether there is an approval step before sending

## Phase 5. Professor ranking windows on real data
Output: a real professor can open the tool, see their pool, rank and submit.
- [ ] Pools built from real applicants and each course's audience rule
- [ ] Window open, reminder, extend, close and reopen with real dates
- [ ] A late applicant reopens the need for a window; show it
- [ ] Professor view tested on a phone and a laptop
- [ ] Run with two or three friendly professors before everyone
- Need from you: two or three professors willing to try it; the usual ranking deadlines

## Phase 6. Placement, publish and students
Output: Doug can go from rankings to a published plan and student answers without spreadsheets.
- [ ] Import the legacy colors and statuses as flags in the workspace
- [ ] Conflict checks reviewed against the real rules (FTE, GRA, audience, eligibility, ITA)
- [ ] Publish versions and the diff between versions
- [ ] A student reply page: unique link in the email, accept or decline, reply-by date, the closed state
- [ ] Per-student extension and declined student to backup flow on real data
- [ ] Tell the legacy app owner that students no longer answer there
- Need from you: wording students see; how students should sign in; the usual reply-by window

## Phase 7. HR drafts and spreadsheets
Output: a real spreadsheet Doug can send to HR, and the email that carries it.
- [ ] Get HR's real column list and a sample spreadsheet (names removed)
- [ ] Confirm the HR tier rules (PhD, Masters 1 returning, Masters 2, UGCA) and the overrides
- [ ] Build the real .xlsx download, not copy-paste text
- [ ] Numbered drafts with added, removed and changed rows against the previous draft
- [ ] Attach the file to the HR email (still held in the outbox)
- [ ] Decide who may see citizenship in the spreadsheet
- Need from you: the sample sheet; HR's address and who receives it; the tier table

## Phase 8. GRA lists and periodic updates
Output: Doug pastes a list and sees who is on a grant; the grant list stays current.
- [ ] Keep the paste-a-list check (already in the demo) and match on EID first, then name
- [ ] Decide where the grant admins' list comes from: a file they email, a shared sheet, or a system
- [ ] A way to upload a new list each term and see who was added or removed since the last one
- [ ] A reminder to refresh the list before placement and again before publishing
- [ ] Show the date the list was last updated next to every GRA flag
- [ ] Add-back to the pool stays a recorded office decision
- Need from you: a sample list (names changed), who sends it and how often

## Phase 9. Trial, hardening and go-live
Output: Doug runs a real term in the tool.
- [ ] Rehearse with last term's data and compare to what Doug actually did
- [ ] Run alongside the old process for one cycle
- [ ] Privacy review (student data, citizenship, resumes)
- [ ] Audit log kept; error alerts to the builders
- [ ] Short guide for Doug and a guide for professors
- [ ] Turn on email sending one type at a time (test mode first)
- [ ] Switch the legacy app to collector and support only; announce the change
- Need from you: sign-off from Doug; a cutover date after the application deadline
