import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Auth from './Auth';

const authState = { login: vi.fn(), signup: vi.fn(), error: null, setError: vi.fn() };
vi.mock('../context/AuthContext', () => ({ API_URL: 'http://api.test', useAuth: () => authState }));

const requestPasswordReset = vi.fn();
vi.mock('../utils/accountApi', () => ({
  PASSWORD_MIN_LENGTH: 8,
  requestPasswordReset: (...args) => requestPasswordReset(...args),
}));

describe('the sign-in screen', () => {
  it('really requests a reset link and shows what the server said', async () => {
    requestPasswordReset.mockResolvedValue({ message: 'If an account exists for that email address, a link to reset its password is on its way.' });
    render(<Auth />);

    fireEvent.click(screen.getByText('Forgot Password?'));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'ravi@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('ravi@example.com'));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('a link to reset its password is on its way'));

    fireEvent.click(screen.getByText('Back to sign in'));
    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeTruthy();
  });

  it('can open straight in forgot-password mode and asks for 8-character passwords on signup', () => {
    const { unmount } = render(<Auth initialMode="forgot" />);
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy();
    unmount();

    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(screen.getByLabelText('Password').getAttribute('minLength')).toBe('8');
    expect(screen.getByText('At least 8 characters.')).toBeTruthy();
  });
});
