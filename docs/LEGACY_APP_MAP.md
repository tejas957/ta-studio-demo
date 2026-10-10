# Legacy TA app map (from the HTML Doug's side shared on Oct 10)

Base: `https://apps.cs.utexas.edu/taproc/index.php/`. Login: UTCS username and password. Pages are server-rendered HTML (no JSON calls seen on the applicants page; it loads one document plus CSS and JS files). So the scraper reads HTML tables.

No names, EIDs, emails or phone numbers belong in this file or anywhere in the repo.

## Pages we have seen

| Page | URL pattern | What it shows | Notes |
|---|---|---|---|
| TA classes | `admin/classes` (to confirm) | 118 class rows: Id, Course, Prof, TAs Needed, TAs Assigned. Buttons: Edit classes, Import classes (`admin/update_classes`), Print faculty requirements | Id is a section id (208456...), not a course number. Several rows share one course number |
| Proctor (UGCA) classes | same page, second tab | 101 rows: Id, Course, Prof, Proctors Needed. Course names open a modal | Same ids as the TA list |
| Course page | `admin/course/{id}` | Not seen yet | Probably lists who requested and who is assigned |
| TA applicants | `admin/applicants` | 166 rows. Name (links to `admin/applicant/{id}`), EID, Status, GRA, Available, Assignments, New/Return, Degree, AI, GPA, Updated, Update checkbox. Links: Search, Print student applications | One big `<form>` with save-by-checkbox. Never submit it |
| TA applicant detail | `admin/applicant/{id}` | Contact, Status, English, Supervisor, Major, Admission date, Degrees, Citizenship, GRA, TA history, essays, programming table, research, requested classes, assignments table with grade and professor comments | Top of page (not pasted yet): Commitment of support, Requested by, Currently assigned, Remove student from TA pool |
| UGCA applicants | second tab | 264 rows: Name, EID, Major, Phone, Email | Detail opens in a modal (`data-record` = applicant id). The modal's own URL is not seen yet |
| UGCA applicant modal | fetched on click | Contact, Major, Expected graduation, Experience, two essays, Highest CS courses, Resume link, Requested courses to proctor (with section ids) | Resume link is `upload/view?file=...` |
| Assignments | `admin/assignments` (to confirm) | 78 rows: Course, Student, Percent Assigned, Agreement. Form posts to `admin/assignment_notifiy` with button "Notify applicants" | Agreement is "Yes" or "Sent:<time>" so accept state is readable |
| Drafts | `admin/drafts` (to confirm) | "TA assignment drafts, Fall 2026 - Draft 15", draft picker, semester picker, "Download this draft" | Semester ids: Fall = 8, Spring = 1, Summer = 6 |
| Settings menu | | Application settings, Users, View student application, View faculty application, Commitment students, Content, Drafts, Email TAs | "View faculty application" and "Email TAs" are not seen yet |

## Rules for the scraper (read only)

- Only HTTP GET. The applicants page, the assignments page and the applicant page contain buttons that change data or email students (Update, Notify applicants, Remove student from TA pool). Never submit a form, never follow a link that is not a view.
- The assignments page carries a CSRF token. Do not store it.
- Ask for a read-only login if the Users page allows one.
- Store only what the tool needs. SSN is shown only as Yes / No (a flag). Do not store a real SSN if one ever appears.
- Real student data stays out of GitHub. Test fixtures must be rewritten with fake names, EIDs, emails and phones.

## Row colors on the TA applicants list

The legend says: Yellow = Commitment Student, Blue = Other Support, Red = Declined offer, Graduated, or Other. They are CSS classes on the `<tr>`, defined in `bg_colors.css`.

| Class on `<tr>` | Color | Seen in this export | What we observe |
|---|---|---|---|
| `commitment` | Yellow | 65 | All 65 have an assignment |
| `other_support` | Blue | 49 | None has an assignment. GRA is yes (11), applied (13) or no (25), so blue is not only the GRA flag |
| `declined` | Red | 1 | No assignment. The Available column shows "Notified: <time>" |
| `other` | Red | 1 | No assignment |
| (none) | White | 50 | 13 assigned, 37 not |

Not in this export: a separate class for Graduated (maybe it also uses `declined` or `other`). Ask Doug.

