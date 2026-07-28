import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Building2, Users, BookOpen, DollarSign, Star, GraduationCap,
    ShieldCheck, Search, ArrowRight, Plus, X, Edit2, Trash2,
    Activity, AlertTriangle, Layers, Gauge
} from 'lucide-react';
import { statsAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

// ─── Department Card ───────────────────────────────────────────────────────────
function DepartmentCard({ dept, rank, onEdit, onDelete }) {
    const metrics = [
        { icon: Users, label: 'Students', value: dept.studentCount, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { icon: GraduationCap, label: 'Instructors', value: dept.instructorCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { icon: ShieldCheck, label: 'Admins', value: dept.adminCount, color: 'text-amber-600', bg: 'bg-amber-50' },
        { icon: BookOpen, label: 'Courses', value: dept.coursePublished, color: 'text-cyan-600', bg: 'bg-cyan-50' },
        { icon: Layers, label: 'Categories', value: dept.categoryCount || dept.category_count || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
        { icon: Gauge, label: 'Student Limit', value: dept.maxStudentsOverride ?? 'Default', color: 'text-cyan-600', bg: 'bg-cyan-50' },
        { icon: Gauge, label: 'Course Limit', value: dept.maxCoursesOverride ?? 'Default', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    ];

    return (
        <div className="relative group bg-card border-2 border-border rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-300">
            {/* Ranking badge */}
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-md z-10">
                #{rank}
            </div>

            {/* Edit button - top left, hidden until hover */}
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(dept); }}
                className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-card border-2 border-border opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:border-indigo-200 text-muted-foreground hover:text-indigo-600 flex items-center justify-center shadow-md transition-all duration-200 z-10"
                title="Edit department"
            >
                <Edit2 size={14} />
            </button>

            {/* Delete button - top middle, hidden until hover */}
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(dept); }}
                className="absolute -top-2 left-8 w-8 h-8 rounded-full bg-card border-2 border-border opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 text-muted-foreground hover:text-red-600 flex items-center justify-center shadow-md transition-all duration-200 z-10"
                title="Delete department"
            >
                <Trash2 size={14} />
            </button>

            <Link
                to={`/super-admin/departments/${dept.id}`}
                className="block"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-sm border border-white/20">
                        {dept.icon || '🏛️'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-foreground text-lg truncate group-hover:text-indigo-600 transition-colors">{dept.name}</h3>
                        <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                            Department Overview
                        </p>
                    </div>
                    <ArrowRight size={20} className="text-muted-foreground/30 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {metrics.map(m => (
                    <div key={m.label} className={`${m.bg} rounded-xl p-3 border border-white/50`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <m.icon size={14} className={m.color} />
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                                {m.label}
                            </span>
                        </div>
                        <p className={`text-xl font-black ${m.color}`}>{m.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Bottom revenue & rating row */}
            <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-500" />
                    <span className="text-sm font-bold text-foreground/80">
                        ₹{(dept.totalRevenue || 0) >= 100000
                            ? `${(dept.totalRevenue / 100000).toFixed(1)}L`
                            : (dept.totalRevenue || 0).toLocaleString()}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Star size={14} className="text-amber-400" fill="currentColor" />
                    <span className="text-sm font-bold text-foreground/80">
                        {dept.avgRating ? dept.avgRating.toFixed(1) : '—'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Activity size={14} className="text-cyan-500" />
                    <span className="text-sm font-bold text-foreground/80">
                        {(dept.totalEnrollments || 0).toLocaleString()} enrolled
                    </span>
                </div>
                </div>
            </Link>
        </div>
    );
}

// ─── Main Department Overview Page ─────────────────────────────────────────────
export default function DepartmentOverview() {
    const { data: departments, loading, reload } = useAsyncData(() => statsAPI.getDepartments(), []);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', icon: '' });
    const [creating, setCreating] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', icon: '', maxStudents: '', maxCourses: '' });
    const [saving, setSaving] = useState(false);
    const [deletingDept, setDeletingDept] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name.trim()) {
            toast.error('Department name is required');
            return;
        }
        setCreating(true);
        try {
            await departmentsAPI.create(createForm);
            toast.success(`Department "${createForm.name.trim()}" created`);
            setShowCreate(false);
            setCreateForm({ name: '', icon: '' });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create department');
        } finally {
            setCreating(false);
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim()) {
            toast.error('Department name is required');
            return;
        }
        setSaving(true);
        try {
            await departmentsAPI.update(editingDept.id, { name: editForm.name, icon: editForm.icon });
            // Also save limits if provided
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
        } finally {
            setSaving(false);
        }
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
        } finally {
            setDeleting(false);
        }
    };

    const openEdit = (dept) => {
        setEditForm({
            name: dept.name || '',
            icon: dept.icon || '',
            maxStudents: dept.maxStudentsOverride ?? '',
            maxCourses: dept.maxCoursesOverride ?? '',
        });
        setEditingDept(dept);
    };

    const openDelete = (dept) => {
        setDeletingDept(dept);
    };

    const filtered = useMemo(() => {
        if (!departments) return [];
        return departments.filter(d =>
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [departments, searchTerm]);

    const totals = useMemo(() => {
        if (!departments) return { students: 0, instructors: 0, admins: 0, courses: 0, revenue: 0, enrollments: 0 };
        return departments.reduce((acc, d) => ({
            students: acc.students + (d.studentCount || 0),
            instructors: acc.instructors + (d.instructorCount || 0),
            admins: acc.admins + (d.adminCount || 0),
            courses: acc.courses + (d.coursePublished || 0),
            revenue: acc.revenue + (d.totalRevenue || 0),
            enrollments: acc.enrollments + (d.totalEnrollments || 0),
        }), { students: 0, instructors: 0, admins: 0, courses: 0, revenue: 0, enrollments: 0 });
    }, [departments]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingContainer height="h-32" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <PageHeader
                title="Department Overview"
                subtitle="View and compare all departments — click a department to see full details"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Create Department
                    </button>
                }
            />

            {/* Global Totals Bar */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Students', value: totals.students.toLocaleString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Instructors', value: totals.instructors.toLocaleString(), icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Admins', value: totals.admins.toLocaleString(), icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Courses', value: totals.courses.toLocaleString(), icon: BookOpen, color: 'text-cyan-600', bg: 'bg-cyan-50' },
                    { label: 'Revenue', value: totals.revenue >= 100000 ? `₹${(totals.revenue / 100000).toFixed(1)}L` : `₹${totals.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Enrollments', value: totals.enrollments.toLocaleString(), icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50' },
                ].map(item => (
                    <div key={item.label} className={`${item.bg} border border-border rounded-xl p-4 shadow-sm`}>
                        <div className="flex items-center gap-2 mb-1">
                            <item.icon size={14} className={item.color} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">{item.label}</span>
                        </div>
                        <p className={`text-lg font-black ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search departments..."
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
            </div>

            {/* Department Cards Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((dept, i) => (
                    <DepartmentCard
                        key={dept.id}
                        dept={dept}
                        rank={i + 1}
                        onEdit={openEdit}
                        onDelete={openDelete}
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-full py-16 text-center">
                        <Building2 size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No departments found</h3>
                        <p className="text-muted-foreground text-sm">Try adjusting your search</p>
                    </div>
                )}
            </div>

            {/* Edit Department Modal */}
            {editingDept && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Edit2 size={20} className="text-indigo-600" /> Edit Department
                            </h3>
                            <button onClick={() => setEditingDept(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Department Name *</label>
                                <div className="relative">
                                    <Building2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Computer Science"
                                        value={editForm.name}
                                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Icon (emoji)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">
                                        {editForm.icon || '🏛️'}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="🏛️"
                                        maxLength={2}
                                        value={editForm.icon}
                                        onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 font-medium ml-1">Update the emoji icon for this department.</p>
                            </div>
                            <div className="border-t border-border pt-5 mt-5">
                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                    <Gauge size={14} className="text-cyan-500" /> Student & Course Limits
                                </h4>
                                <p className="text-[11px] text-muted-foreground/70 font-medium mb-4">
                                    Set maximum students and courses for this department. All admins in this department share these limits.
                                    Leave blank to inherit the platform default.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Max Students</label>
                                        <input
                                            type="number" min="0"
                                            placeholder="Default"
                                            value={editForm.maxStudents}
                                            onChange={e => setEditForm(f => ({ ...f, maxStudents: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Max Courses</label>
                                        <input
                                            type="number" min="0"
                                            placeholder="Default"
                                            value={editForm.maxCourses}
                                            onChange={e => setEditForm(f => ({ ...f, maxCourses: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingDept(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Department Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Building2 size={20} className="text-indigo-600" /> Create Department
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Department Name *</label>
                                <div className="relative">
                                    <Building2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Computer Science"
                                        value={createForm.name}
                                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Icon (emoji)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">
                                        {createForm.icon || '🏛️'}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="🏛️"
                                        maxLength={2}
                                        value={createForm.icon}
                                        onChange={e => setCreateForm(f => ({ ...f, icon: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 font-medium ml-1">Pick an emoji icon for this department (e.g. 💻, 📊, 🎨). Defaults to 🏛️.</p>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]"
                                >
                                    {creating ? 'Creating...' : 'Create Department'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingDept && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-sm border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle size={32} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-foreground tracking-tight mb-1">
                                    Delete Department?
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Are you sure you want to delete <strong className="text-foreground">{deletingDept.name}</strong>?
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-2">
                                    Categories and admins assigned to this department will become unassigned (global). This action cannot be undone.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeletingDept(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
