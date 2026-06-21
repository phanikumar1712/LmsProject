import { useState, useEffect } from 'react';
import { CreditCard, Search, User, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export default function AdminSubscriptions() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await usersAPI.getAll();
            // Filter to show users who have or had a plan, or just all users for management
            setUsers(data);
        } catch (err) {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const updatePlan = async (userId, plan) => {
        try {
            await usersAPI.assignPlan(userId, plan);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscriptionPlan: plan } : u));
            toast.success(`Plan updated to ${plan}`);
        } catch (err) {
            toast.error("Update failed");
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const PLAN_COLORS = {
        FREE: 'bg-muted text-muted-foreground',
        BASIC: 'bg-violet-100 text-violet-700',
        PRO: 'bg-indigo-100 text-indigo-700',
        ENTERPRISE: 'bg-emerald-100 text-emerald-700',
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">User Subscriptions</h1>
                    <p className="text-muted-foreground font-medium mt-1">Manage platform billing and tier access</p>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/40 border-b border-border">
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Plan</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Expiry</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-10 bg-muted rounded-lg w-40"></div></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-16"></div></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-muted rounded-lg w-24"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-8 bg-muted rounded ml-auto w-12"></div></td>
                                    </tr>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground/60">
                                        <CreditCard size={40} className="mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">No users found</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-muted/40/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold border border-border">
                                                {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" /> : user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground text-sm leading-none">{user.name}</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${PLAN_COLORS[user.subscriptionPlan] || PLAN_COLORS.FREE}`}>
                                            {user.subscriptionPlan || 'FREE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase tracking-wide">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Active
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                            <Calendar size={13} className="text-muted-foreground/60" />
                                            {user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <select
                                                className="text-[11px] font-bold bg-card border border-border rounded-md py-1 px-2 outline-none focus:ring-2 focus:ring-indigo-100"
                                                value={user.subscriptionPlan || 'FREE'}
                                                onChange={(e) => updatePlan(user.id, e.target.value)}
                                            >
                                                <option value="FREE">Free</option>
                                                <option value="BASIC">Basic</option>
                                                <option value="PRO">Pro</option>
                                                <option value="ENTERPRISE">Enterprise</option>
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
