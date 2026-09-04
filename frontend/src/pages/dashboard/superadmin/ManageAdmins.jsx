import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Plus, Search, CheckCircle, Key, X, Mail, Phone, Lock, Building2, AlertTriangle, Copy, LayoutDashboard, UserX, UserCheck, KeyRound, Crown, UserMinus, Edit2, Trash2, PenLine, AtSign, Filter, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { usersAPI, departmentsAPI } from '../../../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAsyncData } from '../../../hooks/useAsyncData';
import PermissionBadges from '../../../components/ui/PermissionBadges';

export default function ManageAdmins() {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [groupBy, setGroupBy] = useState('none'); // 'none' | 'role' | 'department'
    const [expandedGroups, setExpandedGroups] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inviteData, setInviteData] = useState({ firstName: '', lastName: '', email: '', username: '', role: 'ADMIN', phone: '', password: '', confirmPassword: '', departmentIds: [], active: true });

    // Edit admin state
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', username: '', phone: '', active: true });
    const [savingEdit, setSavingEdit] = useState(false);

    // Change password state
    const [pwAdmin, setPwAdmin] = useState(null);
    const [pwForm, setPwForm] = useState({ password: '', confirm: '' });
    const [changingPw, setChangingPw] = useState(false);

    // Delete admin state
    const [deletingAdmin, setDeletingAdmin] = useState(null);
    const [deletingAdminBusy, setDeletingAdminBusy] = useState(false);
    const [inviteCustomDept, setInviteCustomDept] = useState('');
    const [creatingCustomDept, setCreatingCustomDept] = useState(false);
    const [inviting, setInviting] = useState(false);

    const { data: allUsers, loading, reload } = useAsyncData(() => usersAPI.getAll(), []);
    const { data: departments, reload: reloadDepts } = useAsyncData(() => departmentsAPI.list(), []);

    // Multi-department state
    const [deptModal, setDeptModal] = useState(null);
    const [selectedDeptIds, setSelectedDeptIds] = useState([]);
    const [savingDepts, setSavingDepts] = useState(false);

    const deptName = (id) => (departments || []).find(d => d.id === id)?.name || null;

    const allAdmins = useMemo(() => (allUsers || []).filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'), [allUsers]);

    // ── Filtered list ──────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return allAdmins.filter(u => {
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
            if (statusFilter === 'Active' && u.active === false) return false;
            if (statusFilter === 'Suspended' && u.active !== false) return false;
            if (deptFilter !== 'ALL') {
                if (deptFilter === '') {
                    // 'Global' = no department assigned
                    if (u.departmentId != null) return false;
                } else {
                    if (u.departmentId !== deptFilter) return false;
                }
            }
            if (search) {
                const s = search.toLowerCase();
                if (!u.name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false;
            }
            return true;
        });
    }, [allAdmins, roleFilter, statusFilter, deptFilter, search]);

    // ── Grouped data ───────────────────────────────────────────────────────
    const grouped = useMemo(() => {
        if (groupBy === 'none') return null;
        const groups = {};
        filtered.forEach(u => {
            const key = groupBy === 'role'
                ? u.role
                : (deptName(u.departmentId) || 'Unassigned');
            if (!groups[key]) groups[key] = [];
            groups[key].push(u);
        });
        return groups;
    }, [filtered, groupBy, departments]);

    const toggleGroup = (key) => setExpandedGroups(prev => ({
        ...prev,
        [key]: prev[key] === false ? true : false,
    }));

    const handleToggleStatus = async (userId) => {
        try {
            await usersAPI.toggleStatus(userId);
            toast.success('Admin status updated');
            reload();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const [resetResult, setResetResult] = useState(null);

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

    // Role action modal
    const [roleAction, setRoleAction] = useState(null);
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
        if (!roleActionPassword) { toast.error('Enter your password to authorize this change'); return; }
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
        const name = [inviteData.firstName, inviteData.lastName].map(s => s.trim()).filter(Boolean).join(' ');
        if (!name) { toast.error('First name is required'); return; }
        if (!inviteData.password || inviteData.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        if (inviteData.password !== inviteData.confirmPassword) { toast.error('Passwords do not match'); return; }
        setInviting(true);
        try {
            const payload = {
                name, email: inviteData.email, username: inviteData.username || undefined,
                role: inviteData.role, phone: inviteData.phone, password: inviteData.password,
                active: inviteData.active, departmentIds: inviteData.departmentIds,
            };
            if (payload.departmentIds.length === 0) { delete payload.departmentId; delete payload.departmentIds; }
            await usersAPI.inviteAdmin(payload);
            toast.success(`Admin account created for ${inviteData.email}`);
            setIsModalOpen(false);
            setInviteData({ firstName: '', lastName: '', email: '', username: '', role: 'ADMIN', phone: '', password: '', confirmPassword: '', departmentIds: [], active: true });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create admin');
        } finally {
            setInviting(false);
        }
    };

    const splitName = (full) => {
        const parts = (full || '').trim().split(/\s+/);
        if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
        return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    };

    const openEditAdmin = (admin) => {
        const { firstName, lastName } = splitName(admin.name);
        setEditForm({ firstName, lastName, email: admin.email || '', username: admin.username || '', phone: admin.phone || '', active: admin.active !== false });
        setEditingAdmin(admin);
    };

    const handleEditAdmin = async (e) => {
        e.preventDefault();
        const name = [editForm.firstName, editForm.lastName].map(s => s.trim()).filter(Boolean).join(' ');
        if (!name) { toast.error('First name is required'); return; }
        if (!editForm.email.trim()) { toast.error('Email is required'); return; }
        setSavingEdit(true);
        try {
            await usersAPI.updateUser(editingAdmin.id, { name, email: editForm.email.trim(), username: editForm.username || null, phone: editForm.phone, active: editForm.active });
            toast.success(`Admin "${name}" updated`);
            setEditingAdmin(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update admin');
        } finally {
            setSavingEdit(false);
        }
    };

    const openChangePassword = (admin) => { setPwAdmin(admin); setPwForm({ password: '', confirm: '' }); };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!pwForm.password || pwForm.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        if (pwForm.password !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
        setChangingPw(true);
        try {
            await usersAPI.resetPassword(pwAdmin.id, pwForm.password);
            toast.success(`Password changed for ${pwAdmin.name}`);
            setPwAdmin(null);
        } catch (err) {
            toast.error(err.message || 'Failed to change password');
        } finally {
            setChangingPw(false);
        }
    };

    const handleDeleteAdmin = async () => {
        if (!deletingAdmin) return;
        setDeletingAdminBusy(true);
        try {
            await usersAPI.delete(deletingAdmin.id);
            toast.success(`Admin "${deletingAdmin.name}" deleted`);
            setDeletingAdmin(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete admin');
        } finally {
            setDeletingAdminBusy(false);
        }
    };

    const [adminDepts, setAdminDepts] = useState({});

    useEffect(() => {
        if (!allUsers?.length || Object.keys(adminDepts).length > 0) return;
        const fetchIt = async () => {
            const result = {};
            const admins = allUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').slice(0, 20);
            await Promise.all(admins.map(async (u) => {
                try {
                    const depts = await usersAPI.getUserDepartments(u.id);
                    if (Array.isArray(depts) && depts.length > 0) result[u.id] = depts;
                } catch { /* ignore */ }
            }));
            setAdminDepts(result);
        };
        fetchIt();
    }, [allUsers]);

    const [permsMap, setPermsMap] = useState({});
    useEffect(() => {
        if (!allUsers?.length || Object.keys(permsMap).length > 0) return;
        const fetchIt = async () => {
            const result = {};
            const admins = allUsers.filter(u => u.role === 'ADMIN').slice(0, 20);
            await Promise.all(admins.map(async (u) => {
                try {
                    const data = await usersAPI.getPermissions(u.id);
                    const overrides = data.overrides || {};
                    result[u.id] = {
                        effective: data.effective || [],
                        granted: Object.entries(overrides).filter(([, v]) => v === true).map(([p]) => p),
                        revoked: Object.entries(overrides).filter(([, v]) => v === false).map(([p]) => p),
                    };
                } catch { /* ignore */ }
            }));
            setPermsMap(result);
        };
        fetchIt();
    }, [allUsers]);

    const openDeptModal = async (user) => {
        setDeptModal(user);
        try {
            const depts = await usersAPI.getUserDepartments(user.id);
            const ids = (depts || []).map(d => d.id);
            if (user.departmentId && !ids.includes(user.departmentId)) ids.unshift(user.departmentId);
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
            setPermsMap({});
        } catch (err) {
            toast.error(err.message || 'Failed to update departments');
        } finally {
            setSavingDepts(false);
        }
    };

    const toggleDeptId = (deptId) => setSelectedDeptIds(prev => prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]);

    const toggleInviteDeptId = (deptId) => setInviteData(prev => ({
        ...prev,
        departmentIds: prev.departmentIds.includes(deptId) ? prev.departmentIds.filter(id => id !== deptId) : [...prev.departmentIds, deptId]
    }));

    const handleAddCustomDept = async () => {
        const name = inviteCustomDept.trim();
        if (!name) { toast.error('Enter a department name'); return; }
        setCreatingCustomDept(true);
        try {
            const dept = await departmentsAPI.create({ name, icon: '🏛️' });
            toast.success(`Department "${name}" created`);
            setInviteCustomDept('');
            setInviteData(prev => ({ ...prev, departmentIds: [...prev.departmentIds.filter(id => id !== ''), dept.id] }));
            reloadDepts();
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create department');
        } finally {
            setCreatingCustomDept(false);
        }
    };

    // ── Stats for the summary cards ────────────────────────────────────────
    const stats = useMemo(() => ({
        total: allAdmins.length,
        superAdmins: allAdmins.filter(u => u.role === 'SUPER_ADMIN').length,
        admins: allAdmins.filter(u => u.role === 'ADMIN').length,
        active: allAdmins.filter(u => u.active !== false).length,
    }), [allAdmins]);

    // ── Admin card component ───────────────────────────────────────────────
    const AdminCard = ({ user }) => (
        <div className="flex items-center gap-4 px-6 py-5 hover:bg-muted/30 transition-colors group">
            <Link to={`/admin/users/${user.id}`} className="flex items-center gap-4 flex-1 min-w-0">
            {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover border border-border flex-shrink-0 shadow-sm" />
            ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 border border-border shadow-sm">
                    <span className="text-white text-lg font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-foreground font-extrabold text-[15px] mb-0.5 group-hover:text-indigo-600 transition-colors">{user.name}</p>
                <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-tight truncate">{user.email}</p>
                {user.username && <p className="text-muted-foreground/60 text-[10px] font-bold truncate">@{user.username}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                            <LayoutDashboard size={12} strokeWidth={2.5} /> +{adminDepts[user.id].length} more
                        </span>
                    )}
                </div>
                {user.role === 'SUPER_ADMIN' ? (
                    <span className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-rose-100 text-rose-700">
                        <Crown size={10} /> Full platform access
                    </span>
                ) : permsMap[user.id] ? (
                    <PermissionBadges permissions={permsMap[user.id].effective} granted={permsMap[user.id].granted} revoked={permsMap[user.id].revoked} max={4} className="mt-2.5" />
                ) : null}
            </div>
            </Link>
            <div className="text-right hidden sm:block px-4 border-l border-border space-y-1.5">
                <div>
                    <p className="text-muted-foreground text-[9px] font-black uppercase tracking-widest leading-none mb-0.5">Last Login</p>
                    <p className="text-foreground font-bold text-[11px] whitespace-nowrap">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                </div>
                <div>
                    <p className="text-muted-foreground text-[9px] font-black uppercase tracking-widest leading-none mb-0.5">Created</p>
                    <p className="text-foreground font-bold text-[11px] whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 pl-4 border-l border-border">
                <button onClick={() => openEditAdmin(user)} title="Edit admin" className="p-2.5 text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all"><Edit2 size={18} /></button>
                <button onClick={() => openChangePassword(user)} title="Change password" className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><PenLine size={18} /></button>
                <button onClick={() => handleToggleStatus(user.id)} title={user.active !== false ? 'Suspend Admin' : 'Activate Admin'} className={`p-2.5 rounded-xl transition-all ${user.active !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                    {user.active !== false ? <UserX size={18} /> : <UserCheck size={18} />}
                </button>
                <button onClick={() => handleResetPassword(user)} title="Reset password" className="p-2.5 text-violet-600 hover:bg-violet-50 rounded-xl transition-all"><KeyRound size={18} /></button>
                {user.role === 'ADMIN' && <button onClick={() => openDeptModal(user)} title="Assign departments" className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-xl transition-all"><LayoutDashboard size={18} /></button>}
                {user.role === 'ADMIN' && <button onClick={() => handlePromote(user.id)} title="Promote to Super Admin" className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Crown size={18} /></button>}
                {user.role !== 'SUPER_ADMIN' && <button onClick={() => handleDemote(user.id)} title="Demote to Instructor" className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><UserMinus size={18} /></button>}
                <button onClick={() => setDeletingAdmin(user)} title="Delete admin" className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
            </div>
        </div>
    );

    const inputCls = "px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all";
    const filterCls = "px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer appearance-none";

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <ShieldCheck size={28} className="text-rose-600" /> Manage Admins
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Manage admin accounts and permissions</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
                    <Plus size={16} /> Add Admin
                </button>
            </div>

            {/* Invite Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Add New Admin</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <form onSubmit={handleInvite} className="p-6 sm:p-8 space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">First Name *</label>
                                    <input required type="text" placeholder="Alex" value={inviteData.firstName} onChange={e => setInviteData({ ...inviteData, firstName: e.target.value })} className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Last Name</label>
                                    <input type="text" placeholder="Rivera" value={inviteData.lastName} onChange={e => setInviteData({ ...inviteData, lastName: e.target.value })} className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Email Address *</label>
                                    <div className="relative">
                                        <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                        <input required type="email" placeholder="alex@edunexus.com" value={inviteData.email} onChange={e => setInviteData({ ...inviteData, email: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Password *</label>
                                    <div className="relative">
                                        <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                        <input required type="password" placeholder="Min. 8 characters" value={inviteData.password} onChange={e => setInviteData({ ...inviteData, password: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Confirm Password *</label>
                                    <div className="relative">
                                        <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                        <input required type="password" placeholder="Repeat password" value={inviteData.confirmPassword} onChange={e => setInviteData({ ...inviteData, confirmPassword: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Admin Role</label>
                                    <select value={inviteData.role} onChange={e => setInviteData({ ...inviteData, role: e.target.value })} className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium appearance-none">
                                        <option value="ADMIN">Standard Admin</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Departments</label>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 border border-border rounded-2xl p-2 bg-muted/20">
                                    {(departments || []).map(d => {
                                        const isSelected = inviteData.departmentIds.includes(d.id);
                                        return (
                                            <label key={d.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-muted border border-transparent'}`}>
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleInviteDeptId(d.id)} className="w-4 h-4 rounded accent-indigo-600" />
                                                <Building2 size={16} className={`text-muted-foreground shrink-0 ${isSelected ? 'text-indigo-600' : ''}`} strokeWidth={2.5} />
                                                <span className="text-sm font-bold text-foreground truncate">{d.name}</span>
                                            </label>
                                        );
                                    })}
                                    {(!departments || departments.length === 0) && <p className="text-sm text-muted-foreground/60 text-center py-3 font-medium">No departments yet</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="text" placeholder="Create new department..." value={inviteCustomDept} onChange={e => setInviteCustomDept(e.target.value)} className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-xs font-medium" />
                                    <button type="button" disabled={creatingCustomDept || !inviteCustomDept.trim()} onClick={handleAddCustomDept} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap">
                                        {creatingCustomDept ? '...' : '+ Create'}
                                    </button>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={inviting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]">
                                    {inviting ? 'Creating...' : 'Create Admin Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Summary Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Admins', value: stats.admins, icon: ShieldCheck, cls: 'text-amber-600 bg-amber-50 border-amber-100' },
                    { label: 'Super Admins', value: stats.superAdmins, icon: Key, cls: 'text-rose-600 bg-rose-50 border-rose-100' },
                    { label: 'Active', value: stats.active, icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                    { label: 'Filtered', value: filtered.length, icon: Users, cls: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                ].map(({ label, value, icon: Icon, cls }) => (
                    <div key={label} className={`${cls} border rounded-2xl p-4 shadow-sm relative overflow-hidden`}>
                        <div className="absolute top-2 right-2 opacity-20"><Icon size={36} className="text-current" strokeWidth={1.5} /></div>
                        <p className="text-2xl font-extrabold mb-0.5 tracking-tight relative z-10">{value}</p>
                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest relative z-10">{label}</p>
                    </div>
                ))}
            </div>

            {/* ── Filter Bar ───────────────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-0">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className={`${inputCls} w-full pl-11 pr-4`} />
                    </div>
                    {/* Role filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-muted-foreground/60" />
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={filterCls}>
                            <option value="ALL">All Roles</option>
                            <option value="ADMIN">Admin</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                    </div>
                    {/* Status filter */}
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={filterCls}>
                        <option value="ALL">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                    </select>
                    {/* Department filter */}
                    <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={filterCls}>
                        <option value="ALL">All Departments</option>
                        <option value="">Global (No Dept)</option>
                        {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {/* Group By */}
                    <select value={groupBy} onChange={e => { setGroupBy(e.target.value); setExpandedGroups({}); }} className={filterCls}>
                        <option value="none">No Grouping</option>
                        <option value="role">Group by Role</option>
                        <option value="department">Group by Department</option>
                    </select>
                </div>
            </div>

            {/* ── Admin List ──────────────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {groupBy !== 'none' && grouped ? (
                            <div className="divide-y divide-border min-w-[700px]">
                                {Object.entries(grouped).map(([groupKey, members]) => (
                                    <div key={groupKey}>
                                        <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center gap-3 px-6 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left">
                                            {expandedGroups[groupKey] === false ? <ChevronRight size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                                            <span className="text-sm font-black text-foreground uppercase tracking-wider">{groupKey}</span>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-muted text-muted-foreground">{members.length}</span>
                                        </button>
                                        {expandedGroups[groupKey] !== false && (
                                            <div className="divide-y divide-border">
                                                {members.map(u => <AdminCard key={u.id} user={u} />)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="divide-y divide-border min-w-[700px]">
                                {filtered.map(u => <AdminCard key={u.id} user={u} />)}
                                {filtered.length === 0 && (
                                    <div className="text-center py-20">
                                        <ShieldCheck size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-foreground">No admins found</h3>
                                        <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Role Action Modal ───────────────────────────────────────── */}
            {roleAction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                {roleAction.newRole === 'SUPER_ADMIN' ? <Crown size={20} className="text-indigo-600" /> : <UserMinus size={20} className="text-slate-600" />}
                                Confirm {roleAction.label}
                            </h3>
                            <button onClick={() => setRoleAction(null)} className="p-2 hover:bg-muted rounded-full"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {roleAction.newRole === 'SUPER_ADMIN' ? 'This grants full platform access. ' : 'This removes admin permissions. '}
                                Enter your password to authorize.
                            </p>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Your admin password <span className="text-rose-500">*</span></label>
                                <input type="password" value={roleActionPassword} onChange={e => setRoleActionPassword(e.target.value)} placeholder="Enter your password to authorize" autoFocus className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium" />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setRoleAction(null)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button onClick={confirmRoleAction} disabled={roleActing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {roleActing ? 'Processing...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Result Modal ──────────────────────────────────────── */}
            {resetResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border bg-emerald-50 flex justify-between items-center">
                            <h3 className="text-lg font-extrabold text-emerald-800 flex items-center gap-2"><KeyRound size={20} /> Password Reset</h3>
                            <button onClick={() => setResetResult(null)} className="p-2 hover:bg-emerald-100 rounded-full"><X size={20} className="text-emerald-700" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Temporary password for <b>{resetResult.name}</b>:</p>
                            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-4 py-3">
                                <code className="flex-1 text-sm font-bold text-foreground select-all">{resetResult.tempPassword}</code>
                                <button onClick={() => { navigator.clipboard.writeText(resetResult.tempPassword); toast.success('Copied!'); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Copy size={16} /></button>
                            </div>
                            <button onClick={() => setResetResult(null)} className="w-full px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Admin Modal ───────────────────────────────────────── */}
            {editingAdmin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground">Edit Admin</h3>
                            <button onClick={() => setEditingAdmin(null)} className="p-2 hover:bg-muted rounded-full"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <form onSubmit={handleEditAdmin} className="p-6 space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">First Name *</label>
                                    <input required type="text" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Last Name</label>
                                    <input type="text" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Email *</label>
                                <input required type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Phone</label>
                                <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={editForm.active} onChange={e => setEditForm({ ...editForm, active: e.target.checked })} className="w-4 h-4 rounded accent-indigo-600" />
                                <span className="text-sm font-medium text-foreground">Active</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingAdmin(null)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={savingEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {savingEdit ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Change Password Modal ───────────────────────────────────── */}
            {pwAdmin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground">Change Password</h3>
                            <button onClick={() => setPwAdmin(null)} className="p-2 hover:bg-muted rounded-full"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Set a new password for <b>{pwAdmin.name}</b></p>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">New Password *</label>
                                <input type="password" value={pwForm.password} onChange={e => setPwForm({ ...pwForm, password: e.target.value })} placeholder="Min. 8 characters" className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Confirm *</label>
                                <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Repeat password" className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setPwAdmin(null)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={changingPw} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {changingPw ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Department Assignment Modal ─────────────────────────────── */}
            {deptModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground">Assign Departments</h3>
                            <button onClick={() => setDeptModal(null)} className="p-2 hover:bg-muted rounded-full"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <form onSubmit={handleSaveDepts} className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Select departments for <b>{deptModal.name}</b></p>
                            <div className="space-y-1.5 max-h-60 overflow-y-auto border border-border rounded-xl p-2">
                                {(departments || []).map(d => {
                                    const isSelected = selectedDeptIds.includes(d.id);
                                    return (
                                        <label key={d.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-muted border border-transparent'}`}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleDeptId(d.id)} className="w-4 h-4 rounded accent-indigo-600" />
                                            <span className="text-sm font-bold text-foreground">{d.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setDeptModal(null)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={savingDepts} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {savingDepts ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ───────────────────────────────── */}
            {deletingAdmin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border bg-rose-50 flex justify-between items-center">
                            <h3 className="text-xl font-extrabold text-rose-800 flex items-center gap-2"><AlertTriangle size={20} /> Delete Admin</h3>
                            <button onClick={() => setDeletingAdmin(null)} className="p-2 hover:bg-rose-100 rounded-full"><X size={20} className="text-rose-700" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Are you sure you want to delete <b>{deletingAdmin.name}</b>? This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeletingAdmin(null)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button onClick={handleDeleteAdmin} disabled={deletingAdminBusy} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {deletingAdminBusy ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
