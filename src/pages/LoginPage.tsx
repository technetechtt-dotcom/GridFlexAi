import React, { useState } from 'react';
import { Grid, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset } from '../services/api';
export function LoginPage() {
  const { login, register, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'forgot') {
      if (!email) return;
      try {
        const result = await requestPasswordReset(email);
        setInfo(result.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to submit reset request.');
      }
      return;
    }
    if (!email || !password) return;
    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Name is required.');
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        await register(name.trim(), email, password, inviteToken.trim() || undefined);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-emerald-500/10 p-3 rounded-xl inline-flex mb-4">
            <Grid className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            GridFlex AI
          </h1>
          <p className="text-slate-400">Secure Access Portal</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {mode !== 'forgot' && (
          <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfo(null);
              }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setInfo(null);
              }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Register
            </button>
          </div>
          )}
          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-100">Forgot password</h2>
              <p className="mt-1 text-sm text-slate-400">
                Self-serve email reset is not enabled in this pilot. Submitting records an audited request for an
                administrator to reset the account.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'register' &&
            <>
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Invitation token
                </label>
                <input
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="Required in production"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Production environments require an administrator invitation.
                </p>
              </div>
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="Jane Operator"
                  autoComplete="name" />

                </div>
              </div>
            </>
            }
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="operator@gridflex.ai"
                  autoComplete="username" />

              </div>
            </div>

            {mode !== 'forgot' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="••••••••"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />

              </div>
            </div>
            )}
            {mode === 'register' &&
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="••••••••"
                  autoComplete="new-password" />

                </div>
              </div>
            }

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">

              {isLoading ?
              <Loader2 className="w-5 h-5 animate-spin" /> :

              <>
                  {mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Request reset' : 'Sign In'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              }
            </button>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-sm text-emerald-400 hover:text-emerald-300">
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-sm text-slate-400 hover:text-slate-200">
                Back to sign in
              </button>
            )}
            {error &&
            <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            }
            {info &&
            <p className="text-sm text-emerald-300" role="status">
                {info}
              </p>
            }
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Access is restricted to authorised GridFlex operators.
              <br />
              New accounts require an administrator invitation.
            </p>
          </div>
        </div>
      </div>
    </div>);

}