To check in the data: 18 yellow rows also have GRA yes (10) or applied (8). That is the same GRA conflict our tool checks, so ask Doug whether a commitment student with a grant is allowed.

## Applicant list columns

| Legacy column | Meaning | Our field |
|---|---|---|
| Name ("Last,First") | Link gives the applicant id | applicant id, name |
| EID | UT id | EID (matching key for GRA lists) |
| Status | Ph.D. (109), Masters (51), In Candidacy (6) | degree level. "In Candidacy" is probably a PhD stage: confirm for the HR tier |
| GRA | no / yes / applied | GRA flag. "applied" is a third state our tool lacks |
| Available | Yes, blank, No, or "Notified: <time>" | availability (meaning of each value to confirm) |
| Assignments | List of links to course ids | current assignments |
| New/Return, Degree (C / M / B), AI (Yes / No), GPA (pass / fail) | Entered by the office for HR (the commented columns in the draft table show the rest) | HR accounting fields. Not applicant answers |
| Updated | Time of last office edit to the four fields | |

## Draft (HR) table

Visible columns: First name, Last name, EID, Email, Course Number, Course Name, Professor, Percent Assigned, New/Return, Degree, AI, GPA, Updates.

The page source also holds commented-out columns with data: SSN (Yes/No), Admission Date, Native English Speaker, English Assessment Results (pass, conditional pass, unknown), Status, GRA. The downloaded file may include them. We need the real file header before we build our HR export.

## Course list

- 118 TA rows, every row needs 1.0. 76.0 assigned in total (78 assignment rows, some 0.5).
- Over-assigned rows exist (2 assigned to a 1.0 need), so the legacy app does not stop it.
- Professors are only strings like `LAST, F`, with mixed case, truncations (HUNTER-JONE, KRAEHENBUEHL) and typos (ELNOZAHY,, M). No professor id or email. Matching to the UT CS faculty pages will need a manual review list.
- The professor on a section id changes between the time a student applied and today (an applicant's saved request lists a different professor for the same id). Professors must be re-read on every sync, and changes shown as a diff.
- The same course number appears under several section ids and, for the same title, several professors. A TA applicant's requested list gives class names only (duplicates for several sections), not ids. The UGCA request list does give ids.

## Applicant requested classes

- TA detail page: ordered list of class names, can repeat a name (one per section). Discussion-session classes are a separate list.
- UGCA modal: ordered list `id - number title - professor`.
- To rank pools in this tool we need the id for TA requests. The course page may list requesters by applicant id. Ask for it.

## What this changes in our model

- Add a commitment flag (yellow): department promised support. It is a priority and probably a must-place group.
- Add an other-support flag (blue): supported elsewhere, so not placed. Confirm.
- Add a declined / graduated / other flag (red).
- Add GRA state "applied".
- Add HR accounting fields (New/Return, Degree code, AI, GPA pass/fail) with a suggested value (New/Return from TA history).
- Add English assessment (pass / conditional pass / unknown) and "In Candidacy".
- Read Agreement ("Yes" or "Sent:<time>") from the assignments page: this is how the legacy app records student accept.
- Course ids are section ids. The tool's course is a section.

## Still needed

1. `bg_colors.css` (the color definitions) and the list of every class name used on the applicants rows, including Graduated.
2. A course page `admin/course/{id}`, one with several requesters.
3. The assignments page URL, the drafts page URL, and the "Download this draft" file (only the header row plus 2 fake rows).
4. The UGCA applicant list columns beyond what we saw (any status, color, assignments), and the UGCA assignments view.
5. Top of one applicant detail page (Commitment of support, Requested by, Remove button).
6. Settings pages: Users, Commitment students, Application settings, View faculty application, Email TAs. Screenshots are enough.
7. Doug's answers to the questions below.

## Questions for Doug

1. What sets Yellow and Blue? Is it the Commitment students page? What exactly is "Other support"?
2. Can a commitment student also have a GRA?
3. What do the Available values mean (Yes, No, blank, Notified)?
4. What are Degree C / M / B and GPA pass / fail used for?
5. Is "In Candidacy" treated as PhD for HR?
6. Why do some sections have 2 assigned for a need of 1.0?
7. What is "View faculty application"? Do professors submit anything in the legacy app?
8. What does "Email TAs" send, to whom, and who uses it?
