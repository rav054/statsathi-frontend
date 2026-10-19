import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AccountDataSection from './AccountDataSection';

const logout = vi.fn();
vi.mock('../context/AuthContext', () => ({ API_URL: 'http://api.test', useAuth: () => ({ token: 'session', logout }) }));

const deleteAccount = vi.fn();
const exportAccountData = vi.fn();
vi.mock('../utils/accountApi', () => ({
  deleteAccount: (...args) => deleteAccount(...args),
  exportAccountData: (...args) => exportAccountData(...args),
}));
const saveBlob = vi.fn();
vi.mock('../utils/workspaceApi', () => ({ saveBlob: (...args) => saveBlob(...args) }));

describe('your data', () => {
  it('downloads the export under the server-chosen name', async () => {
    const blob = new Blob(['zip']);
    exportAccountData.mockResolvedValue({ blob, filename: 'statsathi-export-2026-09-14.zip' });
    render(<AccountDataSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Download my data' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, 'statsathi-export-2026-09-14.zip'));
  });

  it('deletes only after the password and DELETE, then signs out', async () => {
    deleteAccount.mockRejectedValueOnce(new Error('The password is not correct.')).mockResolvedValueOnce({});
    const onDeleted = vi.fn();
    render(<AccountDataSection onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    const submit = screen.getByRole('button', { name: 'Delete my account' });
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'secret-pass' } });
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(submit);
    expect((await screen.findByRole('alert')).textContent).toBe('The password is not correct.');
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteAccount).toHaveBeenLastCalledWith('session', 'secret-pass', 'DELETE');
    expect(logout).toHaveBeenCalled();
  });
});
