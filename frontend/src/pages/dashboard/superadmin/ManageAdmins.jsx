import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, CheckCircle, Ban, Key, X, Mail, User, Users } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useAsyncData } from '../../../hooks/useAsyncData';

export default function ManageAdmins() {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'ADMIN' });
    const [inviting, setInviting] = useState(false);

    const { data: allUsers, loading, reload } = useAsyncData(() => usersAPI.getAll(), []);

    const users = (allUsers || []).filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');

    const handleToggleStatus = async (userId) => {
        try {
            await usersAPI.toggleStatus(userId);
            toast.success('Admin status updated');
            reload();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleDemote = async (userId) => {
        if (!window.confirm('Demote this admin to Instructor role?')) return;
        try {
            await usersAPI.updateRole(userId, 'INSTRUCTOR');
            toast.success('Admin demoted to Instructor');
            reload();
        } catch {
            toast.error('Failed to demote admin');
        }
    };

    const handlePromote = async (userId) => {
        if (!window.confirm('Promote to Super Admin? This grants full platform access.')) return;
        try {
            await usersAPI.updateRole(userId, 'SUPER_ADMIN');
            toast.success('Promoted to Super Admin');
            reload();
        } catch {
            toast.error('Failed to promote admin');
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviting(true);
        try {
            await usersAPI.inviteAdmin(inviteData);
            toast.success(`Invitation sent to ${inviteData.email}`);
            setIsModalOpen(false);
            setInviteData({ name: '', email: '', role: 'ADMIN' });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to send invitation');
        } finally {
            setInviting(false);
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <ShieldCheck size={28} className="text-rose-600" /> Manage Admins
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Manage admin accounts and permissions</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                    <Plus size={16} /> Invite Admin
                </button>
            </div>

            {/* Invite Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Invite New Admin</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleInvite} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Full Name</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input
                                        required
                                        type="text"
                                        placeholder="Alex Rivera"
                                        value={inviteData.name}
                                        onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input
                                        required
                                        type="email"
                                        placeholder="alex@edunexus.com"
                                        value={inviteData.email}
                                        onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Admin Role</label>
                                <select
                                    value={inviteData.role}
                                    onChange={e => setInviteData({ ...inviteData, role: e.target.value })}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium appearance-none"
                                >
                                    <option value="ADMIN">Standard Admin</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]"
                                >
                                    {inviting ? 'Inviting...' : 'Send Invitation'}
                                </button>
                            </div>
                            <p className="text-[11px] text-center text-muted-foreground/70 font-medium pt-2 italic">
                                * Temporary password will be sent via email
                            </p>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Admins', value: users.filter(u => u.role === 'ADMIN').length, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' },
                    { label: 'Super Admins', value: users.filter(u => u.role === 'SUPER_ADMIN').length, cls: 'text-rose-600 bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20' },
                    { label: 'Active', value: users.filter(u => u.active !== false).length, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20' },
                ].map(({ label, value, cls }) => (
                    <div key={label} className={`${cls} border rounded-2xl p-5 shadow-sm`}>
                        <p className="text-3xl font-extrabold mb-1 tracking-tight">{value}</p>
                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">{label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-muted/10">
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="divide-y divide-border min-w-[700px]">
                            {filtered.map(user => (
                                <div key={user.id} className="flex items-center gap-4 px-6 py-5 hover:bg-muted/30 transition-colors group">
                                    {user.avatar ? (
                                        <img src={user.avatar}
                                            alt={user.name} className="w-12 h-12 rounded-2xl object-cover border border-border flex-shrink-0 shadow-sm" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 border border-border shadow-sm">
                                            <span className="text-white text-lg font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-foreground font-extrabold text-[15px] mb-0.5">{user.name}</p>
                                        <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-tight truncate">{user.email}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${user.role === 'SUPER_ADMIN' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {user.role.replace('_', ' ')}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${user.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                {user.active !== false ? 'Active' : 'Suspended'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block px-4 border-l border-border h-10 flex flex-col justify-center">
                                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest leading-none mb-1">Joined</p>
                                        <p className="text-foreground font-extrabold text-xs">{new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-border">
                                        <button onClick={() => handleToggleStatus(user.id)} title={user.active !== false ? 'Suspend Admin' : 'Activate Admin'}
                                            className={`p-2.5 rounded-xl transition-all ${user.active !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                            {user.active !== false ? <Ban size={18} /> : <CheckCircle size={18} />}
                                        </button>
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => handlePromote(user.id)} title="Promote to Super Admin"
                                                className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                                <Key size={18} />
                                            </button>
                                        )}
                                        {user.role !== 'SUPER_ADMIN' && (
                                            <button onClick={() => handleDemote(user.id)} title="Demote to Instructor"
                                                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                <Users size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div className="text-center py-20">
                                    <ShieldCheck size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-foreground">No admins found</h3>
                                    <p className="text-muted-foreground text-sm">Try adjusting your search criteria</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
