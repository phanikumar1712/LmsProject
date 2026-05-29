import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';

    const [form, setForm] = useState({ email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const QUICK_LOGINS = [
        { label: 'Student', email: 'student@demo.com', password: 'demo123', color: '#4f46e5' },
        { label: 'Instructor', email: 'instructor@demo.com', password: 'demo123', color: '#0891b2' },
        { label: 'Admin', email: 'admin@demo.com', password: 'demo123', color: '#d97706' },
        { label: 'Super Admin', email: 'superadmin@lms.com', password: 'admin123', color: '#e11d48' },
    ];

    const ROLE_HOMES = {
        STUDENT: '/student', INSTRUCTOR: '/instructor',
        ADMIN: '/admin', SUPER_ADMIN: '/super-admin',
    };

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

    const quickLogin = async (email, password) => {
        setForm({ email, password });
        setLoading(true); setError('');
        try {
            const user = await login(email, password);
            navigate(ROLE_HOMES[user.role] || from, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">
                            EduNexus
                        </span>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
                    <p className="text-slate-500 text-sm">Sign in to continue learning</p>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                    {/* Quick logins */}
                    <div className="mb-6">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Quick Demo Access</p>
                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_LOGINS.map(({ label, email, password, color }) => (
                                <button
                                    key={label}
                                    onClick={() => quickLogin(email, password)}
                                    disabled={loading}
                                    className="py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all hover:bg-slate-50 disabled:opacity-50"
                                    style={{ borderColor: `${color}30`, color }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-slate-400 text-xs uppercase font-medium">or sign in manually</span>
                        <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-lg px-4 py-3 mb-4">
                            <AlertCircle size={15} className="flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

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
                                <button type="button" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Forgot password?</button>
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
                            {loading ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-slate-600 text-sm mt-6">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">Create one free</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
