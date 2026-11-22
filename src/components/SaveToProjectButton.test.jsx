import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SaveToProjectButton from './SaveToProjectButton';

vi.mock('../context/AuthContext', () => ({
  API_URL: 'http://api.test',
  useAuth: () => ({ user: { id: 1 }, token: 'session' }),
}));

const listProjects = vi.fn();
const saveResult = vi.fn();
vi.mock('../utils/workspaceApi', () => ({
  workspaceApi: () => ({ listProjects: (...a) => listProjects(...a), saveResult: (...a) => saveResult(...a) }),
  projectLabel: (p) => p.name,
  writableProjects: (list) => list,
}));
vi.mock('../utils/reportContent', () => ({ reportContent: () => undefined }));

const open = async () => {
  listProjects.mockResolvedValue([{ id: 7, name: 'Soil trial' }]);
  const view = render(
    <SaveToProjectButton module="descriptive" defaultTitle="Descriptive statistics" result={{ ok: true }} />
  );
  fireEvent.click(screen.getByRole('button', { name: /Save to Project/i }));
  await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy());
  return view;
};

describe('saving an analysis to a project', () => {
  it('draws its panel on the page body, not inside the modal that clips it', async () => {
    // Every module puts this button in a modal footer, and those modals are overflow-hidden. A panel
    // positioned inside the button's own box was drawn outside the modal and never seen.
    const { container } = await open();
    expect(container.querySelector('select')).toBeNull();
    const panel = document.body.querySelector('select').closest('div[style]');
    expect(panel).toBeTruthy();
    expect(panel.style.position).toBe('fixed');
  });

  it('saves the title and result to the chosen project', async () => {
    saveResult.mockResolvedValue({ id: 3 });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveResult).toHaveBeenCalled());
    const [projectId, body] = saveResult.mock.calls[0];
    expect(projectId).toBe(7);
    expect(body.module).toBe('descriptive');
    expect(body.result).toEqual({ ok: true });
    await waitFor(() => expect(screen.getByText('Saved to project.')).toBeTruthy());
  });

  it('shows the reason when the server refuses the save', async () => {
    saveResult.mockRejectedValue(new Error('Storage limit reached (50 MB).'));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Storage limit reached (50 MB).')).toBeTruthy());
  });
});
