import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage?.clear?.();
  window.localStorage?.clear?.();
});

// A JSON response, the shape every screen expects back from the API
export const jsonResponse = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  headers: { get: () => 'application/json' },
  json: async () => body,
  blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
});
