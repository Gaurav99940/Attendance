import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  User,
  Building2,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const [portalMode, setPortalMode] = useState('employee'); // 'employee' | 'admin'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleModeSwitch = (mode) => {
    setPortalMode(mode);
    setError('');
    setIdentifier('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(identifier.trim(), password.trim(), portalMode);
    if (res.success) {
      if (res.user?.role === 'Employee') {
        navigate('/app');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(typeof res.error === 'string' ? res.error : 'Authentication failed. Please check credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 animate-scale-up">
        {/* Brand Icon & Title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">SmartFace Platform</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Enterprise Face Biometric Attendance & Staff Portal
          </p>
        </div>

        {/* Portal Switcher Tabs */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center mb-6">
          <button
            type="button"
            onClick={() => handleModeSwitch('employee')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              portalMode === 'employee'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Employee</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              portalMode === 'admin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Admin</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              {portalMode === 'admin' ? 'Administrator Email' : 'Employee ID or Official Email'}
            </label>
            <div className="relative">
              {portalMode === 'admin' ? (
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              ) : (
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              )}
              <input
                type="text"
                name="auth_identifier"
                id="auth_identifier"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={portalMode === 'admin' ? 'admin@company.com' : 'Enter Employee ID or Official Email'}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            {portalMode === 'employee' && (
              <p className="text-[10px] text-slate-400 mt-1">
                Enter your Employee ID or official email registered by HR.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Password / PIN</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                name="auth_security_key"
                id="auth_security_key"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            {portalMode === 'employee' && (
              <p className="text-[10px] text-slate-400 mt-1">
                Default initial password is <span className="font-mono font-bold text-slate-600">EMP_ID@123</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              portalMode === 'employee'
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
            }`}
          >
            <span>
              {loading
                ? 'Authenticating...'
                : portalMode === 'employee'
                ? 'Sign In'
                : 'Sign In as Admin'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
