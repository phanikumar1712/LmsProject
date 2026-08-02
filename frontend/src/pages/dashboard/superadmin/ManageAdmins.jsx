import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, CheckCircle, Key, X, Mail, User, Phone, Lock, Building2, AlertTriangle, Copy, LayoutDashboard, UserX, UserCheck, KeyRound, Crown, UserMinus } from 'lucide-react';
import { usersAPI, departmentsAPI } from '../../../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAsyncData } from '../../../hooks/useAsyncData';

export default function ManageAdmins() {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'ADMIN', phone: '', password: '', departmentIds: [] });
    const [inviteCustomDept, setInviteCustomDept] = useState('');
    const [creatingCustomDept, setCreatingCustomDept] = useState(false);
    const [inviting, setInviting] = useState(false);

    const { data: allUsers, loading, reload } = useAsyncData(() => usersAPI.getAll(), []);
    const { data: departments, reload: reloadDepts } = useAsyncData(() => departmentsAPI.list(), []);

    // Multi-department state: which admin's depts are being edited
    const [deptModal, setDeptModal] = useState(null); // admin object
    const [selectedDeptIds, setSelectedDeptIds] = useState([]);
    const [savingDepts, setSavingDepts] = useState(false);

    const deptName = (id) => (departments || []).find(d => d.id === id)?.name || null;

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

    const [resetResult, setResetResult] = useState(null); // { name, tempPassword }

    const handleResetPassword = async (user) => {
        if (!window.confirm(`Reset password for ${user.name}? A new temporary password will be generated.`)) return;
        try {
            const res = await usersAPI.resetPassword(user.id);
            setResetResult({ name: user.name, tempPassword: res.tempPassword });
            toast.success('Password reset');
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        }
    };

    // Role action modal — password-gated (super admin must re-enter their password)
    const [roleAction, setRoleAction] = useState(null); // { userId, newRole, label }
    const [roleActionPassword, setRoleActionPassword] = useState('');
    const [roleActing, setRoleActing] = useState(false);

    const handleDemote = (userId) => {
        setRoleAction({ userId, newRole: 'INSTRUCTOR', label: 'Demote to Instructor' });
        setRoleActionPassword('');
    };

    const handlePromote = (userId) => {
        setRoleAction({ userId, newRole: 'SUPER_ADMIN', label: 'Promote to Super Admin' });
        setRoleActionPassword('');
    };

    const confirmRoleAction = async () => {
        if (!roleAction) return;
        if (!roleActionPassword) {
            toast.error('Enter your password to authorize this change');
            return;
        }
        setRoleActing(true);
        try {
            await usersAPI.updateRole(roleAction.userId, roleAction.newRole, '', roleActionPassword);
            toast.success(roleAction.label);
            reload();
            setRoleAction(null);
            setRoleActionPassword('');
        } catch (err) {
            toast.error(err.message || `Failed to ${roleAction.label.toLowerCase()}`);
        } finally {
            setRoleActing(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteData.password || inviteData.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setInviting(true);
        try {
            const payload = { ...inviteData };
            // If no departments selected, clear the array so backend treats it as global
            if (payload.departmentIds.length === 0) {
                delete payload.departmentId;
                delete payload.departmentIds;
            }
            await usersAPI.inviteAdmin(payload);
            toast.success(`Admin account created for ${inviteData.email}`);
            setIsModalOpen(false);
            setInviteData({ name: '', email: '', role: 'ADMIN', phone: '', password: '', departmentIds: [] });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create admin');
        } finally {
            setInviting(false);
        }
    };

    const [adminDepts, setAdminDepts] = useState({});

    // Fetch multi-department assignments once users data loads
    useEffect(() => {
        if (!allUsers?.length || Object.keys(adminDepts).length > 0) return;
        const fetchIt = async () => {
            const result = {};
            const admins = allUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').slice(0, 20);
            await Promise.all(admins.map(async (u) => {
                try {
                    const depts = await usersAPI.getUserDepartments(u.id);
                    if (Array.isArray(depts) && depts.length > 0) {
                        result[u.id] = depts;
                    }
                } catch { /* ignore */ }
            }));
            setAdminDepts(result);
        };
        fetchIt();
    }, [allUsers]);

    const openDeptModal = async (user) => {
        setDeptModal(user);
        try {
            const depts = await usersAPI.getUserDepartments(user.id);
            const ids = (depts || []).map(d => d.id);
            if (user.departmentId && !ids.includes(user.departmentId)) {
                ids.unshift(user.departmentId);
            }
            setSelectedDeptIds(ids);
        } catch {
            setSelectedDeptIds(user.departmentId ? [user.departmentId] : []);
        }
    };

    const handleSaveDepts = async (e) => {
        e.preventDefault();
        setSavingDepts(true);
        try {
            await usersAPI.setAdminDepartments(deptModal.id, selectedDeptIds);
            toast.success('Departments updated');
            setDeptModal(null);
            reload();
            setAdminDepts({});
        } catch (err) {
            toast.error(err.message || 'Failed to update departments');
        } finally {
            setSavingDepts(false);
        }
    };        const toggleDeptId = (deptId) => {
        setSelectedDeptIds(prev =>
            prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
        );
    };

    const toggleInviteDeptId = (deptId) => {
        setInviteData(prev => ({
            ...prev,
            departmentIds: prev.departmentIds.includes(deptId)
                ? prev.departmentIds.filter(id => id !== deptId)
                : [...prev.departmentIds, deptId]
        }));
    };

    const handleAddCustomDept = async () => {
        const name = inviteCustomDept.trim();
        if (!name) { toast.error('Enter a department name'); return; }
        setCreatingCustomDept(true);
        try {
            const dept = await departmentsAPI.create({ name, icon: '🏛️' });
            toast.success(`Department "${name}" created`);
            setInviteCustomDept('');
            // Add the new department to the selected list and refresh
            setInviteData(prev => ({
                ...prev,
                departmentIds: [...prev.departmentIds.filter(id => id !== ''), dept.id]
            }));
            // Refresh departments list
            reloadDepts();
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create department');
        } finally {
            setCreatingCustomDept(false);
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-5xl">                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <ShieldCheck size={28} className="text-rose-600" /> Manage Admins
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Manage admin accounts and permissions</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                    <Plus size={16} /> Add Admin
                </button>
            </div>

            {/* Invite Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Add New Admin</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleInvite} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Full Name *</label>
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
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Email Address *</label>
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
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Phone Number</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input
                                        type="tel"
                                        placeholder="+91 98765 43210"
                                        value={inviteData.phone}
                                        onChange={e => setInviteData({ ...inviteData, phone: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Password *</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input
                                        required
                                        type="password"
                                        placeholder="Min. 8 characters"
                                        value={inviteData.password}
                                        onChange={e => setInviteData({ ...inviteData, password: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 font-medium ml-1">The admin can change this password after first login.</p>
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
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Departments</label>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 border border-border rounded-2xl p-2 bg-muted/20">
                                    {(departments || []).map(d => {
                                        const isSelected = inviteData.departmentIds.includes(d.id);
                                        return (
                                            <label
                                                key={d.id}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                                                    isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200' : 'hover:bg-muted border border-transparent'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleInviteDeptId(d.id)}
                                                    className="w-4 h-4 rounded accent-indigo-600"
                                                />
                                                <Building2 size={16} className={`text-muted-foreground shrink-0 ${isSelected ? 'text-indigo-600' : ''}`} strokeWidth={2.5} />
                                                <span className="flex-1 text-sm font-bold text-foreground">{d.name}</span>
                                                {isSelected && inviteData.departmentIds.indexOf(d.id) === 0 && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700">Primary</span>
                                                )}
                                            </label>
                                        );
                                    })}
                                    {(!departments || departments.length === 0) && (
                                        <p className="text-sm text-muted-foreground/60 text-center py-3 font-medium">No departments yet</p>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 font-medium ml-1">Select one or more departments. The first selected is the primary (for scoping).</p>
                                {/* Quick-add custom department */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Create new department..."
                                        value={inviteCustomDept}
                                        onChange={e => setInviteCustomDept(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-xs font-medium"
                                    />
                                    <button
                                        type="button"
                                        disabled={creatingCustomDept || !inviteCustomDept.trim()}
                                        onClick={handleAddCustomDept}
                                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                                    >
                                        {creatingCustomDept ? '...' : '+ Create'}
                                    </button>
                                </div>
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
                                    {inviting ? 'Creating...' : 'Create Admin Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Admins', value: users.filter(u => u.role === 'ADMIN').length, icon: ShieldCheck, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' },
                    { label: 'Super Admins', value: users.filter(u => u.role === 'SUPER_ADMIN').length, icon: Key, cls: 'text-rose-600 bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20' },
                    { label: 'Active', value: users.filter(u => u.active !== false).length, icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20' },
                ].map(({ label, value, icon: Icon, cls }) => (
                    <div key={label} className={`${cls} border rounded-2xl p-5 shadow-sm relative overflow-hidden`}>
                        <div className="absolute top-3 right-3 opacity-20">
                            <Icon size={40} className="text-current" strokeWidth={1.5} />
                        </div>
                        <p className="text-3xl font-extrabold mb-1 tracking-tight relative z-10">{value}</p>
                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest relative z-10">{label}</p>
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
                                    <Link to={`/admin/users/${user.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                                    {user.avatar ? (
                                        <img src={user.avatar}
                                            alt={user.name} className="w-12 h-12 rounded-2xl object-cover border border-border flex-shrink-0 shadow-sm" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 border border-border shadow-sm">
                                            <span className="text-white text-lg font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-foreground font-extrabold text-[15px] mb-0.5 group-hover:text-indigo-600 transition-colors">{user.name}</p>
                                        <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-tight truncate">{user.email}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${user.role === 'SUPER_ADMIN' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {user.role.replace('_', ' ')}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${user.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                                {user.active !== false ? 'Active' : 'Suspended'}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700 flex items-center gap-1">
                                                <Building2 size={12} strokeWidth={2.5} />
                                                {deptName(user.departmentId) || 'Global'}
                                            </span>
                                            {user.role === 'ADMIN' && adminDepts[user.id]?.length > 0 && (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700 flex items-center gap-1">
                                                    <LayoutDashboard size={12} strokeWidth={2.5} />
                                                    +{adminDepts[user.id].length} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    </Link>
                                    <div className="text-right hidden sm:block px-4 border-l border-border h-10 flex flex-col justify-center">
                                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest leading-none mb-1">Joined</p>
                                        <p className="text-foreground font-extrabold text-xs">{new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-border">
                                        <button onClick={() => handleToggleStatus(user.id)} title={user.active !== false ? 'Suspend Admin' : 'Activate Admin'}
                                            className={`p-2.5 rounded-xl transition-all ${user.active !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                            {user.active !== false ? <UserX size={18} /> : <UserCheck size={18} />}
                                        </button>
                                        <button onClick={() => handleResetPassword(user)} title="Reset password"
                                            className="p-2.5 text-violet-600 hover:bg-violet-50 rounded-xl transition-all">
                                            <KeyRound size={18} />
                                        </button>
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => openDeptModal(user)} title="Assign departments"
                                                className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-xl transition-all">
                                                <LayoutDashboard size={18} />
                                            </button>
                                        )}
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => handlePromote(user.id)} title="Promote to Super Admin"
                                                className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                                <Crown size={18} />
                                            </button>
                                        )}
                                        {user.role !== 'SUPER_ADMIN' && (
                                            <button onClick={() => handleDemote(user.id)} title="Demote to Instructor"
                                                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                                <UserMinus size={18} />
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

            {/* Role Action Modal (password-gated) */}
            {roleAction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                {roleAction.newRole === 'SUPER_ADMIN'
                                    ? <Crown size={20} className="text-indigo-600" />
                                    : <UserMinus size={20} className="text-slate-600" />}
                                Confirm {roleAction.label}
                            </h3>
                            <button onClick={() => setRoleAction(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {roleAction.newRole === 'SUPER_ADMIN'
                                    ? 'This grants full platform access. ' : 'This removes admin permissions. '}
                                Enter your password to authorize.
                            </p>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">
                                    Your admin password <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={roleActionPassword}
                                    onChange={e => setRoleActionPassword(e.target.value)}
                                    placeholder="Enter your password to authorize"
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setRoleAction(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button onClick={confirmRoleAction} disabled={roleActing}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {roleActing ? 'Working...' : `Confirm ${roleAction.newRole === 'SUPER_ADMIN' ? 'Promotion' : 'Demotion'}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Result Modal */}
            {resetResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <KeyRound size={20} className="text-violet-600" /> Password Reset
                            </h3>
                            <button onClick={() => setResetResult(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <p className="text-sm text-muted-foreground font-medium">
                                A new temporary password was generated for <span className="font-bold text-foreground">{resetResult.name}</span>.
                                Share it securely — it won't be shown again.
                            </p>
                            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-2xl px-4 py-3">
                                <code className="flex-1 font-mono text-sm font-bold text-foreground break-all">{resetResult.tempPassword}</code>
                                <button
                                    onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); toast.success('Copied'); }}
                                    className="p-2 text-violet-600 hover:bg-violet-50 rounded-xl transition-all flex-shrink-0" title="Copy">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <button onClick={() => setResetResult(null)}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98]">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Department Assignment Modal */}
            {deptModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <LayoutDashboard size={20} className="text-purple-600" /> Assign Departments
                            </h3>
                            <button onClick={() => setDeptModal(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveDepts} className="p-8 space-y-4">
                            <p className="text-sm text-muted-foreground font-medium">
                                Manage department access for <span className="font-bold text-foreground">{deptModal.name}</span>.
                                The first department is the <strong>primary</strong> (used for scoping).
                            </p>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {(departments || []).map(d => {
                                    const isSelected = selectedDeptIds.includes(d.id);
                                    return (
                                        <label
                                            key={d.id}
                                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                                isSelected ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/10 dark:border-indigo-700' : 'border-border hover:border-indigo-200 hover:bg-muted/30'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleDeptId(d.id)}
                                                className="w-4 h-4 rounded accent-indigo-600"
                                            />
                                            <Building2 size={18} className={`shrink-0 ${isSelected ? 'text-indigo-600' : 'text-muted-foreground'}`} strokeWidth={2.5} />
                                            <span className="flex-1 text-sm font-bold text-foreground">{d.name}</span>
                                            {isSelected && selectedDeptIds.indexOf(d.id) === 0 && (
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700">Primary</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedDeptIds.length === 0 && (
                                <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    No departments selected. The admin will have no department scope.
                                </p>
                            )}
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setDeptModal(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={savingDepts}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98]">
                                    {savingDepts ? 'Saving...' : 'Save Assignments'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
