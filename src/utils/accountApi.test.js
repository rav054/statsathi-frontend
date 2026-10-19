import { afterEach, describe, expect, it, vi } from 'vitest';
import { passwordProblem, requestPasswordReset, resetPassword, tokenFromLocation } from './accountApi';

vi.mock('./apiFetch', async () => ({ API_URL: 'http://api.test', UNREACHABLE: 'unreachable', apiFetch: (...args) => fetch(...args) }));

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

describe('account requests', () => {
  afterEach(() => vi.restoreAllMocks());

  it('checks a new password as it is typed', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/);
    expect(passwordProblem('long-enough')).toBe('');
    expect(passwordProblem('long-enough', 'long-enougH')).toMatch(/do not match/);
    expect(passwordProblem('x'.repeat(129))).toMatch(/at most 128/);
  });

  it('reads the one-time token from the link', () => {
    expect(tokenFromLocation('?token=abc_DEF-123')).toBe('abc_DEF-123');
    expect(tokenFromLocation('?other=1')).toBe('');
  });

  it('sends the reset request and returns the server message', async () => {
    const fetchMock = vi.fn(async () => reply(200, { message: 'If an account exists...' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestPasswordReset('ravi@example.com')).resolves.toEqual({ message: 'If an account exists...' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/auth/forgot-password');
    expect(JSON.parse(options.body)).toEqual({ email: 'ravi@example.com' });
  });

  it('turns server errors into readable messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(429, { detail: 'Several reset links were already sent. Please try again in about 12 minutes.' })));
    await expect(requestPasswordReset('ravi@example.com')).rejects.toThrow(/about 12 minutes/);

    vi.stubGlobal('fetch', vi.fn(async () => reply(422, { detail: [{ loc: ['body', 'password'], msg: 'String should have at least 8 characters' }] })));
    await expect(resetPassword('token-value', 'short')).rejects.toThrow('Passwords need at least 8 characters.');

    vi.stubGlobal('fetch', vi.fn(async () => reply(400, { detail: 'This reset link is invalid, has expired or has already been used. Ask for a new one.' })));
    await expect(resetPassword('token-value', 'long-enough')).rejects.toThrow(/already been used/);
  });
});
