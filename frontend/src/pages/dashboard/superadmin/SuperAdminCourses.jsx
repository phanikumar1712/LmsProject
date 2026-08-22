import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, Eye, Edit2, CheckCircle2, XCircle, X, Trash2,
    Building2, Users, Clock, Layers, FileText, Rocket, Archive
} from 'lucide-react';
import { coursesAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DataTable } from '../../../components/ui/DataTable';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import RejectCourseModal from '../../../components/ui/RejectCourseModal';
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

function StatusBadge({ status }) {
    const map = {
        PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        DRAFT: 'bg-muted text-muted-foreground',
        REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        ARCHIVED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${map[status] || 'bg-muted text-muted-foreground'}`}>
            {status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
            {status}
        </span>
    );
}

const inputCls = 'w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium';
const labelCls = 'text-xs font-black uppercase tracking-wider text-muted-foreground ml-1';

export default function SuperAdminCourses() {
    const { can } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search);
    const [statusFilter, setStatusFilter] = useState('');
    const [deptFilter, setDeptFilter] = useState('');

    const { data: departments } = useAsyncData(() => departmentsAPI.list(), []);
    const { data: courses, loading, reload } = useAsyncData(
        () => coursesAPI.getAll({
            admin: true,
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
            departmentId: deptFilter || undefined,
            limit: 500,
        }),
        [debouncedSearch, statusFilter, deptFilter]
    );

    const list = Array.isArray(courses) ? courses : [];
    const deptName = (id) => (departments || []).find(d => d.id === id)?.name || null;

    const [editingCourse, setEditingCourse] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const totals = useMemo(() => ({
        total: list.length,
        published: list.filter(c => c.status === 'PUBLISHED').length,
        pending: list.filter(c => c.status === 'PENDING').length,
    }), [list]);

    // ── Workflow actions ─────────────────────────────────────────────────────
    const runAction = async (course, fn, successMsg) => {
        setBusyId(course.id);
        try {
            await fn(course);
            toast.success(successMsg);
            reload();
        } catch (err) {
            toast.error(err.message || 'Action failed');
        } finally {
            setBusyId(null);
        }
    };

    const handleApprove = (course) => runAction(course, () => coursesAPI.approve(course.id), 'Course approved and published!');
    const handlePublish = (course) => runAction(course, () => coursesAPI.publish(course.id), 'Course published!');
    const handleUnpublish = (course) => runAction(course, () => coursesAPI.unpublish(course.id), 'Course unpublished (moved to Draft)');

    // ── Rejection modal state ────────────────────────────────────────────────
    const [rejectTarget, setRejectTarget] = useState(null);

    const handleReject = async (courseId, reason) => {
        await runAction({ id: courseId }, () => coursesAPI.reject(courseId, reason), 'Course rejected. Instructor notified.');
    };

    const handleMoveToDraft = async (courseId, reason) => {
        await runAction({ id: courseId }, () => coursesAPI.update(courseId, { status: 'DRAFT', reviewNote: reason }), 'Course moved to Draft. Instructor notified.');
    };

    const handleDelete = (course) => {
        if (!window.confirm(`Permanently delete "${course.title}"? This cannot be undone.`)) return;
        runAction(course, () => coursesAPI.delete(course.id), 'Course deleted.');
    };

    // ── Edit ─────────────────────────────────────────────────────────────────
    const openEdit = (course) => {
        setEditingCourse(course);
        setEditForm({
            title: course.title || '',
            shortDesc: course.shortDesc || '',
            level: course.level || 'Beginner',
            language: course.language || 'English',
            duration: course.duration || '',
        });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await coursesAPI.update(editingCourse.id, {
                title: editForm.title,
                short_desc: editForm.shortDesc,
                level: editForm.level,
                language: editForm.language,
                duration: editForm.duration,
            });
            toast.success('Course updated');
            setEditingCourse(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update course');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto px-0 pb-12">
            <PageHeader
                title="Course Management"
                subtitle="All courses across every department — review, approve, publish, and moderate"
                action={
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">{totals.published} published</span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40">{totals.pending} pending</span>
                    </div>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by course title or instructor..."
                        className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                    />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="sm:w-48 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground appearance-none cursor-pointer">
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                    <option value="REJECTED">Rejected</option>
                </select>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                    className="sm:w-52 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground appearance-none cursor-pointer">
                    <option value="">All Departments</option>
                    {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {(statusFilter || deptFilter || search) && (
                    <button onClick={() => { setStatusFilter(''); setDeptFilter(''); setSearch(''); }}
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <X size={14} /> Clear
                    </button>
                )}
            </div>

            {/* Course table */}
            <DataTable
                columns={['ID', 'Course', 'Department', 'Instructor', 'Category', 'Students', 'Lessons', 'Status', 'Created', 'Actions']}
                loading={loading}
                empty={list.length === 0}
                emptyText="No courses found. Adjust your filters."
            >
                {list.map(course => (
                    <tr key={course.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="font-mono text-[11px] font-bold text-muted-foreground/70" title={course.id}>#{shortId(course.id)}</span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0 max-w-[260px]">
                                {course.thumbnail ? (
                                    <CourseThumbnail thumbnail={course.thumbnail} title={course.title} className="w-12 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {course.title?.charAt(0)}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Link to={`/courses/${course.id}`} className="font-bold text-foreground truncate block group-hover:text-indigo-600 transition-colors" title="View course">
                                        {course.title}
                                    </Link>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">{course.level} · {course.duration}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            {course.departmentName || deptName(course.departmentId) ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] font-black tracking-wide">
                                    <Building2 size={10} /> {course.departmentName || deptName(course.departmentId)}
                                </span>
                            ) : '—'}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <Link to={`/super-admin/instructors/${course.instructorId}`}
                                className="text-sm font-bold text-foreground/80 hover:text-indigo-600 transition-colors">
                                {course.instructorName}
                            </Link>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                <Layers size={13} className="text-muted-foreground/50 flex-shrink-0" /> {course.categoryName || 'Uncategorized'}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                                <Users size={13} className="text-muted-foreground/50" /> {course.enrollmentCount || 0}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                                <FileText size={13} className="text-muted-foreground/50" /> {course.lessonsCount || 0}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4"><StatusBadge status={course.status} /></td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                <Clock size={12} className="opacity-50" /> {fmtDate(course.createdAt)}
                            </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                                <Link to={`/courses/${course.id}`} title="View"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
                                    <Eye size={15} />
                                </Link>
                                {can('course.update') && (
                                    <button onClick={() => openEdit(course)} title="Edit"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-all">
                                        <Edit2 size={15} />
                                    </button>
                                )}
                                {course.status !== 'PUBLISHED' && can('course.approve') && (
                                    <button onClick={() => handleApprove(course)} disabled={busyId === course.id} title="Approve (approve & publish)"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all disabled:opacity-40">
                                        {busyId === course.id ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={15} />}
                                    </button>
                                )}
                                {can('course.approve') && (
                                    <button onClick={() => setRejectTarget(course)} disabled={busyId === course.id} title="Reject or Move to Draft"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all disabled:opacity-40">
                                        <XCircle size={15} />
                                    </button>
                                )}
                                {can('course.approve') && (course.status !== 'PUBLISHED' ? (
                                    <button onClick={() => handlePublish(course)} disabled={busyId === course.id} title="Publish"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all disabled:opacity-40">
                                        <Rocket size={15} />
                                    </button>
                                ) : (
                                    <button onClick={() => handleUnpublish(course)} disabled={busyId === course.id} title="Unpublish (move to draft)"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all disabled:opacity-40">
                                        <Archive size={15} />
                                    </button>
                                ))}
                                {can('course.delete') && (
                                    <button onClick={() => handleDelete(course)} title="Delete"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all">
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                ))}
            </DataTable>

            {/* Edit Course Modal */}
            {editingCourse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setEditingCourse(null)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Edit2 size={18} className="text-indigo-600" /> Edit Course
                            </h3>
                            <button onClick={() => setEditingCourse(null)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 sm:p-8 space-y-5">
                            <div className="space-y-2">
                                <label className={labelCls}>Course Title *</label>
                                <input required type="text" value={editForm.title}
                                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Short Description</label>
                                <textarea rows={3} value={editForm.shortDesc}
                                    onChange={e => setEditForm(f => ({ ...f, shortDesc: e.target.value }))} className={`${inputCls} resize-none`} />
                            </div>
                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className={labelCls}>Level</label>
                                    <select value={editForm.level}
                                        onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))} className={`${inputCls} appearance-none cursor-pointer`}>
                                        <option>Beginner</option>
                                        <option>Intermediate</option>
                                        <option>Advanced</option>
                                        <option>All Levels</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Language</label>
                                    <input type="text" value={editForm.language}
                                        onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelCls}>Duration</label>
                                    <input type="text" placeholder="e.g. 6h" value={editForm.duration}
                                        onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} className={inputCls} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingCourse(null)}
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

            {/* ── Reject / Move-to-Draft Modal ─────────────────────────── */}
            <RejectCourseModal
                course={rejectTarget}
                open={!!rejectTarget}
                onClose={() => setRejectTarget(null)}
                onReject={handleReject}
                onMoveToDraft={handleMoveToDraft}
            />
        </div>
    );
}
