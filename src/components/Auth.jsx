import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User as UserIcon, Building, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, requestPasswordReset } from '../utils/accountApi';

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:bg-white focus:ring-4 focus:ring-brand-indigo/10 transition-all';

const Auth = ({ onSuccess, initialMode = 'login' }) => {
  const { login, signup, error, setError } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup' | 'forgot'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');

  const isLogin = mode === 'login';

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'forgot') {
        const { message } = await requestPasswordReset(email);
        setNotice(message);
      } else if (isLogin) {
        await login(email, password);
        if (onSuccess) onSuccess();
      } else {
        await signup(fullName, institution, email, password);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      if (mode === 'forgot') setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const heading = { login: 'Welcome Back', signup: 'Create Academic Account', forgot: 'Reset your password' }[mode];
  const subheading = {
    login: 'Access your research statistical workflows.',
    signup: 'Register to unlock multi-variable correlation models.',
    forgot: "Enter the email address of your account and we'll send you a link to choose a new password.",
  }[mode];
  const submitLabel = { login: 'Sign In', signup: 'Create Account', forgot: 'Send reset link' }[mode];
  const busyLabel = { login: 'Signing In...', signup: 'Registering...', forgot: 'Sending...' }[mode];

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/50 transition-all duration-300">

        {/* Toggle tabs */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            {[['login', 'Log In'], ['signup', 'Sign Up']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => switchMode(id)}
                aria-pressed={mode === id}
                className={`w-1/2 py-4 text-center font-display text-sm font-bold transition-all duration-200 ${
                  mode === id
                    ? 'border-b-2 border-brand-indigo bg-white text-brand-indigo'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="p-8">
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mb-4 flex items-center space-x-1 font-sans text-xs font-semibold text-slate-500 hover:text-brand-indigo"
            >
              <ArrowLeft className="h-3.5 w-3.5" /><span>Back to sign in</span>
            </button>
          )}

          <div className="mb-6 text-center">
            <img src="/logo.svg" alt="StatSathi" className="h-10 mx-auto mb-4 object-contain" />
            <h2 className="font-display text-xl font-bold text-slate-800">{heading}</h2>
            <p className="font-sans text-xs text-slate-400 mt-1">{subheading}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" className="mb-4 flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error}</span>
            </div>
          )}

          {notice && (
            <div role="status" className="mb-4 flex items-start space-x-2 rounded-2xl bg-emerald-50 p-4 text-emerald-800 border border-emerald-100 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <span className="font-sans text-xs font-medium leading-normal">
                {notice} The link works for one hour; check your spam folder if it does not arrive.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (Sign Up only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label htmlFor="auth-name" className="font-sans text-xs font-bold text-slate-500">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Ravi Kumar"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Institution / Affiliation (Sign Up only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label htmlFor="auth-institution" className="font-sans text-xs font-bold text-slate-500">Institution / Affiliation</label>
                <div className="relative">
                  <Building className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    id="auth-institution"
                    type="text"
                    autoComplete="organization"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="ICAR - Indian Institute of Soil Science"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1">
              <label htmlFor="auth-email" className="font-sans text-xs font-bold text-slate-500">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Password */}
            {mode !== 'forgot' && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label htmlFor="auth-password" className="font-sans text-xs font-bold text-slate-500">Password</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="font-sans text-xs font-semibold text-brand-indigo hover:underline focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'signup' ? PASSWORD_MIN_LENGTH : undefined}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="font-sans text-[14px] text-slate-400">At least {PASSWORD_MIN_LENGTH} characters.</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-brand-indigo/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>{busyLabel}</span>
                </div>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
