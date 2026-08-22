import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Plus, Search, Eye, Edit2, KeyRound, Power, Trash2, X, Mail, Phone,
    Building2, Clock, GraduationCap, CheckCircle2, BookOpen
} from 'lucide-react';
import { usersAPI, departmentsAPI, coursesAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DataTable } from '../../../components/ui/DataTable';
import toast from 'react-hot-toast';

const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

function useDebouncedValue(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

function StatusBadge({ active }) {
    return active !== false ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
        </span>
    );
}

const inputCls = 'w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium';
const labelCls = 'text-xs font-black uppercase tracking-wider text-muted-foreground ml-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

const emptyForm = () => ({
    name: '', email: '', phone: '', password: '', departmentId: '',
    designation: '', qualification: '', specialization: '', active: true,
});

export default function SuperAdminInstructors() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const { data: instructors, loading, reload } = useAsyncData(
        () => usersAPI.getAll({
            role: 'INSTRUCTOR',
            search: debouncedSearch || undefined,
            departmentId: deptFilter || undefined,
            status: statusFilter || undefined,
            limit: 500,
        }),
        [debouncedSearch, deptFilter, statusFilter]
    );
    const { data: departments } = useAsyncData(() => departmentsAPI.list(), []);
    const { data: allCourses } = useAsyncData(
        () => coursesAPI.getAll({ admin: true, limit: 500 }),
        []
    );

    const list = Array.isArray(instructors) ? instructors : [];
    const courses = Array.isArray(allCourses) ? allCourses : [];
    const deptName = (id) => (departments || []).find(d => d.id === id)?.name || null;

    // Create
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(emptyForm());
    const [creating, setCreating] = useState(false);
    const [createResult, setCreateResult] = useState(null);

    // Edit
    const [editingInstructor, setEditingInstructor] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    // Assign courses
    const [assignInstructor, setAssignInstructor] = useState(null);
    const [assignSearch, setAssignSearch] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Reset / delete / toggle
    const [resetResult, setResetResult] = useState(null);
    const [deletingInstructor, setDeletingInstructor] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    const totals = useMemo(() => {
        const active = list.filter(i => i.active !== false).length;
        return { total: list.length, active, suspended: list.length - active };
    }, [list]);

    // ── Create ────────────────────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name.trim() || !createForm.email.trim()) {
            toast.error('Name and email are required');
            return;
        }
        setCreating(true);
        try {
            const res = await usersAPI.createInstructor({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                phone: createForm.phone.trim(),
                password: createForm.password,
                departmentId: createForm.departmentId || null,
                designation: createForm.designation.trim(),
                qualification: createForm.qualification.trim(),
                specialization: createForm.specialization.trim(),
            });
            setCreateResult(res);
            setCreateForm(emptyForm());
            toast.success(`Instructor "${createForm.name.trim()}" created`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create instructor');
        } finally {
            setCreating(false);
        }
    };

    // ── Edit ──────────────────────────────────────────────────────────────────
    const openEdit = (inst) => {
        setEditForm({
            name: inst.name || '',
            email: inst.email || '',
            phone: inst.phone || '',
            departmentId: inst.departmentId || '',
            designation: inst.designation || '',
            qualification: inst.qualification || '',
            specialization: inst.specialization || '',
            active: inst.active !== false,
        });
        setEditingInstructor(inst);
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim() || !editForm.email.trim()) {
            toast.error('Name and email are required');
            return;
        }
        setSaving(true);
        try {
            await usersAPI.updateUser(editingInstructor.id, {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                phone: editForm.phone.trim(),
                departmentId: editForm.departmentId || null,
                designation: editForm.designation.trim(),
                qualification: editForm.qualification.trim(),
                specialization: editForm.specialization.trim(),
                active: editForm.active,
            });
            toast.success(`Instructor "${editForm.name.trim()}" updated`);
            setEditingInstructor(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update instructor');
        } finally {
            setSaving(false);
        }
    };

    // ── Assign courses ────────────────────────────────────────────────────────
    const openAssignCourses = (inst) => {
        setAssignInstructor(inst);
        setAssignSearch('');
    };

    const assignableCourses = useMemo(() => {
        if (!assignInstructor) return [];
        const q = assignSearch.trim().toLowerCase();
        return courses.filter(c => {
            if (c.instructorId === assignInstructor.id) return false; // already owns
            if (q && !(c.title || '').toLowerCase().includes(q)) return false;
            return true;
        });
    }, [courses, assignInstructor, assignSearch]);

    const [checkedCourses, setCheckedCourses] = useState(new Set());
    useEffect(() => {
        if (assignInstructor) setCheckedCourses(new Set());
    }, [assignInstructor]);

    const toggleCourse = (id) => {
        setCheckedCourses(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleAssignCourses = async () => {
        if (!assignInstructor || checkedCourses.size === 0) return;
        setAssigning(true);
        try {
            let done = 0;
            for (const courseId of checkedCourses) {
                await coursesAPI.assignInstructor(courseId, assignInstructor.id);
                done++;
            }
            toast.success(`${done} course(s) assigned to ${assignInstructor.name}`);
            setAssignInstructor(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to assign courses');
        } finally {
            setAssigning(false);
        }
    };

    // ── Reset password ────────────────────────────────────────────────────────
    const handleReset = async (inst) => {
        if (!window.confirm(`Reset password for ${inst.name}? A new temporary password will be generated.`)) return;
        try {
            const res = await usersAPI.resetPassword(inst.id);
            setResetResult({ name: inst.name, tempPassword: res.tempPassword });
            toast.success('Password reset');
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        }
    };

    // ── Toggle / delete ───────────────────────────────────────────────────────
    const handleToggleStatus = async (inst) => {
        setTogglingId(inst.id);
        try {
            await usersAPI.toggleStatus(inst.id);
            toast.success(`${inst.name} ${inst.active === false ? 'activated' : 'suspended'}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deletingInstructor) return;
        setDeleting(true);
        try {
            await usersAPI.delete(deletingInstructor.id);
            toast.success(`Instructor "${deletingInstructor.name}" deleted`);
            setDeletingInstructor(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete instructor');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto px-0 pb-12">
            <PageHeader
                title="Instructors"
                subtitle="Manage all instructors across every department — profiles, departments, course assignments, and credentials"
                action={
                    <button
                        onClick={() => { setCreateResult(null); setCreateForm(emptyForm()); setShowCreate(true); }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        <Plus size={16} /> Add Instructor
                    </button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Instructors', value: totals.total.toLocaleString(), icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Active', value: totals.active.toLocaleString(), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Suspended', value: totals.suspended.toLocaleString(), icon: Power, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map(item => (
                    <div key={item.label} className={`${item.bg} border border-border/50 rounded-2xl p-4 shadow-sm`}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <item.icon size={13} className={item.color} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{item.label}</span>
                        </div>
                        <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email, or specialization..."
                        className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                    />
                </div>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="sm:w-52 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground appearance-none cursor-pointer">
                    <option value="">All Departments</option>
                    {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sm:w-44 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground appearance-none cursor-pointer">
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
                {(deptFilter || statusFilter || search) && (
                    <button onClick={() => { setDeptFilter(''); setStatusFilter(''); setSearch(''); }}
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <X size={14} /> Clear
                    </button>
                )}
            </div>

            {/* Table */}
            <DataTable
                columns={['', 'Instructor', 'Email', 'Phone', 'Department', 'Designation', 'Qualification', 'Specialization', 'Status', 'Created', 'Actions']}
                loading={loading}
                empty={list.length === 0}
                emptyText="No instructors found. Adjust your filters or add a new instructor."
            >
                {list.map(inst => (
                    <tr key={inst.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="font-mono text-[11px] font-bold text-muted-foreground/70" title={inst.id}>#{shortId(inst.id)}</span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                                {inst.avatar ? (
                                    <img src={inst.avatar} alt={inst.name} className="w-9 h-9 rounded-xl object-cover border border-border flex-shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {inst.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Link
                                        to={`/super-admin/instructors/${inst.id}`}
                                        className="font-bold text-foreground truncate block group-hover:text-indigo-600 transition-colors"
                                        title="View instructor detail"
                                    >
                                        {inst.name}
                                    </Link>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                                        {inst.username ? `@${inst.username}` : 'Instructor'}
                                    </p>
                                </div>
                            </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                                <Mail size={13} className="text-muted-foreground/50 flex-shrink-0" /> {inst.email}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                <Phone size={13} className="text-muted-foreground/50 flex-shrink-0" /> {inst.phone || '—'}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            {inst.departmentId ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] font-black tracking-wide">
                                    <Building2 size={10} /> {deptName(inst.departmentId) || inst.departmentName || '—'}
                                </span>
                            ) : '—'}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4 text-sm font-medium text-foreground/80">{inst.designation || '—'}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-4 text-sm font-medium text-foreground/80">{inst.qualification || '—'}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-4 text-sm font-medium text-foreground/80">{inst.specialization || '—'}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-4"><StatusBadge active={inst.active} /></td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                <Clock size={12} className="opacity-50" /> {fmtDate(inst.createdAt)}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                                <button onClick={() => navigate(`/super-admin/instructors/${inst.id}`)} title="View (courses, students, performance)"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
                                    <Eye size={15} />
                                </button>
                                <button onClick={() => openEdit(inst)} title="Edit"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-all">
                                    <Edit2 size={15} />
                                </button>
                                <button onClick={() => openAssignCourses(inst)} title="Assign courses"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all">
                                    <BookOpen size={15} />
                                </button>
                                <button onClick={() => handleReset(inst)} title="Reset password"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all">
                                    <KeyRound size={15} />
                                </button>
                                <button onClick={() => handleToggleStatus(inst)} disabled={togglingId === inst.id}
                                    title={inst.active === false ? 'Activate' : 'Suspend'}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${
                                        inst.active === false
                                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                            : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                    }`}>
                                    {togglingId === inst.id
                                        ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        : <Power size={15} />}
                                </button>
                                <button onClick={() => setDeletingInstructor(inst)} title="Delete"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </DataTable>

            {/* Create Instructor Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <div className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <GraduationCap size={18} className="text-emerald-600" /> Add Instructor
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Full Name *</label>
                                    <input required type="text" placeholder="e.g. Dr. Arjun Patel" value={createForm.name}
                                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Email *</label>
                                    <input required type="email" placeholder="arjun@college.edu" value={createForm.email}
                                        onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Phone</label>
                                    <input type="tel" placeholder="+91 98765 43210" value={createForm.phone}
                                        onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Department</label>
                                    <select value={createForm.departmentId}
                                        onChange={e => setCreateForm(f => ({ ...f, departmentId: e.target.value }))} className={selectCls}>
                                        <option value="">— No department —</option>
                                        {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Designation</label>
                                    <input type="text" placeholder="e.g. Professor" value={createForm.designation}
                                        onChange={e => setCreateForm(f => ({ ...f, designation: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Qualification</label>
                                    <input type="text" placeholder="e.g. Ph.D. CSE" value={createForm.qualification}
                                        onChange={e => setCreateForm(f => ({ ...f, qualification: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Specialization</label>
                                    <input type="text" placeholder="e.g. Machine Learning" value={createForm.specialization}
                                        onChange={e => setCreateForm(f => ({ ...f, specialization: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Password</label>
                                <input type="password" placeholder="Min. 8 chars (blank = auto-generate)" value={createForm.password}
                                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
                                <p className="text-[11px] text-muted-foreground/60 font-medium ml-1">Blank generates a temporary password shown after creation.</p>
                            </div>

                            {createResult && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-2xl space-y-1.5 text-[11px] font-medium text-muted-foreground">
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                        <CheckCircle2 size={16} /> Instructor Created Successfully!
                                    </p>
                                    <p><strong className="text-foreground">Name:</strong> {createResult.user?.name}</p>
                                    <p><strong className="text-foreground">Email:</strong> {createResult.user?.email}</p>
                                    {createResult.tempPassword && (
                                        <p><strong className="text-foreground">Temp Password:</strong>
                                            <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold">{createResult.tempPassword}</code>
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Close</button>
                                {!createResult && (
                                    <button type="submit" disabled={creating}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                        {creating ? 'Creating...' : 'Create Instructor'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Instructor Modal */}
            {editingInstructor && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setEditingInstructor(null)}>
                    <div className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Edit2 size={18} className="text-emerald-600" /> Edit Instructor
                            </h3>
                            <button onClick={() => setEditingInstructor(null)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Full Name *</label>
                                    <input required type="text" value={editForm.name}
                                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Email *</label>
                                    <input required type="email" value={editForm.email}
                                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Phone</label>
                                    <input type="tel" value={editForm.phone}
                                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls + ' flex items-center gap-1.5'}><Building2 size={13} className="text-indigo-500" /> Department</label>
                                    <select value={editForm.departmentId}
                                        onChange={e => setEditForm(f => ({ ...f, departmentId: e.target.value }))} className={selectCls}>
                                        <option value="">— No department (global) —</option>
                                        {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Designation</label>
                                    <input type="text" value={editForm.designation}
                                        onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Qualification</label>
                                    <input type="text" value={editForm.qualification}
                                        onChange={e => setEditForm(f => ({ ...f, qualification: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Specialization</label>
                                    <input type="text" value={editForm.specialization}
                                        onChange={e => setEditForm(f => ({ ...f, specialization: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Status</label>
                                <select value={editForm.active ? 'active' : 'inactive'}
                                    onChange={e => setEditForm(f => ({ ...f, active: e.target.value === 'active' }))} className={selectCls}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingInstructor(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Courses Modal */}
            {assignInstructor && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setAssignInstructor(null)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <BookOpen size={18} className="text-purple-600" /> Assign Courses
                            </h3>
                            <button onClick={() => setAssignInstructor(null)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <p className="text-sm text-muted-foreground font-medium">
                                Select courses to assign to <span className="font-bold text-foreground">{assignInstructor.name}</span>.
                                Courses they already own are excluded.
                            </p>
                            <div className="relative">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                                <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                                    placeholder="Search courses..."
                                    className="w-full pl-9 pr-3 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all text-sm font-medium" />
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                {assignableCourses.map(course => (
                                    <label key={course.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                            checkedCourses.has(course.id) ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/10 dark:border-purple-700' : 'border-border hover:border-purple-200 hover:bg-muted/30'
                                        }`}>
                                        <input type="checkbox" checked={checkedCourses.has(course.id)} onChange={() => toggleCourse(course.id)}
                                            className="w-4 h-4 rounded accent-purple-600" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{course.title}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium truncate">
                                                {course.departmentName || 'No dept'} · {course.categoryName || 'Uncategorized'} · {course.status}
                                            </p>
                                        </div>
                                        {course.enrollmentCount > 0 && (
                                            <span className="text-[10px] font-bold text-muted-foreground flex-shrink-0">{course.enrollmentCount} students</span>
                                        )}
                                    </label>
                                ))}
                                {assignableCourses.length === 0 && (
                                    <div className="py-8 text-center text-muted-foreground/60 font-medium text-sm">
                                        No unassigned courses match. This instructor owns all of them.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 pt-2 border-t border-border flex gap-3">
                            <button type="button" onClick={() => setAssignInstructor(null)}
                                className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                            <button type="button" onClick={handleAssignCourses} disabled={assigning || checkedCourses.size === 0}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98]">
                                {assigning ? 'Assigning...' : `Assign ${checkedCourses.size || ''} Course${checkedCourses.size === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Result Modal */}
            {resetResult && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setResetResult(null)}>
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                <KeyRound size={24} className="text-violet-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-foreground tracking-tight">Password Reset</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    A new temporary password was generated for <strong className="text-foreground">{resetResult.name}</strong>.
                                </p>
                            </div>
                            <div className="bg-muted/40 border border-border rounded-2xl px-4 py-3">
                                <code className="font-mono text-sm font-bold text-foreground break-all">{resetResult.tempPassword || '(unchanged)'}</code>
                            </div>
                            <button onClick={() => setResetResult(null)}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98]">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingInstructor && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setDeletingInstructor(null)}>
                    <div className="bg-card w-full max-w-sm border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-foreground tracking-tight">Delete Instructor?</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Are you sure you want to delete <strong className="text-foreground">{deletingInstructor.name}</strong>?
                                    Their courses will also be removed.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setDeletingInstructor(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="button" onClick={handleDelete} disabled={deleting}
                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
