import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Building2, Users, BookOpen, Star, GraduationCap,
    ShieldCheck, Search, Plus, X, Edit2, Trash2,
    Activity, ArrowRight, ChevronRight, Layers
} from 'lucide-react';
import { statsAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

// ─── Metric Badge ──────────────────────────────────────────────────────
function MetricBadge({ icon: Icon, label, value, color, bgColor }) {
    return (
        <div className={`${bgColor} rounded-xl px-3 py-2.5 border border-white/60 flex items-center gap-2.5`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('400', '100')}`}>
                <Icon size={14} className={color} />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 leading-none">{label}</p>
                <p className={`text-base font-black ${color} mt-0.5`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
        </div>
    );
}

// ─── Department Card ───────────────────────────────────────────────────
function DepartmentCard({ dept, onEdit, onDelete }) {
    const bgGradient = [
        'from-indigo-500 to-violet-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-cyan-500 to-blue-600',
        'from-rose-500 to-pink-600',
        'from-fuchsia-500 to-purple-600',
        'from-teal-500 to-cyan-600',
        'from-violet-500 to-indigo-600',
    ];
    const gradient = bgGradient[Math.abs(dept.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % bgGradient.length)];

    return (
        <div className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            {/* Gradient header */}
            <div className={`h-2 bg-gradient-to-r ${gradient}`} />

            <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl shadow-md`}>
                            {dept.icon || '🏛️'}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-extrabold text-foreground text-[15px] truncate group-hover:text-indigo-600 transition-colors">{dept.name}</h3>
                            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                                {dept.categoryCount || dept.category_count || 0} categories · {dept.coursePublished || 0} courses
                            </p>
                        </div>
                    </div>
                    <Link
                        to={`/super-admin/departments/${dept.id}`}
                        className="w-8 h-8 rounded-full bg-muted hover:bg-indigo-50 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-indigo-600 transition-colors" />
                    </Link>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <MetricBadge icon={Users} label="Students" value={dept.studentCount} color="text-indigo-600" bgColor="bg-indigo-50" />
                    <MetricBadge icon={GraduationCap} label="Instructors" value={dept.instructorCount} color="text-emerald-600" bgColor="bg-emerald-50" />
                    <MetricBadge icon={ShieldCheck} label="Admins" value={dept.adminCount} color="text-amber-600" bgColor="bg-amber-50" />
                    <MetricBadge icon={BookOpen} label="Courses" value={dept.coursePublished} color="text-cyan-600" bgColor="bg-cyan-50" />
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <div className="flex items-center gap-2">
                        <Star size={12} className="text-amber-400" fill="currentColor" />
                        <span className="text-sm font-bold text-foreground/80">
                            {dept.avgRating ? dept.avgRating.toFixed(1) : '—'}
                        </span>
                        <span className="text-[11px] text-muted-foreground/50">rating</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Activity size={12} className="text-emerald-500" />
                        <span className="text-sm font-bold text-foreground/80">
                            {dept.totalEnrollments ? dept.totalEnrollments.toLocaleString() : '0'}
                        </span>
                        <span className="text-[11px] text-muted-foreground/50">enrolled</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Department Overview Page ─────────────────────────────────────
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
        if (!createForm.name.trim()) { toast.error('Department name is required'); return; }
        setCreating(true);
        try {
            await departmentsAPI.create(createForm);
            toast.success(`Department "${createForm.name.trim()}" created`);
            setShowCreate(false);
            setCreateForm({ name: '', icon: '' });
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
            await departmentsAPI.update(editingDept.id, { name: editForm.name, icon: editForm.icon });
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
        setEditForm({ name: dept.name || '', icon: dept.icon || '', maxStudents: dept.maxStudentsOverride ?? '', maxCourses: dept.maxCoursesOverride ?? '' });
        setEditingDept(dept);
    };

    const openDelete = (dept) => setDeletingDept(dept);

    const filtered = useMemo(() => {
        if (!departments) return [];
        return departments.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [departments, searchTerm]);

    const totals = useMemo(() => {
        if (!departments) return { students: 0, instructors: 0, admins: 0, courses: 0, enrollments: 0 };
        return departments.reduce((acc, d) => ({
            students: acc.students + (d.studentCount || 0),
            instructors: acc.instructors + (d.instructorCount || 0),
            admins: acc.admins + (d.adminCount || 0),
            courses: acc.courses + (d.coursePublished || 0),
            enrollments: acc.enrollments + (d.totalEnrollments || 0),
        }), { students: 0, instructors: 0, admins: 0, courses: 0, enrollments: 0 });
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
                title="Departments"
                subtitle="Manage departments — each groups courses, categories, and admins together"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        <Plus size={16} /> New Department
                    </button>
                }
            />

            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Students', value: totals.students.toLocaleString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200/50' },
                    { label: 'Instructors', value: totals.instructors.toLocaleString(), icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200/50' },
                    { label: 'Admins', value: totals.admins.toLocaleString(), icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200/50' },
                    { label: 'Courses', value: totals.courses.toLocaleString(), icon: BookOpen, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200/50' },
                    { label: 'Enrollments', value: totals.enrollments.toLocaleString(), icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200/50' },
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
                    placeholder="Search departments..."
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                />
            </div>

            {/* Department Cards */}
            {filtered.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(dept => (
                        <DepartmentCard key={dept.id} dept={dept} onEdit={openEdit} onDelete={openDelete} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
                    <Building2 size={48} className="text-muted-foreground/15 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-1">No departments found</h3>
                    <p className="text-muted-foreground text-sm">Create your first department to get started</p>
                </div>
            )}

            {/* Edit Modal */}
            {editingDept && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setEditingDept(null)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Edit2 size={18} className="text-indigo-600" /> Edit Department
                            </h3>
                            <button onClick={() => setEditingDept(null)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Department Name *</label>
                                <div className="relative">
                                    <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                    <input required type="text" placeholder="e.g. Computer Science" value={editForm.name}
                                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3.5 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Icon Emoji</label>
                                <input type="text" placeholder="🏛️" maxLength={2} value={editForm.icon}
                                    onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                                    className="w-full px-4 py-3.5 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm text-center" />
                            </div>
                            <div className="border-t border-border pt-6">
                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
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

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Building2 size={18} className="text-indigo-600" /> Create Department
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Department Name *</label>
                                <div className="relative">
                                    <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                                    <input required type="text" placeholder="e.g. Computer Science" value={createForm.name}
                                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3.5 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Icon Emoji</label>
                                <input type="text" placeholder="🏛️" maxLength={2} value={createForm.icon}
                                    onChange={e => setCreateForm(f => ({ ...f, icon: e.target.value }))}
                                    className="w-full px-4 py-3.5 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm text-center" />
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
                                <p className="text-[11px] text-muted-foreground/50 mt-2">Categories and admins will become unassigned. This cannot be undone.</p>
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