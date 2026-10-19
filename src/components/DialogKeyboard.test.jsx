import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DialogKeyboard from './DialogKeyboard';

// A module dialog that can open a data viewer on top of itself, like the analysis screens do
const Screens = ({ onModuleClose, onViewerClose }) => {
  const [viewer, setViewer] = useState(true);
  return (
    <>
      <button type="button">Open analysis</button>
      <div role="dialog" aria-modal="true" aria-label="Analysis">
        <button type="button" data-dialog-close aria-label="Close" onClick={onModuleClose}>x</button>
        <input aria-label="Variable" />
        {viewer && (
          <div role="dialog" aria-modal="true" aria-label="Viewer">
            <button type="button" data-dialog-close aria-label="Close" onClick={() => { onViewerClose(); setViewer(false); }}>x</button>
          </div>
        )}
      </div>
    </>
  );
};

describe('keyboard behaviour of dialogs', () => {
  it('Escape closes the innermost dialog first, then the one under it', () => {
    const onModuleClose = vi.fn();
    const onViewerClose = vi.fn();
    render(<><DialogKeyboard /><Screens onModuleClose={onModuleClose} onViewerClose={onViewerClose} /></>);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onViewerClose).toHaveBeenCalledTimes(1);
    expect(onModuleClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Viewer' })).toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onModuleClose).toHaveBeenCalledTimes(1);
  });

  it('leaves a key that something inside the dialog already handled', () => {
    const onModuleClose = vi.fn();
    render(
      <>
        <DialogKeyboard />
        <div role="dialog" aria-label="Analysis">
          <button type="button" data-dialog-close onClick={onModuleClose}>x</button>
          <input aria-label="Search" onKeyDown={(e) => { if (e.key === 'Escape') e.preventDefault(); }} />
        </div>
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'Escape' });
    expect(onModuleClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onModuleClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into a dialog when it opens and back when it closes', async () => {
    const Toggle = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          {open && (
            <div role="dialog" aria-label="Report">
              <button type="button" data-dialog-close onClick={() => setOpen(false)}>Close report</button>
            </div>
          )}
        </>
      );
    };
    render(<><DialogKeyboard /><Toggle /></>);
    const opener = screen.getByText('Open');
    opener.focus();
    await act(async () => { fireEvent.click(opener); await Promise.resolve(); });
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Report' }));

    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); await Promise.resolve(); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
