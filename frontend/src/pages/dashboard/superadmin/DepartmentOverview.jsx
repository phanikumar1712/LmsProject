import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Building2, Users, BookOpen, GraduationCap, ShieldCheck, Search, Plus,
    X, Edit2, Trash2, Eye, Power, Hash, Mail, Phone, User, Activity, Clock, Layers, Star, TrendingUp
} from 'lucide-react';
import { statsAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DataTable } from '../../../components/ui/DataTable';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

function StatusBadge({ active }) {
    return active !== false ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
        </span>
    );
}

const inputCls = 'w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium';
const labelCls = 'text-xs font-black uppercase tracking-wider text-muted-foreground ml-1';
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Main Department Overview Page ────────────────────────────────────────────
export default function DepartmentOverview() {
    const { data: departments, loading, reload } = useAsyncData(() => statsAPI.getDepartments(), []);
    const [searchTerm, setSearchTerm] = useState('');

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '', code: '', description: '', hod: '', contactEmail: '', contactNumber: '', icon: '', active: true,
    });
    const [creating, setCreating] = useState(false);

    // Edit modal
    const [editingDept, setEditingDept] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '', code: '', description: '', hod: '', contactEmail: '', contactNumber: '', icon: '', active: true,
        maxStudents: '', maxCourses: '',
    });
    const [saving, setSaving] = useState(false);

    // Delete + status toggle
    const [deletingDept, setDeletingDept] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    const emptyForm = () => ({
        name: '', code: '', description: '', hod: '', contactEmail: '', contactNumber: '', icon: '', active: true,
    });

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name.trim()) { toast.error('Department name is required'); return; }
        setCreating(true);
        try {
            await departmentsAPI.create(createForm);
            toast.success(`Department "${createForm.name.trim()}" created`);
            setShowCreate(false);
            setCreateForm(emptyForm());
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create department');
        } finally { setCreating(false); }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim()) { toast.error('Department name is required'); return; }
        setSaving(true);
        try {
            await departmentsAPI.update(editingDept.id, {
                name: editForm.name,
                code: editForm.code,
                description: editForm.description,
                hod: editForm.hod,
                contactEmail: editForm.contactEmail,
                contactNumber: editForm.contactNumber,
                icon: editForm.icon,
                active: editForm.active,
            });
            if (editForm.maxStudents !== '' || editForm.maxCourses !== '') {
                await departmentsAPI.updateLimits(editingDept.id, {
                    maxStudents: editForm.maxStudents === '' ? null : Number(editForm.maxStudents),
                    maxCourses: editForm.maxCourses === '' ? null : Number(editForm.maxCourses),
                });
            }
            toast.success(`Department "${editForm.name.trim()}" updated`);
            setEditingDept(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update department');
        } finally { setSaving(false); }
    };

    const handleToggleStatus = async (dept) => {
        const next = dept.active === false;
        setTogglingId(dept.id);
        try {
            await departmentsAPI.updateStatus(dept.id, next);
            toast.success(`Department "${dept.name}" ${next ? 'activated' : 'deactivated'}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally { setTogglingId(null); }
    };

    const handleDelete = async () => {
        if (!deletingDept) return;
        setDeleting(true);
        try {
            await departmentsAPI.delete(deletingDept.id);
            toast.success(`Department "${deletingDept.name}" deleted`);
            setDeletingDept(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete department');
        } finally { setDeleting(false); }
    };

    const openEdit = (dept) => {
        setEditForm({
            name: dept.name || '',
            code: dept.code || '',
            description: dept.description || '',
            hod: dept.hod || '',
            contactEmail: dept.contactEmail || '',
            contactNumber: dept.contactNumber || '',
            icon: dept.icon || '',
            active: dept.active !== false,
            maxStudents: dept.maxStudentsOverride ?? '',
            maxCourses: dept.maxCoursesOverride ?? '',
        });
        setEditingDept(dept);
    };

    const openDelete = (dept) => setDeletingDept(dept);

    const filtered = useMemo(() => {
        if (!departments) return [];
        const q = searchTerm.trim().toLowerCase();
        if (!q) return departments;
        return departments.filter(d =>
            (d.name || '').toLowerCase().includes(q) ||
            (d.code || '').toLowerCase().includes(q) ||
            (d.hod || '').toLowerCase().includes(q) ||
            (d.contactEmail || '').toLowerCase().includes(q)
        );
    }, [departments, searchTerm]);

    const totals = useMemo(() => {
        if (!departments) return { students: 0, instructors: 0, admins: 0, courses: 0, enrollments: 0, avgRating: '—' };
        const t = departments.reduce((acc, d) => ({
            students: acc.students + (d.studentCount || 0),
            instructors: acc.instructors + (d.instructorCount || 0),
            admins: acc.admins + (d.adminCount || 0),
            courses: acc.courses + (d.courseTotal || 0),
            enrollments: acc.enrollments + (d.totalEnrollments || 0),
            ratingSum: acc.ratingSum + (d.avgRating || 0),
            ratingCount: acc.ratingCount + (d.avgRating ? 1 : 0),
        }), { students: 0, instructors: 0, admins: 0, courses: 0, enrollments: 0, ratingSum: 0, ratingCount: 0 });
        t.avgRating = t.ratingCount > 0 ? (t.ratingSum / t.ratingCount).toFixed(1) : '—';
        return t;
    }, [departments]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingContainer height="h-32" />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto px-0 pb-12">
            <PageHeader
                title="Departments"
                subtitle="Manage departments — full CRUD for codes, HOD, contacts, and status"
                action={
                    <button
                        onClick={() => { setCreateForm(emptyForm()); setShowCreate(true); }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        <Plus size={16} /> Create Department
                    </button>
                }
            />

            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Students', value: totals.students.toLocaleString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200/50' },
                    { label: 'Instructors', value: totals.instructors.toLocaleString(), icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200/50' },
                    { label: 'Admins', value: totals.admins.toLocaleString(), icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200/50' },
                    { label: 'Courses', value: totals.courses.toLocaleString(), icon: BookOpen, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200/50' },
                    { label: 'Enrollments', value: totals.enrollments.toLocaleString(), icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200/50' },
                    { label: 'Avg Rating', value: totals.avgRating, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200/50' },
                ].map(item => (
                    <div key={item.label} className={`${item.bg} border ${item.border} rounded-2xl p-4 shadow-sm`}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <item.icon size={13} className={item.color} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{item.label}</span>
                        </div>
                        <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by name, code, HOD, email..."
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                />
            </div>

            {/* Departments Table */}
            <DataTable
                columns={['ID', 'Department', 'Code', 'HOD', 'Students', 'Instructors', 'Courses', 'Enrollments', 'Rating', 'Assigned Admin', 'Status', 'Created', 'Actions']}
                loading={false}
                empty={filtered.length === 0}
                emptyText="No departments found. Create your first department to get started."
            >
                {filtered.map(dept => {
                    const admins = (dept.assignedAdmins || '').split(', ').filter(Boolean);
                    return (
                        <tr key={dept.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                <span className="font-mono text-[11px] font-bold text-muted-foreground/70" title={dept.id}>
                                    #{shortId(dept.id)}
                                </span>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-base shadow-sm flex-shrink-0">
                                        {dept.icon || '🏛️'}
                                    </div>
                                    <div className="min-w-0">
                                        <Link
                                            to={`/super-admin/departments/${dept.id}`}
                                            className="font-bold text-foreground truncate block group-hover:text-indigo-600 transition-colors"
                                            title="View department"
                                        >
                                            {dept.name}
                                        </Link>
                                        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                                            {dept.categoryCount || 0} categories
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                {dept.code ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] font-black tracking-wide">
                                        <Hash size={10} /> {dept.code}
                                    </span>
                                ) : '—'}
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                                    <User size={13} className="text-muted-foreground/50" />
                                    {dept.hod || '—'}
                                </span>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4 font-bold text-foreground">{dept.studentCount?.toLocaleString() || 0}</td>
                            <td className="px-3 sm:px-4 md:px-6 py-4 font-bold text-foreground">{dept.instructorCount?.toLocaleString() || 0}</td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                <span className="font-bold text-foreground">{dept.courseTotal || 0}</span>
                                <span className="text-[10px] font-bold text-muted-foreground/50 ml-1">({dept.coursePublished || 0} pub)</span>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                {admins.length > 0 ? (
                                    <span className="inline-flex flex-wrap gap-1" title={admins.join(', ')}>
                                        {admins.slice(0, 2).map((a, i) => (
                                            <span key={i} className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-black uppercase tracking-tighter">
                                                {a}
                                            </span>
                                        ))}
                                        {admins.length > 2 && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-black">
                                                +{admins.length - 2}
                                            </span>
                                        )}
                                    </span>
                                ) : '—'}
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4"><StatusBadge active={dept.active} /></td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                    <Clock size={12} className="opacity-50" /> {fmtDate(dept.createdAt)}
                                </span>
                            </td>
                            <td className="px-3 sm:px-4 md:px-6 py-4">
                                <div className="flex items-center justify-end gap-1">
                                    <Link
                                        to={`/super-admin/departments/${dept.id}`}
                                        title="View"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                                    >
                                        <Eye size={15} />
                                    </Link>
                                    <button
                                        onClick={() => openEdit(dept)}
                                        title="Edit"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-all"
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(dept)}
                                        disabled={togglingId === dept.id}
                                        title={dept.active === false ? 'Activate' : 'Deactivate'}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${
                                            dept.active === false
                                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                                : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                        }`}
                                    >
                                        {togglingId === dept.id
                                            ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            : <Power size={15} />}
                                    </button>
                                    <button
                                        onClick={() => openDelete(dept)}
                                        title="Delete"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </DataTable>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <div className="bg-card w-full max-w-xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Building2 size={18} className="text-indigo-600" /> Create Department
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Department Name *</label>
                                    <input required type="text" placeholder="e.g. Computer Science and Engineering" value={createForm.name}
                                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Department Code</label>
                                    <input type="text" placeholder="e.g. CSE" maxLength={20} value={createForm.code}
                                        onChange={e => setCreateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Description</label>
                                <textarea rows={2} placeholder="Brief description of the department" value={createForm.description}
                                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>HOD</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input type="text" placeholder="e.g. Dr. Jane Smith" value={createForm.hod}
                                            onChange={e => setCreateForm(f => ({ ...f, hod: e.target.value }))} className={`${inputCls} pl-10`} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Contact Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input type="email" placeholder="hod@college.edu" value={createForm.contactEmail}
                                            onChange={e => setCreateForm(f => ({ ...f, contactEmail: e.target.value }))} className={`${inputCls} pl-10`} />
                                    </div>
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Contact Number</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input type="tel" placeholder="+91 98765 43210" value={createForm.contactNumber}
                                            onChange={e => setCreateForm(f => ({ ...f, contactNumber: e.target.value }))} className={`${inputCls} pl-10`} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Status</label>
                                    <select value={createForm.active ? 'active' : 'inactive'}
                                        onChange={e => setCreateForm(f => ({ ...f, active: e.target.value === 'active' }))} className={selectCls}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Icon Emoji</label>
                                <input type="text" placeholder="🏛️" maxLength={2} value={createForm.icon}
                                    onChange={e => setCreateForm(f => ({ ...f, icon: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm text-center" />
                                <p className="text-[11px] text-muted-foreground/60 font-medium ml-1">Defaults to 🏛️ if left empty.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={creating}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                    {creating ? 'Creating...' : 'Create Department'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingDept && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setEditingDept(null)}>
                    <div className="bg-card w-full max-w-xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Edit2 size={18} className="text-indigo-600" /> Edit Department
                            </h3>
                            <button onClick={() => setEditingDept(null)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 sm:p-8 space-y-5 overflow-y-auto">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Department Name *</label>
                                    <input required type="text" value={editForm.name}
                                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Department Code</label>
                                    <input type="text" maxLength={20} placeholder="e.g. CSE" value={editForm.code}
                                        onChange={e => setEditForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Description</label>
                                <textarea rows={2} value={editForm.description}
                                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>HOD</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input type="text" value={editForm.hod}
                                            onChange={e => setEditForm(f => ({ ...f, hod: e.target.value }))} className={`${inputCls} pl-10`} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Contact Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input type="email" value={editForm.contactEmail}
                                            onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))} className={`${inputCls} pl-10`} />
                                    </div>
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className={labelCls}>Contact Number</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                        <input type="tel" value={editForm.contactNumber}
                                            onChange={e => setEditForm(f => ({ ...f, contactNumber: e.target.value }))} className={`${inputCls} pl-10`} />
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
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Icon Emoji</label>
                                <input type="text" maxLength={2} value={editForm.icon}
                                    onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm text-center" />
                            </div>
                            <div className="border-t border-border pt-5">
                                <h4 className={labelCls + ' mb-4 flex items-center gap-2'}>
                                    <Layers size={14} className="text-cyan-500" /> Limits
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Max Students</label>
                                        <input type="number" min="0" placeholder="Unlimited" value={editForm.maxStudents}
                                            onChange={e => setEditForm(f => ({ ...f, maxStudents: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl outline-none focus:ring-3 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all text-sm font-medium" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Max Courses</label>
                                        <input type="number" min="0" placeholder="Unlimited" value={editForm.maxCourses}
                                            onChange={e => setEditForm(f => ({ ...f, maxCourses: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-muted/30 border border-border rounded-xl outline-none focus:ring-3 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all text-sm font-medium" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingDept(null)}
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

            {/* Delete Confirmation Modal */}
            {deletingDept && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setDeletingDept(null)}>
                    <div className="bg-card w-full max-w-sm border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold text-foreground tracking-tight">Delete Department?</h3>
                                <p className="text-sm text-muted-foreground mt-1">Are you sure you want to delete <strong className="text-foreground">{deletingDept.name}</strong>?</p>
                                {(deletingDept.studentCount > 0 || deletingDept.instructorCount > 0 || deletingDept.courseTotal > 0) ? (
                                    <p className="text-[11px] text-rose-500/80 mt-2 font-medium">
                                        This department still has {deletingDept.studentCount || 0} students, {deletingDept.instructorCount || 0} instructors, and {deletingDept.courseTotal || 0} courses. Deletion will be blocked until they are moved or removed.
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground/50 mt-2">This cannot be undone.</p>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setDeletingDept(null)}
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
