import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Users, Plus, Search, Eye, Edit2, KeyRound, Power, Trash2, X, Mail, Phone,
    Building2, Hash, Clock, Download, GraduationCap, CheckCircle2
} from 'lucide-react';
import { usersAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DataTable } from '../../../components/ui/DataTable';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

// 400ms debounce for the search input (same pattern used by course search).
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

const emptyForm = () => ({ name: '', email: '', phone: '', password: '', departmentId: '', rollNo: '' });

// ─── Export CSV helper ────────────────────────────────────────────────────────
function downloadCSV(filename, rows) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SuperAdminStudents() {
    const navigate = useNavigate();

    // Filters
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Data
    const { data: students, loading, reload } = useAsyncData(
        () => usersAPI.getAll({
            role: 'STUDENT',
            search: debouncedSearch || undefined,
            departmentId: deptFilter || undefined,
            status: statusFilter || undefined,
            limit: 500,
        }),
        [debouncedSearch, deptFilter, statusFilter]
    );
    const { data: departments, reload: reloadDepts } = useAsyncData(() => departmentsAPI.list(), []);

    const list = Array.isArray(students) ? students : [];

    // Selection (bulk actions)
    const [selected, setSelected] = useState(new Set());
    // Modals
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(emptyForm());
    const [creating, setCreating] = useState(false);
    const [createResult, setCreateResult] = useState(null);

    const [editingStudent, setEditingStudent] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    const [resetResult, setResetResult] = useState(null);
    const [resetting, setResetting] = useState(false);

    const [deletingStudent, setDeletingStudent] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkStatus, setBulkStatus] = useState(false);

    const [togglingId, setTogglingId] = useState(null);

    const deptName = (id) => (departments || []).find(d => d.id === id)?.name || null;

    // ── Selection helpers ────────────────────────────────────────────────────
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // ── Create ───────────────────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name.trim() || !createForm.email.trim()) {
            toast.error('Name and email are required');
            return;
        }
        if (!createForm.rollNo.trim()) {
            toast.error('Roll number is required for student accounts');
            return;
        }
        setCreating(true);
        try {
            const res = await usersAPI.createStudent({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                phone: createForm.phone.trim(),
                password: createForm.password,
                departmentId: createForm.departmentId || null,
                rollNo: createForm.rollNo.trim(),
            });
            toast.success(`Student "${createForm.name.trim()}" created`);
            setCreateResult(res);
            setCreateForm(emptyForm());
            reload();
            reloadDepts();
        } catch (err) {
            toast.error(err.message || 'Failed to create student');
        } finally {
            setCreating(false);
        }
    };

    // ── Edit ─────────────────────────────────────────────────────────────────
    const openEdit = (student) => {
        setEditForm({
            name: student.name || '',
            email: student.email || '',
            phone: student.phone || '',
            rollNo: student.rollNo || '',
            departmentId: student.departmentId || '',
        });
        setEditingStudent(student);
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim() || !editForm.email.trim()) {
            toast.error('Name and email are required');
            return;
        }
        setSaving(true);
        try {
            await usersAPI.updateUser(editingStudent.id, {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                phone: editForm.phone.trim(),
                rollNo: editForm.rollNo.trim(),
                departmentId: editForm.departmentId || null,
            });
            toast.success(`Student "${editForm.name.trim()}" updated`);
            setEditingStudent(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update student');
        } finally {
            setSaving(false);
        }
    };

    // ── Reset password ───────────────────────────────────────────────────────
    const handleReset = async (student) => {
        if (!window.confirm(`Reset password for ${student.name}? A new temporary password will be generated.`)) return;
        setResetting(true);
        try {
            const res = await usersAPI.resetPassword(student.id);
            setResetResult({ name: student.name, tempPassword: res.tempPassword });
            toast.success('Password reset');
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    // ── Toggle status ────────────────────────────────────────────────────────
    const handleToggleStatus = async (student) => {
        setTogglingId(student.id);
        try {
            await usersAPI.toggleStatus(student.id);
            toast.success(`${student.name} ${student.active === false ? 'activated' : 'suspended'}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally {
            setTogglingId(null);
        }
    };

    // ── Delete (single) ──────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deletingStudent) return;
        setDeleting(true);
        try {
            await usersAPI.delete(deletingStudent.id);
            toast.success(`Student "${deletingStudent.name}" deleted`);
            setDeletingStudent(null);
            setSelected(prev => { const n = new Set(prev); n.delete(deletingStudent.id); return n; });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete student');
        } finally {
            setDeleting(false);
        }
    };

    // ── Bulk actions ─────────────────────────────────────────────────────────
    const handleBulkStatus = async (active) => {
        const ids = [...selected];
        if (!ids.length) return;
        setBulkStatus(true);
        try {
            const res = await usersAPI.bulkToggleStatus(ids, active);
            toast.success(`${res.updated ?? ids.length} student(s) ${active ? 'activated' : 'suspended'}`);
            setSelected(new Set());
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update statuses');
        } finally {
            setBulkStatus(false);
        }
    };

    const handleBulkDelete = async () => {
        const ids = [...selected];
        if (!ids.length) return;
        if (!window.confirm(`Delete ${ids.length} selected student(s)? This cannot be undone.`)) return;
        setBulkDeleting(true);
        try {
            const res = await usersAPI.bulkDeleteUsers(ids);
            toast.success(`${res.deleted ?? ids.length} student(s) deleted`);
            setSelected(new Set());
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete students');
        } finally {
            setBulkDeleting(false);
        }
    };

    // ── Export ───────────────────────────────────────────────────────────────
    const exportCSV = async (onlySelected = false) => {
        try {
            let rows;
            if (onlySelected) {
                rows = list.filter(s => selected.has(s.id));
            } else {
                // Export everything matching the current filters (up to 1000 rows).
                rows = await usersAPI.getAll({
                    role: 'STUDENT',
                    search: debouncedSearch || undefined,
                    departmentId: deptFilter || undefined,
                    status: statusFilter || undefined,
                    limit: 1000,
                });
                if (!Array.isArray(rows)) rows = [];
            }
            const data = rows.map(s => ({
                'Roll Number': s.rollNo || '',
                'Student ID': shortId(s.id),
                'Name': s.name || '',
                'Email': s.email || '',
                'Phone': s.phone || '',
                'Department': deptName(s.departmentId) || s.departmentName || '',
                'Status': s.active === false ? 'Suspended' : 'Active',
                'Created At': s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
            }));
            downloadCSV(`students_${new Date().toISOString().slice(0, 10)}.csv`, data);
            toast.success(`Exported ${data.length} student(s)`);
        } catch (err) {
            toast.error(err.message || 'Failed to export students');
        }
    };

    // ── Derived stats ────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        const total = list.length;
        const active = list.filter(s => s.active !== false).length;
        return { total, active, suspended: total - active };
    }, [list]);

    const filteredCount = list.length;

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto px-0 pb-12">
            <PageHeader
                title="Students"
                subtitle="Manage all students across every department — add, edit, reset passwords, bulk actions, and export"
                action={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => exportCSV(false)}
                            className="flex items-center gap-2 border border-border bg-card hover:bg-muted text-foreground px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                        >
                            <Download size={15} /> Export CSV
                        </button>
                        <button
                            onClick={() => { setCreateResult(null); setCreateForm(emptyForm()); setShowCreate(true); }}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                            <Plus size={16} /> Add Student
                        </button>
                    </div>
                }
            />

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Students', value: totals.total.toLocaleString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
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
                        placeholder="Search by name, ID, roll number, or email..."
                        className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                    />
                </div>
                <select
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="sm:w-52 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground appearance-none cursor-pointer"
                >
                    <option value="">All Departments</option>
                    {(departments || []).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="sm:w-44 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground appearance-none cursor-pointer"
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
                {(deptFilter || statusFilter || search) && (
                    <button
                        onClick={() => { setDeptFilter(''); setStatusFilter(''); setSearch(''); }}
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X size={14} /> Clear
                    </button>
                )}
            </div>

            {/* Bulk Actions Bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-lg shadow-indigo-200/50 dark:shadow-none animate-in slide-in-from-top-2 duration-200">
                    <span className="text-sm font-bold flex items-center gap-2">
                        <CheckCircle2 size={16} /> {selected.size} selected
                    </span>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleBulkStatus(true)}
                        disabled={bulkStatus}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        <CheckCircle2 size={13} /> Activate
                    </button>
                    <button
                        onClick={() => handleBulkStatus(false)}
                        disabled={bulkStatus}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        <Power size={13} /> Suspend
                    </button>
                    <button
                        onClick={() => exportCSV(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors"
                    >
                        <Download size={13} /> Export
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/90 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={13} /> Delete
                    </button>
                    <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="Clear selection">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Students Table */}
            <DataTable
                columns={['', 'Student', 'Email', 'Phone', 'Department', 'Status', 'Created', 'Actions']}
                loading={loading}
                empty={filteredCount === 0}
                emptyText="No students found. Adjust your filters or add a new student."
            >
                {list.map(student => (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <input
                                type="checkbox"
                                checked={selected.has(student.id)}
                                onChange={() => toggleSelect(student.id)}
                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                aria-label={`Select ${student.name}`}
                            />
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                                {student.avatar ? (
                                    <img src={student.avatar} alt={student.name} className="w-9 h-9 rounded-xl object-cover border border-border flex-shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {student.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Link
                                        to={`/super-admin/students/${student.id}`}
                                        className="font-bold text-foreground truncate block group-hover:text-indigo-600 transition-colors"
                                        title="View student detail"
                                    >
                                        {student.name}
                                    </Link>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                        <Hash size={9} /> {student.rollNo || shortId(student.id)}
                                        <span className="text-muted-foreground/30">· #{shortId(student.id)}</span>
                                    </p>
                                </div>
                            </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                                <Mail size={13} className="text-muted-foreground/50 flex-shrink-0" /> {student.email}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                <Phone size={13} className="text-muted-foreground/50 flex-shrink-0" /> {student.phone || '—'}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            {student.departmentId ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] font-black tracking-wide">
                                    <Building2 size={10} /> {deptName(student.departmentId) || student.departmentName || '—'}
                                </span>
                            ) : '—'}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4"><StatusBadge active={student.active} /></td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                <Clock size={12} className="opacity-50" /> {fmtDate(student.createdAt)}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                                <button
                                    onClick={() => navigate(`/super-admin/students/${student.id}`)}
                                    title="View (enrollments, progress, certificates)"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                                >
                                    <Eye size={15} />
                                </button>
                                <button
                                    onClick={() => openEdit(student)}
                                    title="Edit / Change Department"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-all"
                                >
                                    <Edit2 size={15} />
                                </button>
                                <button
                                    onClick={() => handleReset(student)}
                                    disabled={resetting}
                                    title="Reset password"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all"
                                >
                                    <KeyRound size={15} />
                                </button>
                                <button
                                    onClick={() => handleToggleStatus(student)}
                                    disabled={togglingId === student.id}
                                    title={student.active === false ? 'Activate' : 'Suspend'}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${
                                        student.active === false
                                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                            : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                    }`}
                                >
                                    {togglingId === student.id
                                        ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        : <Power size={15} />}
                                </button>
                                <button
                                    onClick={() => setDeletingStudent(student)}
                                    title="Delete"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </DataTable>

            {/* Create Student Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <div className="bg-card w-full max-w-xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <GraduationCap size={18} className="text-indigo-600" /> Add Student
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Full Name *</label>
                                    <input required type="text" placeholder="e.g. Jane Doe" value={createForm.name}
                                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Email *</label>
                                    <input required type="email" placeholder="jane.doe@college.edu" value={createForm.email}
                                        onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Roll Number *</label>
                                    <input required type="text" placeholder="e.g. CS22001" value={createForm.rollNo}
                                        onChange={e => setCreateForm(f => ({ ...f, rollNo: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Phone</label>
                                    <input type="tel" placeholder="+91 98765 43210" value={createForm.phone}
                                        onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Department</label>
                                    <select value={createForm.departmentId}
                                        onChange={e => setCreateForm(f => ({ ...f, departmentId: e.target.value }))} className={selectCls}>
                                        <option value="">— No department —</option>
                                        {(departments || []).map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Password</label>
                                    <input type="password" placeholder="Min. 8 chars (blank = auto-generate)" value={createForm.password}
                                        onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
                                    <p className="text-[11px] text-muted-foreground/60 font-medium ml-1">Blank generates a temporary password shown after creation.</p>
                                </div>
                            </div>

                            {createResult && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-2xl space-y-1.5 text-[11px] font-medium text-muted-foreground">
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                        <CheckCircle2 size={16} /> Student Created Successfully!
                                    </p>
                                    <p><strong className="text-foreground">Name:</strong> {createResult.user?.name}</p>
                                    <p><strong className="text-foreground">Email:</strong> {createResult.user?.email}</p>
                                    {createResult.tempPassword && (
                                        <p><strong className="text-foreground">Temp Password:</strong>
                                            <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold">{createResult.tempPassword}</code>
                                        </p>
                                    )}
                                    <p className="text-[10px] text-emerald-700/70 font-semibold">Share the credentials securely — they are shown only once.</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Close</button>
                                {!createResult && (
                                    <button type="submit" disabled={creating}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                        {creating ? 'Creating...' : 'Create Student'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Student Modal */}
            {editingStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setEditingStudent(null)}>
                    <div className="bg-card w-full max-w-xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Edit2 size={18} className="text-indigo-600" /> Edit Student
                            </h3>
                            <button onClick={() => setEditingStudent(null)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
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
                                    <label className={labelCls}>Roll Number</label>
                                    <input type="text" value={editForm.rollNo}
                                        onChange={e => setEditForm(f => ({ ...f, rollNo: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Phone</label>
                                    <input type="tel" value={editForm.phone}
                                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls + ' flex items-center gap-1.5'}>
                                    <Building2 size={13} className="text-indigo-500" /> Change Department
                                </label>
                                <select value={editForm.departmentId}
                                    onChange={e => setEditForm(f => ({ ...f, departmentId: e.target.value }))} className={selectCls}>
                                    <option value="">— No department (global) —</option>
                                    {(departments || []).map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground/60 font-medium ml-1">Moving a student changes their department scope. Roll numbers are unique per department.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingStudent(null)}
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
            {deletingStudent && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setDeletingStudent(null)}>
                    <div className="bg-card w-full max-w-sm border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-foreground tracking-tight">Delete Student?</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Are you sure you want to delete <strong className="text-foreground">{deletingStudent.name}</strong>?
                                    Their enrollments, progress, and certificates will also be removed.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setDeletingStudent(null)}
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
