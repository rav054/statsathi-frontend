import { useEffect } from 'react';
import { DIALOG, closeButton, topmostDialog } from '../utils/dialogs';

/**
 * Keyboard behaviour shared by every dialog in the app:
 * - Escape closes the topmost dialog (unless something inside it, like an open menu, already handled the key);
 * - a dialog that opens receives focus, so Tab moves through its controls rather than the page behind it;
 * - when it closes, focus goes back to where it was.
 */
const DialogKeyboard = () => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const dialog = topmostDialog();
      const button = dialog && closeButton(dialog);
      if (!button) return;
      event.preventDefault();
      button.click();
    };

    const returnFocus = new WeakMap();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          const dialog = node.matches(DIALOG) ? node : node.querySelector(DIALOG);
          if (!dialog || dialog.contains(document.activeElement)) return;
          returnFocus.set(dialog, document.activeElement);
          if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
          dialog.focus({ preventScroll: true });
        });
        mutation.removedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          const dialog = node.matches(DIALOG) ? node : node.querySelector(DIALOG);
          const previous = dialog && returnFocus.get(dialog);
          if (previous && previous.isConnected && !topmostDialog()) previous.focus({ preventScroll: true });
        });
      }
    });

    window.addEventListener('keydown', onKeyDown);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    };
  }, []);

  return null;
};

export default DialogKeyboard;
