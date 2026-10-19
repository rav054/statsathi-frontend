import { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PASSWORD_MIN_LENGTH, changePassword, passwordProblem } from '../utils/accountApi';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-brand-indigo focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

/** Change the password while signed in; other devices are signed out, this one keeps going with a new session. */
const ChangePasswordForm = () => {
  const { token, adoptSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { tone, text }
  const problem = passwordProblem(next, confirmation);

  const submit = async (event) => {
    event.preventDefault();
    if (problem || !current) return;
    setSaving(true);
    setMessage(null);
    try {
      const { access_token: session } = await changePassword(token, current, next);
      await adoptSession(session);
      setCurrent('');
      setNext('');
      setConfirmation('');
      setMessage({ tone: 'ok', text: 'Password changed. Other devices signed in to this account have been signed out.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center space-x-1.5 font-sans text-xs font-semibold text-brand-indigo hover:underline dark:text-indigo-300 cursor-pointer">
        <KeyRound className="h-3.5 w-3.5" /><span>Change password</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
      <p className="flex items-center space-x-1.5 font-display text-xs font-bold text-slate-700 dark:text-slate-200">
        <KeyRound className="h-3.5 w-3.5" /><span>Change password</span>
      </p>
      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start space-x-1.5 font-sans text-[11px] ${message.tone === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {message.tone === 'error' ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          <span>{message.text}</span>
        </p>
      )}
      <input type="password" aria-label="Current password" placeholder="Current password" autoComplete="current-password"
        className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <input type="password" aria-label="New password" placeholder={`New password (at least ${PASSWORD_MIN_LENGTH} characters)`} autoComplete="new-password"
        className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} minLength={PASSWORD_MIN_LENGTH} required />
      <input type="password" aria-label="Repeat the new password" placeholder="Repeat the new password" autoComplete="new-password"
        className={inputClass} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
      {next && problem && <p className="font-sans text-[11px] text-amber-600">{problem}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setMessage(null); }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-sans text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={saving || Boolean(problem) || !current}
          className="rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer">
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;
