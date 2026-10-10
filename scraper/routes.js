'use strict';
/* Where each page lives. Paths marked ASSUMED were not seen yet: open the legacy app, hover the link, and fix the path here.
   Nothing else in the scraper needs to change when a path moves. */
module.exports = {
  base: process.env.LEGACY_BASE || 'https://apps.cs.utexas.edu/taproc/index.php',
  peopleBase: process.env.PEOPLE_BASE || 'https://www.cs.utexas.edu',
  classes: ['/admin/classes'],                      // ASSUMED. Both tabs (TA and proctor tables) are found by their headers, on one page or two. Add a second path if the UGCA tab is its own page.
  applicants: ['/admin/applicants'],                // ASSUMED. Same rule: TA table and UGCA table are found by header.
  applicant: id => '/admin/applicant/' + id,        // seen in the links
  ugcaModal: id => '/admin/proctor_applicant/' + id, // ASSUMED: the page the "proctor-view" link loads in the modal (check the Network tab)
  course: id => '/admin/course/' + id,              // seen in the links
  assignments: '/admin/assignments',                // given by Doug
  notify: '/admin/assignment_notify',               // ASSUMED: the page that shows the Agreement table and the "Notify applicants" button
  people: '/people'                                 // given by Doug
};
