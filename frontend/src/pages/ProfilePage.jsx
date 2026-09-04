import { useState, useRef, useEffect } from 'react';
import { User, Lock, Camera, Save, Shield, Mail, Calendar, Upload, Loader2, MessageSquare, Star, Key, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, uploadAPI, ratingsAPI } from '../services/api';
import ChangePasswordForm from '../components/ui/ChangePasswordForm';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
    STUDENT: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    INSTRUCTOR: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    ADMIN: 'text-amber-600 bg-amber-50 border-amber-200',
    SUPER_ADMIN: 'text-rose-600 bg-rose-50 border-rose-200',
};

function ProfileHeader({ user, form, uploadingPhoto, fileInputRef, handlePhotoUpload, handleRemovePhoto, removingPhoto }) {
    return (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
            </div>
            <div className="px-5 sm:px-8 pb-6">
                <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-14 sm:-mt-16">
                    <div className="relative flex-shrink-0">
                        {form.avatar ? (
                            <img src={form.avatar} alt={user?.name}
                                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-4 border-background object-cover shadow-xl" />
                        ) : (
                            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-4 border-background bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl">
                                <span className="text-white text-4xl font-extrabold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                            </div>
                        )}
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                            className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-full flex items-center justify-center shadow-lg transition-colors border-2 border-background"
                            title="Upload profile photo">
                            {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" id="profile-photo-input" />
                        {form.avatar && (
                            <button onClick={handleRemovePhoto} disabled={removingPhoto}
                                className="absolute -bottom-1 -left-1 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors border-2 border-background text-[10px] font-bold">
                                {removingPhoto ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                            </button>
                        )}
                    </div>
                    <div className="flex-1 text-center sm:text-left min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{user?.name}</h1>
                        <p className="text-muted-foreground text-sm font-medium flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                            <Mail size={13} /> {user?.email}
                        </p>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                            <span className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border ${ROLE_COLORS[user?.role] || ROLE_COLORS.STUDENT}`}>
                                {user?.role?.replace('_', ' ')}
                            </span>
                            {user?.createdAt && (
                                <span className="text-muted-foreground/60 text-xs font-medium flex items-center gap-1.5">
                                    <Calendar size={12} /> Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PersonalInfoForm({ form, handleChange, handleSave, saving, fileInputRef, uploadingPhoto, handleRemovePhoto, removingPhoto, user }) {
    const inputCls = 'w-full bg-card border border-border text-foreground placeholder:text-muted-foreground/60 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow';

    return (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-extrabold text-foreground mb-6 flex items-center gap-2">
                <User size={18} className="text-indigo-600" /> Personal Information
            </h3>
            <form onSubmit={handleSave} className="space-y-5">
                <div>
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Full Name *</label>
                    <input type="text" name="name" value={form.name} onChange={handleChange} className={inputCls} placeholder="Enter your full name" required />
                </div>
                <div>
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Profile Photo</label>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors border border-indigo-200">
                            {uploadingPhoto ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                        </button>
                        {form.avatar && (
                            <button type="button" onClick={handleRemovePhoto} disabled={removingPhoto}
                                className="text-xs font-bold text-rose-500 hover:text-rose-700 disabled:opacity-60 transition-colors">
                                {removingPhoto ? 'Removing...' : 'Remove'}
                            </button>
                        )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 font-medium mt-1.5">Upload a profile photo (max 5MB). Supported: JPG, PNG, WebP.</p>
                </div>
                <div>
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Email Address</label>
                    <div className="relative">
                        <input type="email" value={user?.email} className={`${inputCls} bg-muted/40 text-muted-foreground/60 cursor-not-allowed`} disabled />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">Locked</span>
                    </div>
                </div>
                <div>
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Phone Number</label>
                    <input type="tel" name="phone" value={form.phone || ''} onChange={handleChange} className={inputCls} placeholder="e.g. +91 98765 43210" maxLength="30" />
                </div>
                {user?.role === 'STUDENT' && (
                    <div>
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Academic Information</label>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {[
                                { label: 'Student ID / Roll No', value: user?.rollNo || '—' },
                                { label: 'Department', value: user?.departmentName || '—' },
                                { label: 'Year', value: user?.year || '—' },
                                { label: 'Semester', value: user?.semester || '—' },
                                { label: 'Section', value: user?.section || '—' },
                            ].map(({ label, value }) => (
                                <div key={label} className="p-3 bg-muted/40 rounded-xl border border-border">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">{label}</p>
                                    <p className="text-foreground font-bold text-sm truncate">{value}</p>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 font-medium mt-2 flex items-center gap-1.5">
                            <Shield size={12} className="text-amber-500" />
                            Academic fields are managed by your department admin and cannot be changed here.
                        </p>
                    </div>
                )}
                <div>
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Bio / About Me</label>
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
    );
}

function SecurityForm({ user }) {
    const isAdmin = user?.role === 'ADMIN';
    return (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-extrabold text-foreground mb-6 flex items-center gap-2">
                <Key size={18} className="text-indigo-600" /> Change Password
            </h3>
            {isAdmin ? (
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
    );
}

function AccountInfo({ user }) {
    return (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" /> Account Information
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
                {[
                    { label: 'User ID', value: user?.id, icon: Shield },
                    { label: 'Account Role', value: user?.role?.replace('_', ' '), icon: User },
                    { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—', icon: Calendar },
                    { label: 'Email', value: user?.email, icon: Mail },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                        <div className="w-9 h-9 bg-card rounded-lg border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Icon size={16} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
                            <p className="text-foreground font-bold text-sm mt-0.5 truncate">{value}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t border-border pt-6">
                <h4 className="text-foreground font-bold mb-3 flex items-center gap-2 text-sm">
                    <AlertTriangle size={16} className="text-rose-500" /> Danger Zone
                </h4>
                <div className="border border-rose-200 bg-gradient-to-r from-rose-50 to-transparent dark:from-rose-950/30 rounded-xl p-5">
                    <p className="text-rose-700 font-bold text-sm mb-1">Delete Account</p>
                    <p className="text-rose-500 text-xs font-medium mb-4">This will permanently delete your account and all your data. This cannot be undone.</p>
                    <button onClick={() => toast.error('Account deletion requires contacting support. Please email support@edunexus.com')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors">
                        Request Account Deletion
                    </button>
                </div>
            </div>
        </div>
    );
}

function ReviewsTab({ myReviews, loadingReviews }) {
    return (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-600" /> My Course Feedback
                </h3>
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold">{myReviews.length} Reviews</span>
            </div>
            {loadingReviews ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/60 gap-3">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="text-sm font-medium">Loading your feedback...</p>
                </div>
            ) : myReviews.length === 0 ? (
                <div className="py-20 text-center bg-muted/40 border border-dashed border-border rounded-2xl">
                    <MessageSquare className="mx-auto mb-4 text-muted-foreground/30" size={40} />
                    <h4 className="text-foreground font-bold">No reviews yet</h4>
                    <p className="text-muted-foreground text-sm max-w-[240px] mx-auto mt-1">Start learning a course and share your experience with others.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {myReviews.map(r => (
                        <div key={r.id} className="p-5 bg-muted/40 rounded-2xl border border-border hover:border-indigo-100 transition-colors">
                            <div className="flex justify-between items-start gap-4 mb-3">
                                <div>
                                    <h4 className="text-foreground font-bold text-sm leading-snug">{r.courseTitle}</h4>
                                    <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-1">
                                        Reviewed on {new Date(r.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 bg-amber-50 text-amber-500 px-2 py-0.5 rounded-lg border border-amber-100 shrink-0">
                                    <span className="text-xs font-black">{r.stars}</span>
                                    <Star size={12} fill="currentColor" />
                                </div>
                            </div>
                            <p className="text-muted-foreground text-sm italic">"{r.comment || 'No comment provided.'}"</p>
                            {r.instructorReply && (
                                <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50/50 to-transparent border border-indigo-200/30 rounded-xl">
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Instructor Reply:</p>
                                    <p className="text-muted-foreground text-xs">{r.instructorReply}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    // When an admin force-reset the password, land directly on the Security tab
    // so the user changes it before anything else.
    const [activeTab, setActiveTab] = useState(user?.mustChangePassword && user?.role !== 'ADMIN' ? 'security' : 'profile');
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [removingPhoto, setRemovingPhoto] = useState(false);
    const [myReviews, setMyReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({ name: user?.name || '', bio: user?.bio || '', avatar: user?.avatar || '', phone: user?.phone || '' });

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

    useEffect(() => {
        if (activeTab !== 'reviews' || !user) return;
        let cancelled = false;
        const loadReviews = async () => {
            try { setLoadingReviews(true); const reviews = await ratingsAPI.getByStudent(user.id); if (!cancelled) setMyReviews(reviews); }
            catch { if (!cancelled) toast.error('Failed to load reviews'); }
            finally { if (!cancelled) setLoadingReviews(false); }
        };
        loadReviews();
        return () => { cancelled = true; };
    }, [activeTab, user]);

    const TABS = [
        { id: 'profile', label: 'Edit Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'reviews', label: 'My Reviews', icon: MessageSquare },
        { id: 'account', label: 'Account Info', icon: Shield },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <div>
                <h1 className="text-3xl font-extrabold text-foreground tracking-tight">My Profile</h1>
                <p className="text-muted-foreground font-medium mt-1">Manage your personal information and account settings</p>
            </div>

            <ProfileHeader user={user} form={form} uploadingPhoto={uploadingPhoto} fileInputRef={fileInputRef}
                handlePhotoUpload={handlePhotoUpload} handleRemovePhoto={handleRemovePhoto} removingPhoto={removingPhoto} />

            <div className="flex gap-1 bg-muted p-1 rounded-xl">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'}`}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {activeTab === 'profile' && <PersonalInfoForm form={form} handleChange={handleChange} handleSave={handleSave} saving={saving}
                fileInputRef={fileInputRef} uploadingPhoto={uploadingPhoto}
                handleRemovePhoto={handleRemovePhoto} removingPhoto={removingPhoto} user={user} />}

            {activeTab === 'security' && <SecurityForm user={user} />}

            {activeTab === 'account' && <AccountInfo user={user} />}

            {activeTab === 'reviews' && <ReviewsTab myReviews={myReviews} loadingReviews={loadingReviews} />}
        </div>
    );
}