import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Plus, Pencil, Trash2, Eye, Power, RotateCcw, Download, Upload,
    GraduationCap, Building2, Layers, Users as UsersIcon, Check, X, Loader2,
} from 'lucide-react';
import { usersAPI, statsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DataTable, UserCell } from '../../../components/ui/DataTable';
import { useAuth } from '../../../contexts/AuthContext';
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
    return active ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-[11px] font-black uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
        </span>
    );
}

const inputCls = 'w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium';
const labelCls = 'text-xs font-black uppercase tracking-wider text-muted-foreground ml-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

const emptyForm = () => ({ name: '', email: '', phone: '', password: '', rollNo: '', year: '', semester: '', section: '', batch: '' });

function downloadCSV(filename, rows) {
    if (!rows.length) { toast.error('Nothing to export'); return; }
    const headers = Object.keys(rows[0]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function downloadPasswords(results, label) {
    const rows = results.filter(r => r.status === 'created' && r.tempPassword)
        .map(r => ({ Name: r.name, Email: r.email, 'Roll No': r.rollNo || '', Password: r.tempPassword }));
    downloadCSV(`Imported_${label}_Passwords_${new Date().toISOString().split('T')[0]}.csv`, rows);
}

export default function AdminStudents() {
    const { can } = useAuth();

    // Filters
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);
    const [statusFilter, setStatusFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');

    // Data — department isolation is enforced server-side; a scoped admin's
    // request can never return students outside their department.
    const { data: students, loading, reload } = useAsyncData(
        () => usersAPI.getAll({
            role: 'STUDENT',
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
            limit: 500,
        }),
        [debouncedSearch, statusFilter]
    );
    const { data: adminOverview } = useAsyncData(
        () => statsAPI.getAdminOverview().catch(() => null),
        []
    );

    const allStudents = Array.isArray(students) ? students : [];
    const list = useMemo(() => allStudents.filter(s =>
        (!yearFilter || String(s.year) === String(yearFilter)) &&
        (!sectionFilter || s.section === sectionFilter)
    ), [allStudents, yearFilter, sectionFilter]);

    const deptName = adminOverview?.data?.[0]?.departmentName || null;
    const deptId = adminOverview?.data?.[0]?.departmentId || null;
    const sections = [...new Set(allStudents.map(s => s.section).filter(Boolean))].sort();
    const years = [...new Set(allStudents.map(s => s.year).filter(y => y != null))].sort((a, b) => a - b);

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

    const [movingStudent, setMovingStudent] = useState(null);
    const [moveForm, setMoveForm] = useState({});
    const [moving, setMoving] = useState(false);

    const [resetResult, setResetResult] = useState(null);
    const [resetting, setResetting] = useState(false);

    const [deletingStudent, setDeletingStudent] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkStatus, setBulkStatus] = useState(false);

    // Bulk cohort assignment
    const [bulkAssign, setBulkAssign] = useState(null); // { field: 'section'|'batch'|'year'|'semester', value }
    const [assigning, setAssigning] = useState(false);

    // Import modal
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);

    const [togglingId, setTogglingId] = useState(null);
    const fileInputRef = useRef(null);

    // ── Selection helpers ────────────────────────────────────────────────────
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectedIds = [...selected];

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
                departmentId: deptId,
                rollNo: createForm.rollNo.trim(),
                year: createForm.year || undefined,
                semester: createForm.semester || undefined,
                section: createForm.section || undefined,
                batch: createForm.batch || undefined,
            });
            toast.success(`Student "${createForm.name.trim()}" created`);
            setCreateResult(res);
            setCreateForm(emptyForm());
            reload();
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
            year: student.year ?? '',
            semester: student.semester ?? '',
            section: student.section || '',
            batch: student.batch || '',
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
                year: editForm.year || null,
                semester: editForm.semester || null,
                section: editForm.section || null,
                batch: editForm.batch || null,
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

    // ── Move (section/batch within dept) ─────────────────────────────────────
    const openMove = (student) => {
        setMoveForm({
            year: student.year ?? '',
            semester: student.semester ?? '',
            section: student.section || '',
            batch: student.batch || '',
        });
        setMovingStudent(student);
    };

    const handleMove = async (e) => {
        e.preventDefault();
        setMoving(true);
        try {
            await usersAPI.updateUser(movingStudent.id, {
                year: moveForm.year || null,
                semester: moveForm.semester || null,
                section: moveForm.section || null,
                batch: moveForm.batch || null,
            });
            toast.success(`Moved ${movingStudent.name} to ${[moveForm.section && `Section ${moveForm.section}`, moveForm.batch].filter(Boolean).join(', ') || 'new cohort'}`);
            setMovingStudent(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to move student');
        } finally {
            setMoving(false);
        }
    };

    // ── Reset password ───────────────────────────────────────────────────────
    const handleReset = async (student) => {
        setResetting(true);
        try {
            const res = await usersAPI.resetPassword(student.id);
            setResetResult({ name: student.name, tempPassword: res.tempPassword });
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    // ── Toggle status ────────────────────────────────────────────────────────
    const handleToggle = async (student) => {
        setTogglingId(student.id);
        try {
            await usersAPI.toggleStatus(student.id);
            toast.success(student.active ? `${student.name} suspended` : `${student.name} activated`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally {
            setTogglingId(null);
        }
    };

    // ── Delete ───────────────────────────────────────────────────────────────
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

    // ── Bulk ─────────────────────────────────────────────────────────────────
    const handleBulkStatus = async (active) => {
        if (!selectedIds.length) { toast.error('Select at least one student'); return; }
        setBulkStatus(true);
        try {
            const res = await usersAPI.bulkToggleStatus(selectedIds, active);
            toast.success(`${res.updated} student${res.updated === 1 ? '' : 's'} ${active ? 'activated' : 'suspended'}`);
            setSelected(new Set());
            reload();
        } catch (err) {
            toast.error(err.message || 'Bulk status update failed');
        } finally {
            setBulkStatus(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.length) { toast.error('Select at least one student'); return; }
        if (!window.confirm(`Delete ${selectedIds.length} selected student(s)? This cannot be undone.`)) return;
        setBulkDeleting(true);
        try {
            const res = await usersAPI.bulkDeleteUsers(selectedIds);
            toast.success(`${res.deleted} student${res.deleted === 1 ? '' : 's'} deleted`);
            setSelected(new Set());
            reload();
        } catch (err) {
            toast.error(err.message || 'Bulk delete failed');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleBulkAssign = async () => {
        if (!bulkAssign) return;
        if (!selectedIds.length) { toast.error('Select at least one student'); return; }
        setAssigning(true);
        try {
            const res = await usersAPI.bulkAssignCohort(selectedIds, { [bulkAssign.field]: bulkAssign.value });
            toast.success(`${res.updated} student${res.updated === 1 ? '' : 's'} updated`);
            setBulkAssign(null);
            setSelected(new Set());
            reload();
        } catch (err) {
            toast.error(err.message || 'Bulk assignment failed');
        } finally {
            setAssigning(false);
        }
    };

    // ── Export ───────────────────────────────────────────────────────────────
    const exportCSV = (onlySelected = false) => {
        const rows = onlySelected
            ? allStudents.filter(s => selected.has(s.id))
            : list;
        downloadCSV(`Students_${new Date().toISOString().split('T')[0]}.csv`,
            rows.map(s => ({
                'Student ID': shortId(s.id),
                Name: s.name,
                Email: s.email,
                Phone: s.phone || '',
                'Roll No': s.rollNo || '',
                Year: s.year ?? '',
                Semester: s.semester ?? '',
                Section: s.section || '',
                Batch: s.batch || '',
                Status: s.active ? 'Active' : 'Suspended',
                'Created': fmtDate(s.createdAt),
            })));
    };

    // ── Import ───────────────────────────────────────────────────────────────
    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile) { toast.error('Choose a CSV or Excel file'); return; }
        setImporting(true);
        try {
            const res = await usersAPI.importStudents(importFile);
            setImportResults(res);
            reload();
        } catch (err) {
            toast.error(err.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    // ── Render helpers ───────────────────────────────────────────────────────
    const CohortChips = ({ s }) => (
        <div className="flex flex-wrap gap-1">
            {s.year != null && <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] font-bold">Y{s.year}</span>}
            {s.semester != null && <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 text-[11px] font-bold">S{s.semester}</span>}
            {s.section && <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-[11px] font-bold">{s.section}</span>}
            {s.batch && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[11px] font-bold">{s.batch}</span>}
            {s.year == null && s.semester == null && !s.section && !s.batch && (
                <span className="text-[11px] text-muted-foreground font-medium">—</span>
            )}
        </div>
    );

    const yearOptions = [1, 2, 3, 4];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        <GraduationCap size={26} className="text-indigo-600" />
                        Student Management
                        {deptName && (
                            <span className="inline-flex items-center gap-1.5 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 text-xs px-2.5 py-1 rounded-md font-black uppercase tracking-wide">
                                <Building2 size={12} /> {deptName}
                            </span>
                        )}
                    </span>
                }
                subtitle="Manage your department's students — add, edit, move section/batch, reset passwords, import, and export"
            />

            {/* Dept-scope banner — reinforces backend isolation */}
            <div className="flex items-center gap-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-2xl px-4 py-3 text-sm font-medium text-cyan-800 dark:text-cyan-200">
                <ShieldLockIcon />
                You can only see and manage students in <b>{deptName || 'your department'}</b>. Other departments are blocked server-side.
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name / roll / ID / email…"
                        className="w-64 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm"
                    />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls + ' w-auto'}>
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={selectCls + ' w-auto'}>
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                    <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className={selectCls + ' w-auto'}>
                        <option value="">All Sections</option>
                        {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                    {(search || statusFilter || yearFilter || sectionFilter) && (
                        <button
                            onClick={() => { setSearch(''); setStatusFilter(''); setYearFilter(''); setSectionFilter(''); }}
                            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold text-muted-foreground hover:text-rose-600 transition-colors"
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {can('student.create') && (
                        <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:bg-muted/50 rounded-xl font-bold text-sm text-foreground transition-colors shadow-sm">
                            <Upload size={15} className="text-indigo-600" /> Bulk Import
                        </button>
                    )}
                    <button onClick={() => exportCSV(false)} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:bg-muted/50 rounded-xl font-bold text-sm text-foreground transition-colors shadow-sm">
                        <Download size={15} className="text-indigo-600" /> Export CSV
                    </button>
                    {can('student.create') && (
                        <button onClick={() => { setCreateForm(emptyForm()); setCreateResult(null); setShowCreate(true); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
                            <Plus size={16} /> Add Student
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk actions bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3">
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mr-1">{selected.size} selected</span>
                    <button onClick={() => setBulkAssign({ field: 'section', value: '' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors">
                        <Layers size={12} /> Assign Section
                    </button>
                    <button onClick={() => setBulkAssign({ field: 'batch', value: '' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors">
                        <UsersIcon size={12} /> Assign Batch
                    </button>
                    <button onClick={() => handleBulkStatus(true)} disabled={bulkStatus} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors">
                        <Check size={12} /> Activate
                    </button>
                    <button onClick={() => handleBulkStatus(false)} disabled={bulkStatus} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors">
                        <Power size={12} /> Suspend
                    </button>
                    <button onClick={() => exportCSV(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-colors">
                        <Download size={12} /> Export Selected
                    </button>
                    <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors">
                        <Trash2 size={12} /> Delete
                    </button>
                </div>
            )}

            {/* Table */}
            <DataTable
                loading={loading}
                columns={['', 'Student', 'Email', 'Cohort', 'Status', 'Created', '']}
                emptyMessage={search || statusFilter || yearFilter || sectionFilter ? 'No students match the current filters' : 'No students yet — add your first student or import a CSV'}
            >
                {list.map(s => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3">
                            <UserCell
                                name={
                                    <Link to={`/admin/users/${s.id}`} className="font-bold text-foreground hover:text-indigo-600 transition-colors">
                                        {s.name}
                                    </Link>
                                }
                                subtitle={`${s.rollNo ? s.rollNo + ' · ' : ''}ID ${shortId(s.id)}`}
                                avatar={s.avatar}
                            />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{s.email}</td>
                        <td className="px-4 py-3"><CohortChips s={s} /></td>
                        <td className="px-4 py-3"><StatusBadge active={s.active} /></td>
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{fmtDate(s.createdAt)}</td>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                                <Link to={`/admin/users/${s.id}`} title="View profile" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-indigo-600 transition-colors">
                                    <Eye size={15} />
                                </Link>
                                <button onClick={() => openEdit(s)} title="Edit student" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-indigo-600 transition-colors">
                                    <Pencil size={15} />
                                </button>
                                <button onClick={() => openMove(s)} title="Move section/batch" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-cyan-600 transition-colors">
                                    <Layers size={15} />
                                </button>
                                <button onClick={() => handleReset(s)} disabled={resetting} title="Reset password" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-600 transition-colors">
                                    <RotateCcw size={15} />
                                </button>
                                <button onClick={() => handleToggle(s)} disabled={togglingId === s.id} title={s.active ? 'Suspend' : 'Activate'} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-colors">
                                    <Power size={15} />
                                </button>
                                <button onClick={() => setDeletingStudent(s)} title="Delete student" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-600 transition-colors">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </DataTable>

            {/* ── Add Student Modal ──────────────────────────────────────────── */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2"><GraduationCap size={20} className="text-indigo-600" /> Add Student</h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        {!createResult ? (
                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div>
                                    <label className={labelCls}>Full Name *</label>
                                    <input className={inputCls} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Email *</label>
                                        <input type="email" className={inputCls} value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@college.edu" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Roll Number *</label>
                                        <input className={inputCls} value={createForm.rollNo} onChange={e => setCreateForm(f => ({ ...f, rollNo: e.target.value }))} placeholder="CS22001" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Phone</label>
                                    <input className={inputCls} value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className={labelCls}>Year</label>
                                        <select className={selectCls} value={createForm.year} onChange={e => setCreateForm(f => ({ ...f, year: e.target.value }))}>
                                            <option value="">—</option>
                                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Sem</label>
                                        <select className={selectCls} value={createForm.semester} onChange={e => setCreateForm(f => ({ ...f, semester: e.target.value }))}>
                                            <option value="">—</option>
                                            {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Section</label>
                                        <input className={inputCls} maxLength={2} value={createForm.section} onChange={e => setCreateForm(f => ({ ...f, section: e.target.value }))} placeholder="A" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Batch</label>
                                        <input className={inputCls} value={createForm.batch} onChange={e => setCreateForm(f => ({ ...f, batch: e.target.value }))} placeholder="2024-28" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Password (blank = auto-generate)</label>
                                    <input type="password" className={inputCls} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Leave blank to generate a temp password" />
                                </div>
                                <button type="submit" disabled={creating} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Student
                                </button>
                            </form>
                        ) : (
                            <div className="p-6 text-center space-y-4">
                                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center"><Check size={26} className="text-emerald-600" /></div>
                                <p className="text-sm font-bold text-foreground">{createResult.user.name} created in {deptName || 'your department'}</p>
                                <div className="bg-muted/40 rounded-xl p-4 text-sm">
                                    <p className="font-bold text-foreground mb-1">Login: {createResult.user.email}</p>
                                    <p className="font-bold text-foreground">Temporary password: <span className="text-indigo-600 font-black">{createResult.tempPassword}</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl font-bold text-sm text-foreground transition-colors">Done</button>
                                    <button onClick={() => { setCreateResult(null); setCreateForm(emptyForm()); }} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Add Another</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Edit Modal ─────────────────────────────────────────────────── */}
            {editingStudent && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2"><Pencil size={18} className="text-indigo-600" /> Edit Student</h3>
                            <button onClick={() => setEditingStudent(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Full Name *</label>
                                    <input className={inputCls} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className={labelCls}>Roll Number</label>
                                    <input className={inputCls} value={editForm.rollNo} onChange={e => setEditForm(f => ({ ...f, rollNo: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Email *</label>
                                <input type="email" className={inputCls} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input className={inputCls} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelCls}>Year</label>
                                    <select className={selectCls} value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}>
                                        <option value="">—</option>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Sem</label>
                                    <select className={selectCls} value={editForm.semester} onChange={e => setEditForm(f => ({ ...f, semester: e.target.value }))}>
                                        <option value="">—</option>
                                        {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Section</label>
                                    <input className={inputCls} maxLength={2} value={editForm.section} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))} />
                                </div>
                                <div>
                                    <label className={labelCls}>Batch</label>
                                    <input className={inputCls} value={editForm.batch} onChange={e => setEditForm(f => ({ ...f, batch: e.target.value }))} />
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-colors">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Move Modal (section/batch within dept) ─────────────────────── */}
            {movingStudent && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2"><Layers size={18} className="text-cyan-600" /> Move {movingStudent.name}</h3>
                            <button onClick={() => setMovingStudent(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleMove} className="p-6 space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">Change this student's year / semester / section / batch within {deptName || 'the department'}.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelCls}>Year</label>
                                    <select className={selectCls} value={moveForm.year} onChange={e => setMoveForm(f => ({ ...f, year: e.target.value }))}>
                                        <option value="">—</option>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Sem</label>
                                    <select className={selectCls} value={moveForm.semester} onChange={e => setMoveForm(f => ({ ...f, semester: e.target.value }))}>
                                        <option value="">—</option>
                                        {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Section</label>
                                    <input className={inputCls} maxLength={2} value={moveForm.section} onChange={e => setMoveForm(f => ({ ...f, section: e.target.value }))} />
                                </div>
                                <div>
                                    <label className={labelCls}>Batch</label>
                                    <input className={inputCls} value={moveForm.batch} onChange={e => setMoveForm(f => ({ ...f, batch: e.target.value }))} />
                                </div>
                            </div>
                            <button type="submit" disabled={moving} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-colors">
                                {moving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Move Student
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Bulk Assign Modal ──────────────────────────────────────────── */}
            {bulkAssign && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Layers size={18} className="text-indigo-600" /> Assign {bulkAssign.field === 'section' ? 'Section' : 'Batch'}
                            </h3>
                            <button onClick={() => setBulkAssign(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">
                                Apply to <b className="text-foreground">{selected.size}</b> selected student{selected.size === 1 ? '' : 's'}.
                            </p>
                            <div>
                                <label className={labelCls}>{bulkAssign.field === 'section' ? 'Section' : 'Batch'} *</label>
                                {bulkAssign.field === 'section' ? (
                                    <select className={selectCls} value={bulkAssign.value} onChange={e => setBulkAssign(b => ({ ...b, value: e.target.value }))}>
                                        <option value="">Select…</option>
                                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                        {!sections.includes('A') && <option value="A">A</option>}
                                        {!sections.includes('B') && <option value="B">B</option>}
                                        {!sections.includes('C') && <option value="C">C</option>}
                                    </select>
                                ) : (
                                    <input className={inputCls} value={bulkAssign.value} onChange={e => setBulkAssign(b => ({ ...b, value: e.target.value }))} placeholder="e.g. 2024-28" />
                                )}
                            </div>
                            <button onClick={handleBulkAssign} disabled={assigning || !bulkAssign.value} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-colors">
                                {assigning ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Password Result ──────────────────────────────────────── */}
            {resetResult && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center"><RotateCcw size={24} className="text-amber-600" /></div>
                        <p className="text-sm font-bold text-foreground">Password reset for {resetResult.name}</p>
                        <div className="bg-muted/40 rounded-xl p-4 text-sm">
                            <p className="font-bold text-foreground">Temporary password: <span className="text-amber-600 font-black">{resetResult.tempPassword}</span></p>
                        </div>
                        <button onClick={() => setResetResult(null)} className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Done</button>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation ────────────────────────────────────────── */}
            {deletingStudent && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 flex items-center justify-center"><Trash2 size={24} className="text-rose-600" /></div>
                        <p className="font-bold text-foreground">Delete {deletingStudent.name}?</p>
                        <p className="text-sm font-medium text-muted-foreground">This permanently deletes the student and all their enrollments. This cannot be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeletingStudent(null)} className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl font-bold text-sm text-foreground transition-colors">Cancel</button>
                            <button onClick={handleDelete} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors">
                                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Import Modal ───────────────────────────────────────────────── */}
            {showImport && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2"><Upload size={18} className="text-indigo-600" /> Bulk Import Students</h3>
                            <button onClick={() => { setShowImport(false); setImportResults(null); setImportFile(null); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {!importResults ? (
                                <>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Upload a CSV or Excel file. Required columns: <b className="text-foreground">name</b>, <b className="text-foreground">email</b>, <b className="text-foreground">roll_no</b>.
                                        Optional: phone, year, semester, section, batch. Students are added to <b className="text-foreground">{deptName || 'your department'}</b>.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 border-2 border-dashed border-border hover:border-indigo-400 hover:bg-indigo-50/50 rounded-2xl px-4 py-6 text-center transition-colors cursor-pointer"
                                        >
                                            {importFile ? (
                                                <p className="text-sm font-bold text-indigo-600 truncate">{importFile.name}</p>
                                            ) : (
                                                <>
                                                    <Upload size={20} className="mx-auto mb-2 text-muted-foreground" />
                                                    <p className="text-sm font-bold text-foreground">Choose file</p>
                                                    <p className="text-xs font-medium text-muted-foreground mt-1">CSV or Excel (.xlsx) · max 500 rows</p>
                                                </>
                                            )}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            className="hidden"
                                            onChange={e => setImportFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <a
                                            href="#"
                                            onClick={async (e) => { e.preventDefault(); try { await usersAPI.downloadStudentTemplate(); } catch { toast.error('Template download failed'); } }}
                                            className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                                        >
                                            Download sample template
                                        </a>
                                        <button onClick={handleImport} disabled={importing || !importFile} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
                                            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${importResults.created > 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                        {importResults.created > 0 ? <Check size={26} className="text-emerald-600" /> : <X size={26} className="text-rose-600" />}
                                    </div>
                                    <p className="text-sm font-bold text-foreground">{importResults.created} created · {importResults.failed} failed</p>
                                    <p className="text-sm font-medium text-muted-foreground">Imported into: <b className="text-indigo-600">{importResults.departmentName || deptName}</b></p>
                                    {importResults.created > 0 && (
                                        <button onClick={() => downloadPasswords(importResults.results, 'Student')} className="text-indigo-600 hover:text-indigo-700 text-sm font-bold">
                                            Download temp passwords (CSV)
                                        </button>
                                    )}
                                    <div className="max-h-40 overflow-y-auto bg-muted/40 rounded-xl divide-y divide-border text-left">
                                        {(importResults.results || []).filter(r => r.status === 'error').slice(0, 20).map((r, i) => (
                                            <p key={i} className="px-4 py-2 text-xs font-medium text-rose-600">
                                                {r.email || r.name}: {r.error}
                                            </p>
                                        ))}
                                    </div>
                                    <button onClick={() => { setShowImport(false); setImportResults(null); setImportFile(null); }} className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Done</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ShieldLockIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
