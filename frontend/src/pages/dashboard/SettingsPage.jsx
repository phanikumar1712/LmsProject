import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    User, Moon, Sun, Bell, Save, Camera, Loader2, Mail, Shield,
    GraduationCap, Building2, CheckCheck, Trash2, AlertTriangle, Inbox, ArrowRight, Palette, Lock, Key,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI, uploadAPI, notificationsAPI } from '../../services/api';
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

    const TABS = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
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
