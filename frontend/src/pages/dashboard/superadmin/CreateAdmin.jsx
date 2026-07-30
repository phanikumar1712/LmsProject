import { useState, useMemo } from 'react';
import { Building2, Users, ShieldCheck, Plus, X, Mail, User, Lock, Phone, CheckCircle2, Search, RefreshCw } from 'lucide-react';
import { usersAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

function StatusBadge({ hasAdmin, userCount }) {
    if (hasAdmin) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase tracking-wider">
                <ShieldCheck size={12} /> {userCount} Admin{userCount > 1 ? 's' : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-wider">
            <Plus size={12} /> Available
        </span>
    );
}

export default function CreateAdmin() {
    const { user } = useAuth();
    const { data: departments, loading, reload } = useAsyncData(() => departmentsAPI.list(), []);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'ADMIN' });
    const [creating, setCreating] = useState(false);
    const [adminInfo, setAdminInfo] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const filtered = useMemo(() => {
        if (!departments) return [];
        return departments.filter(d =>
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [departments, searchTerm]);

    // Fetch admin counts for each department
    const { data: adminCounts, reload: reloadCounts } = useAsyncData(
        async () => {
            if (!departments?.length) return {};
            const counts = {};
            await Promise.all(departments.map(async (d) => {
                try {
                    const res = await usersAPI.getAll({ role: 'ADMIN', departmentId: d.id });
                    counts[d.id] = (res || []).length;
                } catch {
                    counts[d.id] = 0;
                }
            }));
            return counts;
        },
        [departments]
    );

    const openCreateModal = (dept) => {
        setSelectedDept(dept);
        setFormData({ name: '', email: '', phone: '', password: '', role: 'ADMIN' });
        setAdminInfo(null);
        setShowCreateModal(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.password) {
            toast.error('Name, email, and password are required');
            return;
        }
        if (formData.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setCreating(true);
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                phone: formData.phone,
                password: formData.password,
                departmentId: selectedDept?.id,
            };
            const result = await usersAPI.inviteAdmin(payload);
            setAdminInfo(result);
            toast.success(`Admin "${formData.name}" created for ${selectedDept?.name}`);
            setShowCreateModal(false);
            setSelectedDept(null);
            reload();
            reloadCounts();
        } catch (err) {
            toast.error(err.message || 'Failed to create admin');
        } finally {
            setCreating(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await reloadCounts();
        await reload();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <ShieldCheck size={28} className="text-indigo-600" /> Create Admin for Department
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Assign admins to departments. A department can have multiple admins.</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search departments..."
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                />
            </div>

            {/* Department Cards */}
            {filtered.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(dept => {
                        const count = adminCounts?.[dept.id] || 0;
                        const hasAdmin = count > 0;
                        return (
                            <div
                                key={dept.id}
                                className={`group relative bg-card border rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                                    hasAdmin
                                        ? 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30'
                                        : 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30'
                                }`}
                            >
                                {/* Status indicator */}
                                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${
                                    hasAdmin ? 'bg-indigo-500' : 'bg-emerald-500'
                                }`} />

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${
                                        hasAdmin
                                            ? 'bg-indigo-100 text-indigo-600'
                                            : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                        {dept.icon || '🏛️'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-extrabold text-foreground text-[15px] truncate">{dept.name}</h3>
                                        <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                                            {dept.categoryCount || 0} categories · {dept.coursePublished || 0} courses
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <StatusBadge hasAdmin={hasAdmin} userCount={count} />
                                    <button
                                        onClick={() => openCreateModal(dept)}
                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm hover:shadow-md active:scale-[0.98]"
                                    >
                                        <Plus size={14} /> {hasAdmin ? 'Add Admin' : 'Assign Admin'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
                    <Building2 size={48} className="text-muted-foreground/15 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-1">No departments found</h3>
                    <p className="text-muted-foreground text-sm">Create departments first from the Departments page</p>
                </div>
            )}

            {/* Create Admin Modal */}
            {showCreateModal && selectedDept && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">
                                    {selectedDept.icon || '🏛️'}
                                </div>
                                <div>
                                    <h3 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                        <ShieldCheck size={18} className="text-indigo-600" />
                                        Create Admin for {selectedDept.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                        This department will have its own admin with full access to its courses and quizzes.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-8 space-y-5">
                            {/* Admin Info */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <User size={14} className="text-indigo-500" /> Admin Details
                                </h4>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Full Name *</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input required type="text" placeholder="Alex Rivera" value={formData.name}
                                            onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                                            className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Email Address *</label>
                                    <div className="relative">
                                        <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input required type="email" placeholder="alex@edunexus.com" value={formData.email}
                                            onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                                            className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Phone</label>
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                            <input type="tel" placeholder="+91 98765 43210" value={formData.phone}
                                                onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                                                className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Password *</label>
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                            <input required type="password" placeholder="Min. 8 chars" value={formData.password}
                                                onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                                                className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Department Info */}
                            <div className="border-t border-border pt-5">
                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                                    <Building2 size={14} className="text-emerald-500" /> Department Assignment
                                </h4>
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-2xl">
                                    <Building2 size={20} className="text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{selectedDept.name}</p>
                                        <p className="text-[11px] text-muted-foreground font-medium">Primary department for this admin</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground/60 font-medium mt-3">
                                    The admin will have full access to all courses and quizzes in this department without needing a subscription.
                                </p>
                            </div>

                            {/* Success State */}
                            {adminInfo && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={18} className="text-emerald-600" />
                                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Admin Created Successfully!</span>
                                    </div>
                                    <div className="space-y-1.5 text-[11px] text-muted-foreground font-medium">
                                        <p><strong className="text-foreground">Name:</strong> {adminInfo.user?.name || formData.name}</p>
                                        <p><strong className="text-foreground">Email:</strong> {adminInfo.user?.email || formData.email}</p>
                                        {adminInfo.tempPassword && (
                                            <p><strong className="text-foreground">Temp Password:</strong> <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold">{adminInfo.tempPassword}</code></p>
                                        )}
                                        <p><strong className="text-foreground">Department:</strong> {selectedDept.name}</p>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating || !!adminInfo}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                    {creating ? 'Creating...' : adminInfo ? 'Done' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}