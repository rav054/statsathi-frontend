import { useState } from 'react';
import { MailWarning, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resendVerification } from '../utils/accountApi';

const DISMISSED_KEY = 'statsathi_verify_banner_dismissed';

/** Reminds a signed-in user whose email address is not confirmed yet, with a way to get a new link. */
const VerifyEmailBanner = () => {
  const { user, token } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [status, setStatus] = useState(null); // { tone, text }
  const [sending, setSending] = useState(false);

  if (!user || user.email_verified !== false || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      const { message } = await resendVerification(token);
      setStatus({ tone: 'ok', text: message });
    } catch (err) {
      setStatus({ tone: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // private browsing: the banner simply returns next time
    }
  };

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 font-sans text-xs text-amber-900 md:px-8 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      <MailWarning className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {status?.text || <>Please confirm <b>{user.email}</b> using the link we emailed you, so you can always recover your account.</>}
      </span>
      {!status || status.tone === 'error' ? (
        <button type="button" onClick={resend} disabled={sending}
          className="rounded-lg border border-amber-300 px-2.5 py-1 font-semibold hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:hover:bg-amber-900/40 cursor-pointer">
          {sending ? 'Sending…' : 'Send the link again'}
        </button>
      ) : null}
      <button type="button" onClick={dismiss} aria-label="Hide this reminder" className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default VerifyEmailBanner;
