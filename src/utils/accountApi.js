import { API_URL, apiFetch } from './apiFetch';

// Account requests that are not part of signing in: reset links, email verification and password changes.
// Every call resolves to the JSON body or throws an Error carrying the server's message.

export const PASSWORD_MIN_LENGTH = 8;

const readError = (data, fallback) => {
  if (Array.isArray(data?.detail)) {
    const first = data.detail[0];
    if (first?.loc?.includes('password') || first?.loc?.includes('new_password')) {
      return `Passwords need at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    return first?.msg || fallback;
  }
  return data?.detail || fallback;
};

const post = async (path, body, { token, fallback } = {}) => {
  const res = await apiFetch(`${API_URL}/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) throw new Error(readError(data, fallback || 'Something went wrong. Please try again.'));
  return data;
};

export const requestPasswordReset = (email) => post('/forgot-password', { email }, { fallback: 'The reset link could not be requested.' });

export const resetPassword = (token, password) => post('/reset-password', { token, password }, { fallback: 'The password could not be reset.' });

export const verifyEmail = (token) => post('/verify-email', { token }, { fallback: 'The email address could not be verified.' });

export const resendVerification = (sessionToken) => post('/resend-verification', undefined, { token: sessionToken, fallback: 'The verification email could not be sent.' });

export const changePassword = (sessionToken, currentPassword, newPassword) => post(
  '/change-password',
  { current_password: currentPassword, new_password: newPassword },
  { token: sessionToken, fallback: 'The password could not be changed.' },
);

// Everything the account holds as a ZIP Blob, with the file name the server chose
export const exportAccountData = async (sessionToken) => {
  const res = await apiFetch(`${API_URL}/auth/account/export`, { headers: { Authorization: `Bearer ${sessionToken}` } });
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* no JSON body */ }
    throw new Error(readError(data, 'Your data could not be exported.'));
  }
  const disposition = res.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'statsathi-export.zip';
  return { blob: await res.blob(), filename };
};

export const deleteAccount = (sessionToken, password, confirmation) => post(
  '/account/delete',
  { password, confirmation },
  { token: sessionToken, fallback: 'The account could not be deleted.' },
);

// The one-time token from a link such as /reset-password?token=...
export const tokenFromLocation = (search = window.location.search) => new URLSearchParams(search).get('token') || '';

// A short check shown while typing a new password ('' when it is acceptable)
export const passwordProblem = (password, confirmation) => {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 128) return 'Use at most 128 characters.';
  if (confirmation !== undefined && confirmation !== password) return 'The two passwords do not match.';
  return '';
};
