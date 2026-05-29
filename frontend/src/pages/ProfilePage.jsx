import { useState } from 'react';
import { User, Lock, Camera, Save, Shield, Mail, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AVATAR_SEEDS = ['Alex', 'Sarah', 'James', 'Emily', 'Michael', 'Priya', 'Luna', 'Felix', 'Zoe', 'Omar', 'Nina', 'Leo'];

const PLAN_COLORS = {
    FREE: { text: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
    BASIC: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    PRO: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    ENTERPRISE: { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
};

const ROLE_COLORS = {
    STUDENT: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    INSTRUCTOR: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    ADMIN: 'text-amber-600 bg-amber-50 border-amber-200',
    SUPER_ADMIN: 'text-rose-600 bg-rose-50 border-rose-200',
};

export default function ProfilePage() {
    const { user, updateUser } = useAuth();

    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);
    const [changingPwd, setChangingPwd] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);

    const [form, setForm] = useState({
        name: user?.name || '',
        bio: user?.bio || '',
        avatar: user?.avatar || '',
    });

    const [pwdForm, setPwdForm] = useState({
        current: '',
        newPwd: '',
        confirm: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size must be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, avatar: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Name cannot be empty'); return; }
        setSaving(true);
        try {
            const updated = await authAPI.updateProfile(user.id, {
                name: form.name.trim(),
                bio: form.bio.trim(),
                avatar: form.avatar,
            });
            updateUser(updated);
            toast.success('Profile updated successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (!pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm) {
            toast.error('Please fill in all password fields');
            return;
        }
        if (pwdForm.newPwd !== pwdForm.confirm) {
            toast.error('New passwords do not match');
            return;
        }
        if (pwdForm.newPwd.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setChangingPwd(true);
        try {
            await authAPI.changePassword(user.id, pwdForm.current, pwdForm.newPwd);
            toast.success('Password changed successfully!');
            setPwdForm({ current: '', newPwd: '', confirm: '' });
        } catch (err) {
            toast.error(err.message || 'Failed to change password');
        } finally {
            setChangingPwd(false);
        }
    };

    const selectAvatar = (seed) => {
        const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
        setForm(prev => ({ ...prev, avatar: url }));
        setShowAvatarPicker(false);
    };

    const inputCls = 'w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow';

    const plan = user?.subscriptionPlan || 'FREE';
    const planStyle = PLAN_COLORS[plan] || PLAN_COLORS.FREE;

    const TABS = [
        { id: 'profile', label: 'Edit Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'account', label: 'Account Info', icon: Shield },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Profile</h1>
                <p className="text-slate-500 font-medium mt-1">Manage your personal information and account settings</p>
            </div>

            {/* Profile header card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <img
                        src={form.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
                        alt={user?.name}
                        className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-sm bg-slate-100"
                    />
                    <button
                        onClick={() => setShowAvatarPicker(v => !v)}
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                        title="Change avatar"
                    >
                        <Camera size={14} />
                    </button>

                    {/* Avatar picker dropdown */}
                    {showAvatarPicker && (
                        <div className="absolute left-0 top-28 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
                            <p className="text-slate-700 font-bold text-sm mb-3">Choose an avatar style</p>
                            <div className="grid grid-cols-6 gap-2">
                                {AVATAR_SEEDS.map(seed => (
                                    <button
                                        key={seed}
                                        onClick={() => selectAvatar(seed)}
                                        className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all hover:scale-110 ${form.avatar?.includes(`seed=${seed}`) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-100 hover:border-indigo-300'}`}
                                    >
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={seed} className="w-full h-full object-cover bg-slate-50" />
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowAvatarPicker(false)}
                                className="mt-3 w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-xl font-extrabold text-slate-900">{user?.name}</h2>
                    <p className="text-slate-500 text-sm font-medium flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                        <Mail size={13} /> {user?.email}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                        <span className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border ${ROLE_COLORS[user?.role] || ROLE_COLORS.STUDENT}`}>
                            {user?.role?.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border ${planStyle.text} ${planStyle.bg} ${planStyle.border}`}>
                            {plan} Plan
                        </span>
                    </div>
                    {user?.createdAt && (
                        <p className="text-slate-400 text-xs font-medium mt-2 flex items-center justify-center sm:justify-start gap-1.5">
                            <Calendar size={12} /> Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </p>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'profile' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                    <h3 className="text-lg font-extrabold text-slate-900 mb-6">Personal Information</h3>
                    <form onSubmit={handleSave} className="space-y-5">
                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Full Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                className={inputCls}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Upload Custom Avatar</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors shadow-sm cursor-pointer"
                            />
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5">Upload a local image (max 5MB), or click the camera icon on your picture to use a preset avatar.</p>
                        </div>

                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Email Address</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={user?.email}
                                    className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`}
                                    disabled
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Locked</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5">Email cannot be changed. Contact support if needed.</p>
                        </div>

                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Bio / About Me</label>
                            <textarea
                                name="bio"
                                value={form.bio}
                                onChange={handleChange}
                                className={`${inputCls} min-h-[100px] resize-y`}
                                placeholder="Tell others a little about yourself..."
                            />
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                            >
                                {saving
                                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                                    : <><Save size={16} /> Save Changes</>
                                }
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'security' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                    <h3 className="text-lg font-extrabold text-slate-900 mb-2">Change Password</h3>
                    <p className="text-slate-500 text-sm font-medium mb-6">For demo accounts the default password is <span className="font-bold text-slate-700">demo123</span></p>
                    <form onSubmit={handlePasswordChange} className="space-y-5">
                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Current Password *</label>
                            <input
                                type="password"
                                value={pwdForm.current}
                                onChange={e => setPwdForm(p => ({ ...p, current: e.target.value }))}
                                className={inputCls}
                                placeholder="Enter current password"
                            />
                        </div>
                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">New Password *</label>
                            <input
                                type="password"
                                value={pwdForm.newPwd}
                                onChange={e => setPwdForm(p => ({ ...p, newPwd: e.target.value }))}
                                className={inputCls}
                                placeholder="Enter new password (min. 8 chars)"
                            />
                        </div>
                        <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Confirm New Password *</label>
                            <input
                                type="password"
                                value={pwdForm.confirm}
                                onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))}
                                className={`${inputCls} ${pwdForm.confirm && pwdForm.newPwd !== pwdForm.confirm ? 'border-rose-300 focus:ring-rose-100' : ''}`}
                                placeholder="Repeat new password"
                            />
                            {pwdForm.confirm && pwdForm.newPwd !== pwdForm.confirm && (
                                <p className="text-rose-500 text-xs font-medium mt-1.5">Passwords do not match</p>
                            )}
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={changingPwd}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                            >
                                {changingPwd
                                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Updating...</>
                                    : <><Lock size={16} /> Update Password</>
                                }
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'account' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
                    <h3 className="text-lg font-extrabold text-slate-900">Account Information</h3>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {[
                            { label: 'User ID', value: user?.id, icon: Shield },
                            { label: 'Account Role', value: user?.role?.replace('_', ' '), icon: User },
                            { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—', icon: Calendar },
                            { label: 'Subscription', value: plan, icon: CreditCard },
                        ].map(({ label, value, icon: Icon }) => (
                            <div key={label} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-9 h-9 bg-white rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <Icon size={16} className="text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                                    <p className="text-slate-900 font-bold text-sm mt-0.5">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {user?.subscriptionExpiry && (
                        <div className={`flex items-center gap-3 p-4 rounded-xl border ${planStyle.bg} ${planStyle.border}`}>
                            <CheckCircle size={18} className={planStyle.text} />
                            <div>
                                <p className={`font-bold text-sm ${planStyle.text}`}>{plan} Plan Active</p>
                                <p className="text-slate-500 text-xs font-medium mt-0.5">
                                    Renews on {new Date(user.subscriptionExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-slate-100 pt-6">
                        <h4 className="text-slate-900 font-bold mb-3">Danger Zone</h4>
                        <div className="border border-rose-200 bg-rose-50 rounded-xl p-5">
                            <p className="text-rose-700 font-bold text-sm mb-1">Delete Account</p>
                            <p className="text-rose-500 text-xs font-medium mb-4">This will permanently delete your account and all your data. This cannot be undone.</p>
                            <button
                                onClick={() => toast.error('Account deletion requires contacting support. Please email support@edunexus.com')}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                Request Account Deletion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
