import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User as UserIcon, Building, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Auth = ({ onSuccess }) => {
  const { login, signup, error, setError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(fullName, institution, email, password);
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address to reset password.");
      return;
    }
    setError(null);
    setForgotSent(true);
    setTimeout(() => {
      setForgotSent(false);
    }, 5000);
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/50 transition-all duration-300">
        
        {/* Toggle tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`w-1/2 py-4 text-center font-display text-sm font-bold transition-all duration-200 ${
              isLogin 
                ? 'border-b-2 border-brand-indigo bg-white text-brand-indigo' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`w-1/2 py-4 text-center font-display text-sm font-bold transition-all duration-200 ${
              !isLogin 
                ? 'border-b-2 border-brand-indigo bg-white text-brand-indigo' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="font-display text-xl font-bold text-slate-800">
              {isLogin ? 'Welcome Back' : 'Create Academic Account'}
            </h2>
            <p className="font-sans text-xs text-slate-400 mt-1">
              {isLogin 
                ? 'Access your research statistical workflows.' 
                : 'Register to unlock multi-variable correlation models.'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error}</span>
            </div>
          )}

          {/* Forgot Password Success Message */}
          {forgotSent && (
            <div className="mb-4 flex items-start space-x-2 rounded-2xl bg-emerald-50 p-4 text-emerald-800 border border-emerald-100 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-emerald-500" />
              <span className="font-sans text-xs font-medium leading-normal">
                Reset link sent! Please check your email inbox to proceed.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (Sign Up only) */}
            {!isLogin && (
              <div className="space-y-1">
                <label className="font-sans text-xs font-bold text-slate-500">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Ravi Kumar"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:bg-white focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Institution / Affiliation (Sign Up only) */}
            {!isLogin && (
              <div className="space-y-1">
                <label className="font-sans text-xs font-bold text-slate-500">Institution / Affiliation</label>
                <div className="relative">
                  <Building className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="ICAR - Indian Institute of Soil Science"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:bg-white focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1">
              <label className="font-sans text-xs font-bold text-slate-500">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:bg-white focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-sans text-xs font-bold text-slate-500">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="font-sans text-xs font-semibold text-brand-indigo hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-12 font-sans text-sm outline-hidden focus:border-brand-indigo focus:bg-white focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-brand-indigo py-3.5 font-sans text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-brand-indigo/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>{isLogin ? 'Signing In...' : 'Registering...'}</span>
                </div>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
