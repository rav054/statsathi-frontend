// Where the backend lives, and a fetch that explains a server it cannot reach.
// VITE_API_URL (e.g. in frontend/.env.development.local) overrides the default backend location.
export const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://statsathi-backend.onrender.com'
);

const local = API_URL.includes('127.0.0.1') || API_URL.includes('localhost');

// The browser's own wording for an unreachable server is "Failed to fetch", which tells a user nothing
export const UNREACHABLE = local
  ? `Could not reach the StatSathi server at ${API_URL}. Start the backend and try again.`
  : 'Could not reach the StatSathi server. Check your internet connection and try again.';

/** fetch(), but a network failure says what went wrong. */
export const apiFetch = async (url, options) => {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err instanceof TypeError) throw new Error(UNREACHABLE, { cause: err });
    throw err;
  }
};
