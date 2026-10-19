import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNREACHABLE, apiFetch } from './apiFetch';

describe('talking to the server', () => {
  afterEach(() => vi.restoreAllMocks());

  it('explains a server it cannot reach instead of saying "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(apiFetch('http://api.test/auth/login')).rejects.toThrow(UNREACHABLE);
    expect(UNREACHABLE).toMatch(/Could not reach the StatSathi server/);
  });

  it('passes a real response and other errors straight through', async () => {
    const response = { ok: false, status: 401 };
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(apiFetch('http://api.test/auth/login')).resolves.toBe(response);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); }));
    await expect(apiFetch('http://api.test/auth/login')).rejects.toThrow('aborted');
  });
});
