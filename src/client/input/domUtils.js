/** True when the event target is a field the user is typing into (hotkeys must not fire). */
export function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}
