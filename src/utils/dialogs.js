// Dialogs mark themselves with role="dialog", and the button that closes them with data-dialog-close. That keeps each
// dialog's own close logic (resetting its form, clearing its dataset) as the single way to close it.
export const DIALOG = '[role="dialog"]';

// The dialog the user is looking at: the innermost one, and among those the last in the page
export const topmostDialog = (root = document) => {
  const dialogs = [...root.querySelectorAll(DIALOG)].filter(dialog => !dialog.querySelector(DIALOG));
  return dialogs[dialogs.length - 1] || null;
};

export const closeButton = (dialog) => [...dialog.querySelectorAll('[data-dialog-close]')].find(button => button.closest(DIALOG) === dialog);
