import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Eye, EyeOff, Mail, Lock, AlertCircle, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const ROLE_HOMES = {
    STUDENT: '/student', INSTRUCTOR: '/instructor',
    ADMIN: '/admin', SUPER_ADMIN: '/super-admin',
};

const DEMO_ROLES = [
    { role: 'STUDENT', label: 'Student', emoji: '🎓' },
    { role: 'INSTRUCTOR', label: 'Instructor', emoji: '👨‍🏫' },
];

export default function LoginPage() {
    const { login, demoLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';

    // 'login' | 'forgot' | 'verify' | 'reset-password' | 'reset-done'
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
            toast.error(err.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (!resetForm.otp || resetForm.otp.length < 6) { setError('Please enter a valid 6-digit OTP'); return; }

        setLoading(true); setError('');
        try {
            await authAPI.verifyOTP(resetForm.email, resetForm.otp);
            setView('reset-password');
        } catch (err) {
            setError(err.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
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
        <div className="min-h-screen flex items-center justify-center px-4 bg-background transition-colors duration-300 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">

                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <GraduationCap size={22} className="text-white" />
                        </div>
                        <span className="text-2xl font-bold text-foreground tracking-tight">EduNexus</span>
                    </Link>
                    {view === 'login' && (
                        <>
                            <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
                            <p className="text-muted-foreground text-sm">Sign in to continue learning</p>
                        </>
                    )}
                    {view === 'forgot' && (
                        <>
                            <h1 className="text-2xl font-bold text-foreground mb-1">Reset Password</h1>
                            <p className="text-muted-foreground text-sm">Enter your email to receive an OTP</p>
                        </>
                    )}
                    {view === 'verify' && (
                        <>
                            <h1 className="text-2xl font-bold text-foreground mb-1">Verify OTP</h1>
                            <p className="text-muted-foreground text-sm">Enter the code sent to {resetForm.email}</p>
                        </>
                    )}
                    {view === 'reset-password' && (
                        <>
                            <h1 className="text-2xl font-bold text-foreground mb-1">New Password</h1>
                            <p className="text-muted-foreground text-sm">Set a secure password for your account</p>
                        </>
                    )}
                    {view === 'reset-done' && (
                        <>
                            <h1 className="text-2xl font-bold text-foreground mb-1">Password Reset!</h1>
                            <p className="text-muted-foreground text-sm">Your password has been updated</p>
                        </>
                    )}
                </div>

                <div className="bg-card border border-border shadow-2xl rounded-2xl p-8">

                    {/* Error banner */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-lg px-4 py-3 mb-4">
                            <AlertCircle size={15} className="flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {/* ── Login Form ─────────────────────────── */}
                        {view === 'login' && (
                            <motion.form
                                key="login"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                onSubmit={handleSubmit}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1.5">Email Address</label>
                                    <div className="relative">
                                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="login-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                            className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors outline-none placeholder:text-muted-foreground text-foreground"
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-sm font-medium text-foreground">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => { setView('forgot'); setError(''); }}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="login-password"
                                            type={showPass ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={form.password}
                                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            className="w-full bg-background border border-border rounded-lg pl-9 pr-10 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-muted-foreground text-foreground"
                                            autoComplete="current-password"
                                        />
                                        <button type="button" onClick={() => setShowPass(s => !s)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none">
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
                            </motion.form>
                        )}

                        {/* ── Request OTP Form ───────── */}
                        {view === 'forgot' && (
                            <motion.form
                                key="forgot"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                onSubmit={handleRequestReset}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-2">Registered Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="reset-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={resetForm.email}
                                            onChange={e => { setResetForm(f => ({ ...f, email: e.target.value })); setError(''); }}
                                            className="w-full bg-muted/50 border border-border rounded-xl pl-11 pr-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-foreground placeholder:text-muted-foreground"
                                            autoComplete="email"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-3 text-center uppercase tracking-widest leading-relaxed">
                                        We'll send a 6-digit code to your inbox
                                    </p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !resetForm.email}
                                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-60 transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Sending OTP...' : 'Send Verification Code'}
                                    {!loading && <KeyRound size={16} />}
                                </button>
                                <button type="button" onClick={goBackToLogin}
                                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground font-semibold flex items-center justify-center gap-1.5 transition-colors">
                                    <ArrowLeft size={14} /> Back to Sign In
                                </button>
                            </motion.form>
                        )}

                        {/* ── Verify OTP Form ───────── */}
                        {view === 'verify' && (
                            <motion.form
                                key="verify"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                onSubmit={handleVerifyOTP}
                                className="space-y-6"
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Verification Code</label>
                                        <button
                                            type="button"
                                            onClick={handleRequestReset}
                                            disabled={loading}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold disabled:opacity-50"
                                        >
                                            {loading ? 'Sending...' : 'Resend OTP'}
                                        </button>
                                    </div>
                                    <div className="flex gap-2 justify-between">
                                        {/* Traditional single input for simplicity in this replacement chunk, 
                                            but styled to look premium with tracking-widest */}
                                        <input
                                            id="reset-otp"
                                            type="text"
                                            placeholder="0 0 0 0 0 0"
                                            maxLength={6}
                                            value={resetForm.otp}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setResetForm(f => ({ ...f, otp: val }));
                                                setError('');
                                            }}
                                            className="w-full bg-muted/40 border border-border rounded-xl px-4 py-4 text-center tracking-[1em] font-mono text-2xl font-black focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-muted-foreground/30 text-foreground"
                                            autoComplete="one-time-code"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground/60 font-medium text-center mt-4 uppercase tracking-widest">Enter the 6-digit code</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || resetForm.otp.length < 6}
                                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                                >
                                    {loading ? 'Verifying...' : 'Verify Code'}
                                </button>
                                <button type="button" onClick={goBackToLogin}
                                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground font-semibold flex items-center justify-center gap-1.5 transition-colors">
                                    <ArrowLeft size={14} /> Back to Sign In
                                </button>
                            </motion.form>
                        )}

                        {/* ── Set New Password Form ───────── */}
                        {view === 'reset-password' && (
                            <motion.form
                                key="reset-password"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                onSubmit={handleResetPassword}
                                className="space-y-5"
                            >
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-2">New Password</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="reset-new-password"
                                            type={showNewPass ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={resetForm.newPassword}
                                            onChange={e => { setResetForm(f => ({ ...f, newPassword: e.target.value })); setError(''); }}
                                            className="w-full bg-muted/50 border border-border rounded-xl pl-11 pr-12 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-foreground"
                                            autoComplete="new-password"
                                            autoFocus
                                        />
                                        <button type="button" onClick={() => setShowNewPass(s => !s)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                            {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-2">Confirm Password</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="reset-confirm-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={resetForm.confirm}
                                            onChange={e => { setResetForm(f => ({ ...f, confirm: e.target.value })); setError(''); }}
                                            className={`w-full bg-muted/50 border rounded-xl pl-11 pr-4 py-3 text-sm font-medium outline-none transition-all text-foreground focus:ring-4
                                                ${resetForm.confirm && resetForm.newPassword !== resetForm.confirm
                                                    ? 'border-rose-300 focus:ring-rose-500/10 focus:border-rose-400'
                                                    : 'border-border focus:border-indigo-500 focus:ring-indigo-500/10'
                                                }`}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    {resetForm.confirm && resetForm.newPassword !== resetForm.confirm && (
                                        <p className="text-rose-500 text-xs font-bold mt-2">Passwords do not match</p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !resetForm.newPassword || resetForm.newPassword !== resetForm.confirm}
                                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                                >
                                    {loading ? 'Updating...' : <><KeyRound size={16} /> Update Password</>}
                                </button>
                                <button type="button" onClick={goBackToLogin}
                                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground font-semibold flex items-center justify-center gap-1.5 transition-colors">
                                    <ArrowLeft size={14} /> Cancel
                                </button>
                            </motion.form>
                        )}

                        {/* ── Success state ──────────────────────── */}
                        {view === 'reset-done' && (
                            <motion.div
                                key="reset-done"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="text-center py-4"
                            >
                                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100 dark:border-emerald-700">
                                    <CheckCircle size={40} className="text-emerald-500" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-black text-foreground mb-2">Password Secured!</h3>
                                <p className="text-muted-foreground text-[15px] font-medium leading-relaxed mb-8">
                                    Your account password has been updated. You can now sign in with your new credentials.
                                </p>
                                <button
                                    onClick={goBackToLogin}
                                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                                >
                                    Continue to Sign In
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {view === 'login' && (
                        <>
                            {/* Demo quick-login (dev/test builds only — the backend
                                disables /auth/demo in production) */}
                            {!import.meta.env.PROD && (
                                <div className="mt-6 pt-6 border-t border-border">
                                    <p className="text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">
                                        Quick Demo Login
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DEMO_ROLES.map(({ role, label, emoji }) => (
                                            <button
                                                key={role}
                                                type="button"
                                                disabled={loading}
                                                onClick={async () => {
                                                    setLoading(true); setError('');
                                                    try {
                                                        const user = await demoLogin(role);
                                                        navigate(ROLE_HOMES[user.role] || from, { replace: true });
                                                    } catch (err) {
                                                        setError(err.message || 'Demo login failed');
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-border hover:border-indigo-200 transition-all text-xs font-bold text-foreground/80 hover:text-indigo-700 disabled:opacity-50"
                                            >
                                                <span>{emoji}</span>
                                                <span>{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-center text-[11px] text-muted-foreground/50 font-medium mt-3">
                                        One click, no password needed.
                                    </p>
                                </div>
                            )}
                            <p className="text-center text-muted-foreground text-sm mt-5">
                                Don't have an account?{' '}
                                <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-bold">Create one free</Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
