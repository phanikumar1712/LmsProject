import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';


export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'STUDENT' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const ROLE_HOMES = { STUDENT: '/student', INSTRUCTOR: '/instructor' };

    const passwordStrength = (pass) => {
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;
        return score;
    };

    const strength = passwordStrength(form.password);
    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
    const strengthColor = ['', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4'][strength];

    const validate = () => {
        if (!form.name.trim()) return 'Name is required';
        if (!form.email.trim()) return 'Email is required';
        if (!/\S+@\S+\.\S+/.test(form.email)) return 'Invalid email address';
        if (form.password.length < 8) return 'Password must be at least 8 characters';
        if (form.password !== form.confirm) return 'Passwords do not match';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const err = validate();
        if (err) { setError(err); return; }
        setLoading(true); setError('');
        try {
            const user = await register(form.name, form.email, form.password, form.role);
            navigate(ROLE_HOMES[user.role] || '/', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
            <div className="w-full max-w-lg relative z-10">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                            <GraduationCap size={22} className="text-white" />
                        </div>
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">
                            EduNexus
                        </span>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
                    <p className="text-slate-500 text-sm">Join EduNexus and start learning today</p>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-lg px-4 py-3 mb-5">
                            <AlertCircle size={15} className="flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-700 font-medium block mb-1.5">Full Name</label>
                            <div className="relative">
                                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input id="reg-name" type="text" placeholder="John Doe"
                                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400" autoComplete="name" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-slate-700 font-medium block mb-1.5">Email Address</label>
                            <div className="relative">
                                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input id="reg-email" type="email" placeholder="you@example.com"
                                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400" autoComplete="email" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-slate-700 font-medium block mb-1.5">Password</label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input id="reg-password" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-10 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400" autoComplete="new-password" />
                                <button type="button" onClick={() => setShowPass(s => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none">
                                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            {form.password && (
                                <div className="mt-2 text-left">
                                    <div className="flex gap-1 mb-1.5">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ background: i <= strength ? strengthColor : '#e2e8f0' }} />
                                        ))}
                                    </div>
                                    <p className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</p>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-slate-700 font-medium block mb-1.5">Confirm Password</label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input id="reg-confirm" type="password" placeholder="Re-enter password"
                                    value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-10 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400" autoComplete="new-password" />
                                {form.confirm && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {form.password === form.confirm
                                            ? <CheckCircle size={15} className="text-emerald-500" />
                                            : <AlertCircle size={15} className="text-rose-500" />}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button type="submit" disabled={loading} id="register-submit"
                            className="w-full py-2.5 mt-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm">
                            {loading
                                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
                                : 'Create Account'}
                        </button>
                    </form>

                    <p className="text-center text-slate-600 text-sm mt-6">
                        Already have an account?{' '}
                        <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
