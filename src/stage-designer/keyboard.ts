/* =========================================================================
   Designer — is this keystroke ours to take?
   -------------------------------------------------------------------------
   Both the app shell and the canvas listen for keys on `window`, and both have
   to keep their hands off anything typed into a field: Backspace in the layout
   name box deletes a character, not six zones.

   The naive form of this check is `event.target.closest(...)`, and it is
   wrong. A keydown's target is only an Element when an element has focus —
   press a key with focus on the page itself and the target is the document,
   which has no `closest`, so the handler throws before it reaches any
   shortcut. That is not a hypothetical: it is exactly the state the window is
   in when the operator clicks the canvas background and then presses an arrow
   key, which is to say most of the time.
   ========================================================================= */

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

/** True when the keystroke belongs to a text field and the designer should
    leave it alone. */
export function isTypingTarget(target: EventTarget | null): boolean {
  // Not `instanceof Element`: the check has to hold for a document or the
  // window itself, both of which are legitimate keydown targets and neither of
  // which is a field.
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return !!(target as Element).closest(FIELD_SELECTOR);
}
