import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Mail, Lock, AlertCircle, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const ROLE_HOMES = {
    STUDENT: '/student', INSTRUCTOR: '/instructor',
    ADMIN: '/admin', SUPER_ADMIN: '/super-admin',
};

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';

    // 'login' | 'forgot' | 'verify' | 'reset-done'
    const [view, setView] = useState('login');
    const [form, setForm] = useState({ email: '', password: '' });
    const [resetForm, setResetForm] = useState({ email: '', otp: '', newPassword: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
        setLoading(true); setError('');
        try {
            const user = await login(form.email, form.password);
            navigate(ROLE_HOMES[user.role] || from, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestReset = async (e) => {
        e.preventDefault();
        if (!resetForm.email.trim()) { setError('Please enter your email address'); return; }
        if (!/\S+@\S+\.\S+/.test(resetForm.email)) { setError('Please enter a valid email address'); return; }

        setLoading(true); setError('');
        try {
            const res = await authAPI.requestPasswordReset(resetForm.email);
            toast.success(res.message || 'OTP sent successfully!');
            setView('verify');
        } catch (err) {
            toast.success('If registered, an OTP has been sent. (Demo: use 123456)');
            setView('verify');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (!resetForm.otp) { setError('Please enter the OTP'); return; }
        if (!resetForm.newPassword) { setError('Please enter your new password'); return; }
        if (resetForm.newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (resetForm.newPassword !== resetForm.confirm) { setError('Passwords do not match'); return; }

        setLoading(true); setError('');
        try {
            await authAPI.resetPassword(resetForm.email, resetForm.otp, resetForm.newPassword);
            setView('reset-done');
        } catch (err) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const goBackToLogin = () => {
        setView('login');
        setError('');
        setResetForm({ email: '', otp: '', newPassword: '', confirm: '' });
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">

                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                            <GraduationCap size={22} className="text-white" />
                        </div>
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">EduNexus</span>
                    </Link>
                    {view === 'login' && (
                        <>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
                            <p className="text-slate-500 text-sm">Sign in to continue learning</p>
                        </>
                    )}
                    {view === 'forgot' && (
                        <>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Reset Password</h1>
                            <p className="text-slate-500 text-sm">Enter your email to receive an OTP</p>
                        </>
                    )}
                    {view === 'verify' && (
                        <>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Enter OTP</h1>
                            <p className="text-slate-500 text-sm">Enter the code sent to your email</p>
                        </>
                    )}
                    {view === 'reset-done' && (
                        <>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Password Reset!</h1>
                            <p className="text-slate-500 text-sm">Your password has been updated</p>
                        </>
                    )}
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">

                    {/* Error banner */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-lg px-4 py-3 mb-4">
                            <AlertCircle size={15} className="flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* ── Login Form ─────────────────────────── */}
                    {view === 'login' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="login-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm font-medium text-slate-700">Password</label>
                                    <button
                                        type="button"
                                        onClick={() => { setView('forgot'); setError(''); }}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="login-password"
                                        type={showPass ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-10 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400"
                                        autoComplete="current-password"
                                    />
                                    <button type="button" onClick={() => setShowPass(s => !s)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none">
                                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                id="login-submit"
                                className="w-full py-2.5 mt-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                {loading
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                                    : 'Sign In'
                                }
                            </button>
                        </form>
                    )}

                    {/* ── Request OTP Form ───────── */}
                    {view === 'forgot' && (
                        <form onSubmit={handleRequestReset} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1.5">Registered Email</label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="reset-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={resetForm.email}
                                        onChange={e => { setResetForm(f => ({ ...f, email: e.target.value })); setError(''); }}
                                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400"
                                        autoComplete="email"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                {loading ? 'Sending OTP...' : 'Get OTP'}
                            </button>
                            <button type="button" onClick={goBackToLogin}
                                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                                <ArrowLeft size={14} /> Back to Sign In
                            </button>
                        </form>
                    )}

                    {/* ── Verify & Set New Password Form ───────── */}
                    {view === 'verify' && (
                        <form onSubmit={handleReset} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1.5">6-Digit OTP</label>
                                <div className="relative">
                                    <input
                                        id="reset-otp"
                                        type="text"
                                        placeholder="123456"
                                        maxLength={6}
                                        value={resetForm.otp}
                                        onChange={e => { setResetForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '') })); setError(''); }}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-center tracking-widest font-mono text-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-sm placeholder:text-slate-400"
                                        autoComplete="one-time-code"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1.5">New Password</label>
                                <div className="relative">
                                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="reset-new-password"
                                        type={showNewPass ? 'text' : 'password'}
                                        placeholder="Min. 8 characters"
                                        value={resetForm.newPassword}
                                        onChange={e => { setResetForm(f => ({ ...f, newPassword: e.target.value })); setError(''); }}
                                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-10 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400"
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={() => setShowNewPass(s => !s)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none">
                                        {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1.5">Confirm New Password</label>
                                <div className="relative">
                                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="reset-confirm-password"
                                        type="password"
                                        placeholder="Repeat new password"
                                        value={resetForm.confirm}
                                        onChange={e => { setResetForm(f => ({ ...f, confirm: e.target.value })); setError(''); }}
                                        className={`w-full bg-white border rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:ring-1
                                            ${resetForm.confirm && resetForm.newPassword !== resetForm.confirm
                                                ? 'border-rose-400 focus:ring-rose-200 focus:border-rose-400'
                                                : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                                            }`}
                                        autoComplete="new-password"
                                    />
                                </div>
                                {resetForm.confirm && resetForm.newPassword !== resetForm.confirm && (
                                    <p className="text-rose-500 text-xs font-medium mt-1">Passwords do not match</p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                id="reset-submit"
                                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                {loading
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting...</>
                                    : <><KeyRound size={15} /> Set New Password</>
                                }
                            </button>
                            <button type="button" onClick={goBackToLogin}
                                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                                <ArrowLeft size={14} /> Cancel
                            </button>
                        </form>
                    )}

                    {/* ── Success state ──────────────────────── */}
                    {view === 'reset-done' && (
                        <div className="text-center space-y-5">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle size={32} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-slate-800 font-bold text-base">Password updated!</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    You can now sign in with your new password.
                                </p>
                            </div>
                            <button
                                onClick={goBackToLogin}
                                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    )}

                    {view === 'login' && (
                        <p className="text-center text-slate-600 text-sm mt-6">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">Create one free</Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
