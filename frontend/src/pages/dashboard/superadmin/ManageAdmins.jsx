import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, CheckCircle, Ban, Key } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useAsyncData } from '../../../hooks/useAsyncData';

export default function ManageAdmins() {
    const [search, setSearch] = useState('');
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

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldCheck size={28} className="text-rose-600" /> Manage Admins
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Manage admin accounts and permissions</p>
                </div>
                <button
                    onClick={() => toast.success('Invite email sent (demo)')}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                    <Plus size={16} /> Invite Admin
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Admins', value: users.filter(u => u.role === 'ADMIN').length, cls: 'text-amber-600 bg-amber-50' },
                    { label: 'Super Admins', value: users.filter(u => u.role === 'SUPER_ADMIN').length, cls: 'text-rose-600 bg-rose-50' },
                    { label: 'Active', value: users.filter(u => u.active !== false).length, cls: 'text-emerald-600 bg-emerald-50' },
                ].map(({ label, value, cls }) => (
                    <div key={label} className={`${cls} border border-slate-200 rounded-2xl p-5`}>
                        <p className="text-3xl font-extrabold mb-1">{value}</p>
                        <p className="text-slate-600 text-sm font-bold">{label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="p-6 border-b border-slate-100">
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search admins..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm" />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="divide-y divide-slate-100 min-w-[700px]">
                            {filtered.map(user => (
                                <div key={user.id} className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors">
                                    <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                                        alt={user.name} className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-slate-900 font-bold text-sm">{user.name}</p>
                                        <p className="text-slate-500 text-xs font-medium">{user.email}</p>
                                        <p className="text-slate-400 text-xs font-medium">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex-shrink-0 ${user.role === 'SUPER_ADMIN' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                        {user.role.replace('_', ' ')}
                                    </span>
                                    <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex-shrink-0 ${user.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                        {user.active !== false ? 'Active' : 'Suspended'}
                                    </span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => handleToggleStatus(user.id)} title="Toggle status"
                                            className="p-2 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors">
                                            {user.active !== false ? <Ban size={16} /> : <CheckCircle size={16} />}
                                        </button>
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => handlePromote(user.id)} title="Promote to Super Admin"
                                                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                                                <Key size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div className="text-center py-12 text-slate-500 font-medium">No admins found.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
