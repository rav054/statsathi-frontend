import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PASSWORD_MIN_LENGTH, passwordProblem, resetPassword, tokenFromLocation, verifyEmail } from '../utils/accountApi';

const Card = ({ title, children }) => (
  <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
    <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/50 text-slate-800">
      <img src="/logo.svg" alt="StatSathi" className="mx-auto mb-4 h-10 object-contain" />
      <h1 className="mb-4 text-center font-display text-xl font-bold">{title}</h1>
      {children}
    </div>
  </div>
);

const Message = ({ tone, children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'}
    className={`mb-4 flex items-start space-x-2 rounded-2xl border p-4 ${tone === 'error' ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}>
    {tone === 'error' ? <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
    <span className="font-sans text-xs font-medium leading-normal">{children}</span>
  </div>
);

const primaryButton = 'w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer';

// The page a password-reset email links to: choose a new password, then carry on signed in
export const ResetPasswordPage = ({ onDone, onRequestNewLink }) => {
  const { adoptSession } = useAuth();
  const [token] = useState(() => tokenFromLocation());
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(token ? null : 'This link has no reset code. Open the link from the email again, or ask for a new one.');
  const [done, setDone] = useState(false);
  const problem = passwordProblem(password, confirmation);

  const submit = async (event) => {
    event.preventDefault();
    if (problem) return;
    setSaving(true);
    setError(null);
    try {
      const { access_token: session } = await resetPassword(token, password);
      await adoptSession(session);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Card title="Password changed">
        <Message tone="ok">Your new password is set and you are signed in. Any other device signed in to this account has been signed out.</Message>
        <button type="button" onClick={onDone} className={primaryButton}>Go to the dashboard</button>
      </Card>
    );
  }

  return (
    <Card title="Choose a new password">
      {error && <Message tone="error">{error}</Message>}
      {token && (
        <form onSubmit={submit} className="space-y-4">
          {[['reset-new', 'New password', password, setPassword, 'new-password'], ['reset-confirm', 'Repeat the new password', confirmation, setConfirmation, 'new-password']].map(([id, label, value, setter, complete]) => (
            <div key={id} className="space-y-1">
              <label htmlFor={id} className="font-sans text-xs font-bold text-slate-500">{label}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input id={id} type={show ? 'text' : 'password'} required minLength={PASSWORD_MIN_LENGTH} autoComplete={complete}
                  value={value} onChange={(e) => setter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-12 font-sans text-sm outline-hidden focus:border-brand-indigo focus:bg-white" />
                {id === 'reset-new' && (
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide passwords' : 'Show passwords'}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className={`font-sans text-[11px] ${password && problem ? 'text-amber-600' : 'text-slate-400'}`}>
            {password && problem ? problem : `At least ${PASSWORD_MIN_LENGTH} characters.`}
          </p>
          <button type="submit" disabled={saving || Boolean(problem)} className={primaryButton}>
            {saving ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
      {error && (
        <button type="button" onClick={onRequestNewLink} className="mt-4 w-full font-sans text-xs font-semibold text-brand-indigo hover:underline">
          Ask for a new reset link
        </button>
      )}
    </Card>
  );
};

// The page a verification email links to: confirm the address as soon as it opens
export const VerifyEmailPage = ({ onDone }) => {
  const { refreshUser } = useAuth();
  const [state, setState] = useState({ status: 'working', message: '' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // links work once, so never send the token twice
    started.current = true;
    const token = tokenFromLocation();
    const confirm = async () => {
      if (!token) {
        setState({ status: 'error', message: 'This link has no verification code. Open the link from the email again.' });
        return;
      }
      try {
        const user = await verifyEmail(token);
        await refreshUser();
        setState({ status: 'done', message: `${user.email} is confirmed. Thank you!` });
      } catch (err) {
        setState({ status: 'error', message: `${err.message} You can send yourself a new link from the banner after signing in.` });
      }
    };
    confirm();
  }, [refreshUser]);

  return (
    <Card title="Confirm your email address">
      {state.status === 'working' && (
        <div className="flex justify-center py-6"><RefreshCw className="h-6 w-6 animate-spin text-brand-indigo" /></div>
      )}
      {state.status === 'done' && <Message tone="ok">{state.message}</Message>}
      {state.status === 'error' && <Message tone="error">{state.message}</Message>}
      {state.status !== 'working' && (
        <button type="button" onClick={onDone} className={primaryButton}>Go to StatSathi</button>
      )}
    </Card>
  );
};
