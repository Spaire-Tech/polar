// Master switch for the Course Assistant ("Office Hours" TA) UI.
//
// Turned OFF while the feature is being reworked. Nothing is deleted — every
// surface that renders TA UI (the editor "Assistant" tab, the student chat in
// the course portal, and the per-lesson transcription status in the outline /
// lesson editor) checks this flag, so flipping it back to `true` re-enables the
// whole thing in one place.
export const COURSE_ASSISTANT_UI_ENABLED: boolean = false
