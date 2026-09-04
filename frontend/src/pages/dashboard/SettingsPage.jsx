import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    User, Moon, Sun, Bell, Save, Camera, Loader2, Mail, Shield,
    GraduationCap, Building2, CheckCheck, Trash2, AlertTriangle, Inbox, ArrowRight, Palette, Lock, Key,
    MessageSquare, Send, ChevronDown, ChevronUp, Clock, CircleDot, CheckCircle, XCircle, Headphones,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI, uploadAPI, notificationsAPI, supportAPI } from '../../services/api';
import useDarkMode from '../../hooks/useDarkMode';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingContainer } from '../../components/ui/Feedback';
import ChangePasswordForm from '../../components/ui/ChangePasswordForm';
import toast from 'react-hot-toast';

const inputCls = 'w-full bg-card border border-border text-foreground placeholder:text-muted-foreground/60 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow';
const labelCls = 'text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2';

const ROLE_ICONS = {
    STUDENT: { icon: GraduationCap, label: 'Student ID / Roll No', value: (u) => u?.rollNo || '—' },
    ADMIN: { icon: Building2, label: 'Department', value: (u) => u?.departmentName || '—' },
};

export default function SettingsPage() {
    const { user, updateUser } = useAuth();
    const role = user?.role;
    const isStudent = role === 'STUDENT';

    const [activeTab, setActiveTab] = useState('profile');
    const [form, setForm] = useState({ name: user?.name || '', bio: user?.bio || '', avatar: user?.avatar || '', phone: user?.phone || '' });
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [removingPhoto, setRemovingPhoto] = useState(false);
    const fileInputRef = useRef(null);

    // Preferences
    const [dark, toggleDark] = useDarkMode();

    // Notifications tab
    const [notifs, setNotifs] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const [clearing, setClearing] = useState(false);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
        setUploadingPhoto(true);
        try {
            const result = await uploadAPI.uploadProfilePhoto(file);
            setForm(prev => ({ ...prev, avatar: result.url }));
            const updated = await authAPI.updateProfile(user.id, { name: form.name.trim() || user.name, bio: form.bio?.trim() || user.bio || '', avatar: result.url, phone: form.phone?.trim() || '' });
            updateUser(updated);
            toast.success('Profile photo updated!');
        } catch (err) { toast.error(err.message || 'Failed to upload photo'); }
        finally { setUploadingPhoto(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Name cannot be empty'); return; }
        setSaving(true);
        try {
            const updated = await authAPI.updateProfile(user.id, { name: form.name.trim(), bio: form.bio.trim(), avatar: form.avatar, phone: form.phone?.trim() || '' });
            updateUser(updated);
            toast.success('Profile updated successfully!');
        } catch (err) { toast.error(err.message || 'Failed to update profile'); }
        finally { setSaving(false); }
    };

    const handleRemovePhoto = async () => {
        if (!user || removingPhoto) return;
        const previousAvatar = form.avatar;
        setRemovingPhoto(true);
        setForm(prev => ({ ...prev, avatar: '' }));
        try {
            const updated = await authAPI.updateProfile(user.id, { name: form.name.trim() || user.name, bio: form.bio?.trim() || user.bio || '', avatar: '', phone: form.phone?.trim() || '' });
            updateUser(updated);
            toast.success('Profile photo removed');
        } catch (err) { setForm(prev => ({ ...prev, avatar: previousAvatar })); toast.error(err.message || 'Failed to remove photo'); }
        finally { setRemovingPhoto(false); }
    };

    // Load a small preview of unread notifications when the tab opens
    useEffect(() => {
        if (activeTab !== 'notifications') return;
        let cancelled = false;
        setLoadingNotifs(true);
        notificationsAPI.getPage({ limit: 10, offset: 0 })
            .then(({ data }) => { if (!cancelled) setNotifs(data || []); })
            .catch(() => { if (!cancelled) toast.error('Failed to load notifications'); })
            .finally(() => { if (!cancelled) setLoadingNotifs(false); });
        return () => { cancelled = true; };
    }, [activeTab]);

    const unreadCount = notifs.filter(n => !n.read).length;

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        try {
            await notificationsAPI.markAllRead();
            setNotifs(prev => prev.map(n => ({ ...n, read: true })));
            toast.success('All notifications marked as read');
        } catch (err) { toast.error(err.message || 'Failed to mark notifications as read'); }
        finally { setMarkingAll(false); }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
        setClearing(true);
        try {
            await notificationsAPI.clearAll();
            setNotifs([]);
            toast.success('All notifications cleared');
        } catch (err) { toast.error(err.message || 'Failed to clear notifications'); }
        finally { setClearing(false); }
    };

    const timeAgo = (iso) => {
        const s = Math.floor((Date.now() - new Date(iso)) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // ── Support Requests state (ADMIN / INSTRUCTOR only) ──
    const [supportRequests, setSupportRequests] = useState([]);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [showNewRequest, setShowNewRequest] = useState(false);
    const [supportForm, setSupportForm] = useState({ requestType: 'general', subject: '', message: '', priority: 'medium' });
    const [submittingSupport, setSubmittingSupport] = useState(false);
    const [supportFilter, setSupportFilter] = useState('');
    const [expandedRequest, setExpandedRequest] = useState(null);

    const loadSupportRequests = async (status) => {
        setLoadingSupport(true);
        try {
            const data = await supportAPI.getMyRequests(status || undefined);
            setSupportRequests(Array.isArray(data) ? data : []);
        } catch (err) { toast.error('Failed to load support requests'); }
        finally { setLoadingSupport(false); }
    };

    useEffect(() => {
        if (activeTab === 'support') loadSupportRequests(supportFilter);
    }, [activeTab, supportFilter]);

    const handleSupportSubmit = async (e) => {
        e.preventDefault();
        if (!supportForm.subject.trim() || !supportForm.message.trim()) { toast.error('Subject and message are required'); return; }
        setSubmittingSupport(true);
        try {
            await supportAPI.createRequest(supportForm);
            toast.success('Request sent to Super Admin! You will be notified when they respond.');
            setShowNewRequest(false);
            setSupportForm({ requestType: 'general', subject: '', message: '', priority: 'medium' });
            loadSupportRequests(supportFilter);
        } catch (err) { toast.error(err.message || 'Failed to send request'); }
        finally { setSubmittingSupport(false); }
    };

    const SUPPORT_TYPES = [
        { value: 'password_reset', label: 'Password Reset', desc: 'Request a password reset (admin accounts)' },
        { value: 'permission_request', label: 'Permission Request', desc: 'Request additional permissions or access' },
        { value: 'account_issue', label: 'Account Issue', desc: 'Account-related problems or concerns' },
        { value: 'bug_report', label: 'Bug Report', desc: 'Report a bug or technical issue' },
        { value: 'general', label: 'General Inquiry', desc: 'General questions or support needs' },
    ];

    const PRIORITY_OPTIONS = [
        { value: 'low', label: 'Low', color: 'text-muted-foreground bg-muted' },
        { value: 'medium', label: 'Medium', color: 'text-amber-600 bg-amber-50' },
        { value: 'high', label: 'High', color: 'text-orange-600 bg-orange-50' },
        { value: 'urgent', label: 'Urgent', color: 'text-rose-600 bg-rose-50' },
    ];

    const STATUS_CONFIG = {
        OPEN: { icon: CircleDot, color: 'text-blue-600 bg-blue-50', label: 'Open' },
        IN_PROGRESS: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'In Progress' },
        RESOLVED: { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50', label: 'Resolved' },
        CLOSED: { icon: XCircle, color: 'text-muted-foreground bg-muted', label: 'Closed' },
    };

    const TABS = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        ...(role === 'ADMIN' || role === 'INSTRUCTOR' ? [{ id: 'support', label: 'Support', icon: Headphones }] : []),
        { id: 'preferences', label: 'Preferences', icon: Palette },
        { id: 'notifications', label: 'Notifications', icon: Bell },
    ];

    const roleInfo = ROLE_ICONS[role] || null;
    const RoleIcon = roleInfo?.icon;

    return (
        <div className="space-y-6 max-w-3xl mx-auto pb-12">
            <PageHeader
                title="Settings"
                subtitle="Manage your profile, preferences, and notifications"
            />

            {/* Tabs */}
            <div className="flex gap-1 bg-muted p-1 rounded-xl">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'}`}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {/* ── Profile ─────────────────────────────────────────────────── */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                        <h3 className="text-lg font-extrabold text-foreground mb-6 flex items-center gap-2">
                            <User size={18} className="text-indigo-600" /> Personal Information
                        </h3>
                        <form onSubmit={handleSave} className="space-y-5">
                            <div className="flex items-center gap-5">
                                <div className="relative flex-shrink-0">
                                    {form.avatar ? (
                                        <img src={form.avatar} alt={user?.name} className="w-20 h-20 rounded-2xl border-2 border-border object-cover shadow-sm" />
                                    ) : (
                                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                                            <span className="text-white text-2xl font-extrabold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                                        className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-full flex items-center justify-center shadow-lg transition-colors border-2 border-background"
                                        title="Upload profile photo">
                                        {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-foreground truncate">{user?.name}</p>
                                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                                        <Mail size={13} /> {user?.email}
                                    </p>
                                    {form.avatar && (
                                        <button type="button" onClick={handleRemovePhoto} disabled={removingPhoto}
                                            className="text-xs font-bold text-rose-500 hover:text-rose-700 mt-1.5 transition-colors">
                                            {removingPhoto ? 'Removing...' : 'Remove photo'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Full Name *</label>
                                <input type="text" name="name" value={form.name} onChange={handleChange} className={inputCls} placeholder="Enter your full name" required />
                            </div>
                            <div>
                                <label className={labelCls}>Email Address</label>
                                <div className="relative">
                                    <input type="email" value={user?.email} className={`${inputCls} bg-muted/40 text-muted-foreground/60 cursor-not-allowed`} disabled />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">Locked</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Phone Number</label>
                                <input type="tel" name="phone" value={form.phone || ''} onChange={handleChange} className={inputCls} placeholder="e.g. +91 98765 43210" maxLength="30" />
                            </div>
                            <div>
                                <label className={labelCls}>Bio / About Me</label>
                                <textarea name="bio" value={form.bio} onChange={handleChange} className={`${inputCls} min-h-[100px] resize-y`} placeholder="Tell others a little about yourself..." />
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">
                                    {saving
                                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                                        : <><Save size={16} /> Save Changes</>}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Role-specific read-only info */}
                    {roleInfo && (
                        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                            <h3 className="text-lg font-extrabold text-foreground mb-5 flex items-center gap-2">
                                {RoleIcon && <RoleIcon size={18} className="text-indigo-600" />} {isStudent ? 'Academic Information' : 'Department Information'}
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-3">
                                {[
                                    { label: roleInfo.label, value: roleInfo.value(user) },
                                    { label: 'Role', value: user?.role?.replace('_', ' ') },
                                    ...(isStudent ? [
                                        { label: 'Year', value: user?.year || '—' },
                                        { label: 'Semester', value: user?.semester || '—' },
                                        { label: 'Section', value: user?.section || '—' },
                                        { label: 'Batch', value: user?.batch || '—' },
                                    ] : [
                                        { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—' },
                                    ]),
                                ].map(({ label, value }) => (
                                    <div key={label} className="p-3 bg-muted/40 rounded-xl border border-border">
                                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">{label}</p>
                                        <p className="text-foreground font-bold text-sm truncate">{value}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground/60 font-medium mt-2 flex items-center gap-1.5">
                                <Shield size={12} className="text-amber-500" />
                                {isStudent
                                    ? 'Academic fields are managed by your department admin and cannot be changed here.'
                                    : 'Department assignment is managed by the Super Admin.'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Security ──────────────────────────────────────────────── */}
            {activeTab === 'security' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                        <h3 className="text-lg font-extrabold text-foreground mb-6 flex items-center gap-2">
                            <Key size={18} className="text-indigo-600" /> Change Password
                        </h3>
                        {role === 'ADMIN' ? (
                            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                                <Shield size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Password managed by Super Admin</p>
                                    <p className="text-sm text-amber-700/80 dark:text-amber-200/70 mt-1 leading-relaxed">
                                        Admin passwords are managed by the Super Admin for security. Contact the Super Admin to reset your password.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ChangePasswordForm />
                        )}
                    </div>
                </div>
            )}

            {/* ── Preferences ─────────────────────────────────────────────── */}
            {activeTab === 'preferences' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                        <h3 className="text-lg font-extrabold text-foreground mb-6 flex items-center gap-2">
                            <Palette size={18} className="text-indigo-600" /> Appearance
                        </h3>
                        <button
                            onClick={toggleDark}
                            className="w-full flex items-center justify-between gap-4 p-5 bg-muted/40 border border-border rounded-2xl hover:bg-muted/70 transition-colors text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                                    {dark ? <Moon size={20} /> : <Sun size={20} />}
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-sm">Dark Mode</p>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">Switch between light and dark appearance. Saved on this device.</p>
                                </div>
                            </div>
                            <span className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${dark ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </span>
                        </button>
                        <p className="text-[11px] text-muted-foreground/60 font-medium mt-4 flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-amber-500" />
                            More preferences (language, email digests) are coming soon.
                        </p>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                        <h3 className="text-lg font-extrabold text-foreground mb-3 flex items-center gap-2">
                            <Bell size={18} className="text-indigo-600" /> Notification Preferences
                        </h3>
                        <p className="text-sm text-muted-foreground font-medium mb-4">
                            You'll receive in-app notifications for announcements, grades, quizzes, and course activity.
                        </p>
                        <Link to="/notifications"
                            className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors">
                            Open Notifications Center <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* ── Support Requests (ADMIN / INSTRUCTOR) ────────────────────── */}
            {activeTab === 'support' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Headphones size={18} className="text-indigo-600" /> Contact Super Admin
                            </h3>
                            <button
                                onClick={() => setShowNewRequest(!showNewRequest)}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
                            >
                                <Send size={14} /> New Request
                            </button>
                        </div>

                        <p className="text-sm text-muted-foreground font-medium mb-6">
                            Submit requests to the Super Admin for password resets, permission changes, account issues, or general support.
                        </p>

                        {/* New Request Form */}
                        {showNewRequest && (
                            <form onSubmit={handleSupportSubmit} className="mb-6 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-6 space-y-5">
                                <h4 className="font-extrabold text-sm flex items-center gap-2">
                                    <MessageSquare size={15} className="text-indigo-600" /> New Support Request
                                </h4>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-2">Request Type</label>
                                        <select
                                            value={supportForm.requestType}
                                            onChange={e => setSupportForm(p => ({ ...p, requestType: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        >
                                            {SUPPORT_TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-2">Priority</label>
                                        <div className="flex gap-2">
                                            {PRIORITY_OPTIONS.map(p => (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => setSupportForm(prev => ({ ...prev, priority: p.value }))}
                                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                        supportForm.priority === p.value
                                                            ? `${p.color} ring-2 ring-offset-1 ring-indigo-500/20`
                                                            : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                                                    }`}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-2">Subject *</label>
                                    <input
                                        type="text"
                                        value={supportForm.subject}
                                        onChange={e => setSupportForm(p => ({ ...p, subject: e.target.value }))}
                                        placeholder="Brief summary of your request"
                                        className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-2">Message *</label>
                                    <textarea
                                        rows={4}
                                        value={supportForm.message}
                                        onChange={e => setSupportForm(p => ({ ...p, message: e.target.value }))}
                                        placeholder="Describe your request in detail. Include any relevant information that will help the Super Admin assist you."
                                        className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                                        required
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                        Your request will be sent to all Super Admins. You'll receive a notification when they respond.
                                    </p>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setShowNewRequest(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors">Cancel</button>
                                        <button type="submit" disabled={submittingSupport}
                                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
                                            {submittingSupport ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send Request</>}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Filter */}
                        <div className="flex gap-2 flex-wrap mb-5">
                            {[{ value: '', label: 'All' }, { value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'RESOLVED', label: 'Resolved' }].map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setSupportFilter(f.value)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        supportFilter === f.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Request List */}
                        {loadingSupport ? (
                            <LoadingContainer height="h-40" />
                        ) : supportRequests.length === 0 ? (
                            <div className="py-12 text-center bg-muted/40 border border-dashed border-border rounded-2xl">
                                <Headphones size={36} className="mx-auto mb-3 text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">No support requests yet</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Click "New Request" to contact the Super Admin</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {supportRequests.map(req => {
                                    const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.OPEN;
                                    const StatusIcon = statusConf.icon;
                                    const isExpanded = expandedRequest === req.id;
                                    return (
                                        <div key={req.id} className="border border-border rounded-2xl overflow-hidden bg-card">
                                            <button
                                                onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                                                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusConf.color}`}>
                                                    <StatusIcon size={15} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-foreground truncate">{req.subject}</p>
                                                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                                        {SUPPORT_TYPES.find(t => t.value === req.requestType)?.label || req.requestType} · {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusConf.color}`}>{statusConf.label}</span>
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${PRIORITY_OPTIONS.find(p => p.value === req.priority)?.color || 'bg-muted'}`}>{req.priority}</span>
                                                {isExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                                            </button>
                                            {isExpanded && (
                                                <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Your Message</p>
                                                        <p className="text-sm text-foreground font-medium whitespace-pre-wrap bg-muted/30 rounded-xl p-4">{req.message}</p>
                                                    </div>
                                                    {req.adminResponse && (
                                                        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                                                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">
                                                                Response from {req.responderName || 'Super Admin'}
                                                            </p>
                                                            <p className="text-sm text-foreground font-medium whitespace-pre-wrap">{req.adminResponse}</p>
                                                            {req.respondedAt && (
                                                                <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                                                                    Responded {new Date(req.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Notifications ───────────────────────────────────────────── */}
            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Bell size={18} className="text-indigo-600" /> Recent Notifications
                            </h3>
                            <div className="flex items-center gap-2">
                                <button onClick={handleMarkAllRead} disabled={markingAll || unreadCount === 0}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border hover:bg-muted/60 disabled:opacity-50 rounded-xl text-xs font-bold transition-colors">
                                    {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} className="text-emerald-600" />}
                                    Mark All Read
                                </button>
                                <button onClick={handleClearAll} disabled={clearing || notifs.length === 0}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border hover:bg-muted/60 disabled:opacity-50 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-600 transition-colors">
                                    {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    Clear All
                                </button>
                                <Link to="/notifications"
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors">
                                    View All <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>

                        {loadingNotifs ? (
                            <LoadingContainer height="h-40" />
                        ) : notifs.length === 0 ? (
                            <div className="py-12 text-center bg-muted/40 border border-dashed border-border rounded-2xl">
                                <Inbox size={36} className="mx-auto mb-3 text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">You're all caught up — no notifications.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {notifs.slice(0, 8).map(n => (
                                    <div key={n.id} className={`flex items-start gap-3 p-3.5 rounded-xl border border-border ${n.read ? 'bg-muted/20' : 'bg-indigo-50/40 dark:bg-indigo-950/20'}`}>
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                                            <Bell size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug ${n.read ? 'text-muted-foreground font-medium' : 'text-foreground font-bold'}`}>{n.message}</p>
                                            <p className="text-[11px] font-bold text-muted-foreground/70 mt-0.5">{timeAgo(n.createdAt || n.created_at)}</p>
                                        </div>
                                        {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
