import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Trash2, Edit2, FileText, X, Save, Search, Lock, Users, UserPlus } from 'lucide-react';
import { coursesAPI, statsAPI, departmentsAPI, enrollmentsAPI, usersAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import RejectCourseModal from '../../../components/ui/RejectCourseModal';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

export default function AdminCourses() {
    const { isSuperAdmin, can } = useAuth();
    const [searchParams] = useSearchParams();
    // Seed the status filter from the URL (?status=PENDING) so the dashboard's
    // "Pending Approvals" card lands on the right tab.
    const [filter, setFilter] = useState(searchParams.get('status')?.toUpperCase() || 'ALL');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'ALL');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [sort, setSort] = useState('newest');

    // Only SUPER_ADMIN sees the department filter; a scoped ADMIN is locked to their own dept
    const { data: departments } = useAsyncData(
        () => isSuperAdmin() ? departmentsAPI.list() : Promise.resolve([]),
        [isSuperAdmin]
    );

    const apiFilters = { admin: true };
    if (departmentFilter !== 'ALL') apiFilters.departmentId = departmentFilter;
    const { data, loading, reload } = useAsyncData(() => coursesAPI.getAll(apiFilters), [departmentFilter]);
    const { data: categories } = useAsyncData(() => statsAPI.getCategories(), []);
    // Department-scoped admin: current dept usage vs course quota (for the limit
    // banner + disabled Approve). SUPER_ADMIN manages all depts — no banner.
    const { data: adminOverview } = useAsyncData(
        () => (isSuperAdmin() ? Promise.resolve(null) : statsAPI.getAdminOverview().catch(() => null)),
        [isSuperAdmin]
    );
    const deptCapacity = isSuperAdmin() ? null : (adminOverview?.data?.[0] || null);
    const courseLimitReached = deptCapacity ? deptCapacity.courseCount >= deptCapacity.maxCourses : false;
    const courses = data ?? [];

    const [editingCourse, setEditingCourse] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [courseOverrides, setCourseOverrides] = useState({});
    const [saving, setSaving] = useState(false);

    // Assign Instructor + View Enrolled Students state
    const [assignCourse, setAssignCourse] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const [instructorOptions, setInstructorOptions] = useState([]);
    const [enrolledCourse, setEnrolledCourse] = useState(null);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [studentsLoading, setStudentsLoading] = useState(false);

    const handleApprove = async (courseId) => {
        try {
            await coursesAPI.approve(courseId);
            reload();
            toast.success('Course approved and published!');
        } catch (err) {
            // Surface backend limit/scope errors (e.g. course limit reached).
            toast.error(err.message || 'Failed to approve course');
        }
    };

    // ── Rejection modal state ────────────────────────────────────────────────
    const [rejectTarget, setRejectTarget] = useState(null); // course to review

    const handleReject = async (courseId, reason) => {
        try {
            await coursesAPI.reject(courseId, reason);
            reload();
            toast.success('Course rejected. Instructor notified with the reason.');
        } catch (err) {
            toast.error(err.message || 'Failed to reject course');
        }
    };

    const handleMoveToDraft = async (courseId, reason) => {
        try {
            await coursesAPI.update(courseId, { status: 'DRAFT', reviewNote: reason });
            reload();
            toast.success('Course moved to Draft and instructor notified.');
        } catch (err) {
            toast.error(err.message || 'Failed to update course status');
        }
    };

    const handleDelete = async (courseId, title) => {
        if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
        try {
            await coursesAPI.delete(courseId);
            reload();
            toast.success('Course deleted.');
        } catch {
            toast.error('Failed to delete course');
        }
    };

    const handleUnpublish = async (courseId, title) => {
        if (!window.confirm(`Unpublish "${title}"? It will be hidden from students and moved back to Draft.`)) return;
        try {
            await coursesAPI.unpublish(courseId);
            reload();
            toast.success('Course unpublished — moved back to Draft.');
        } catch (err) {
            toast.error(err.message || 'Failed to unpublish course');
        }
    };

    const openAssignInstructor = async (course) => {
        setAssignCourse(course);
        setAssigningId(course.instructorId ?? null);
        try {
            const list = await usersAPI.getAll({ role: 'INSTRUCTOR', limit: 500 });
            setInstructorOptions(Array.isArray(list) ? list : []);
        } catch {
            setInstructorOptions([]);
        }
    };

    const handleAssignInstructor = async (instructorId) => {
        try {
            await coursesAPI.assignInstructor(assignCourse.id, instructorId);
            await reload();
            toast.success(instructorId ? 'Instructor assigned to course' : 'Instructor removed from course');
            setAssignCourse(null);
        } catch (err) {
            toast.error(err.message || 'Failed to assign instructor');
        }
    };

    const openEnrolledStudents = async (course) => {
        setEnrolledCourse(course);
        setEnrolledStudents([]);
        setStudentsLoading(true);
        try {
            const list = await enrollmentsAPI.getCourseStudents(course.id);
            setEnrolledStudents(Array.isArray(list) ? list : []);
        } catch {
            setEnrolledStudents([]);
            toast.error('Failed to load enrolled students');
        } finally {
            setStudentsLoading(false);
        }
    };

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
            const updated = await coursesAPI.update(editingCourse.id, {
                title: editForm.title,
                short_desc: editForm.shortDesc,
                level: editForm.level,
                language: editForm.language,
                duration: editForm.duration,
            });
            const updatedCourse = { ...editingCourse, ...updated };
            setCourseOverrides(prev => ({ ...prev, [editingCourse.id]: updatedCourse }));
            await reload();
            setEditingCourse(null);
            toast.success('Course updated successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to update course');
        } finally {
            setSaving(false);
        }
    };

    const q = search.trim().toLowerCase();
    const mergedCourses = courses.map(course => courseOverrides[course.id] ? { ...course, ...courseOverrides[course.id] } : course);
    const displayCourses = mergedCourses
        .filter(c => filter === 'ALL' || c.status === filter)
        .filter(c => categoryFilter === 'ALL' || c.category === categoryFilter)
        .filter(c => !q ||
            c.title?.toLowerCase().includes(q) ||
            c.instructorName?.toLowerCase().includes(q))
        .sort((a, b) => {
            switch (sort) {
                case 'oldest': return new Date(a.createdAt) - new Date(b.createdAt);
                case 'popular': return (b.enrollmentCount || 0) - (a.enrollmentCount || 0);
                case 'newest':
                default: return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

    const statusBadge = (status) => {
        if (status === 'PENDING') return <span className="bg-amber-50 text-amber-600 border border-amber-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><AlertTriangle size={14} /> Needs Review</span>;
        if (status === 'PUBLISHED') return <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><CheckCircle size={14} /> Published</span>;
        if (status === 'DRAFT') return <span className="bg-muted text-muted-foreground border border-border shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center">Draft</span>;
        if (status === 'REJECTED') return <span className="bg-rose-50 text-rose-600 border border-rose-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><XCircle size={14} /> Rejected</span>;
        if (status === 'ARCHIVED') return <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><FileText size={14} /> Archived</span>;
        return <span className="bg-muted text-muted-foreground border border-border text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center">{status}</span>;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Course Management"
                subtitle="Review, approve, edit, and manage all platform courses."
                action={
                    <button
                        onClick={() => {
                            const csv = "Title,Instructor,Category,Status,Enrollments\n" +
                                displayCourses.map(c => `"${c.title}","${c.instructorName}","${c.category}","${c.status}",${c.enrollmentsCount || 0}`).join("\n");
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Courses_Export_${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                        }}
                        className="bg-card border border-border text-foreground/80 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-muted/40 transition-colors"
                    >
                        Export CSV
                    </button>
                }
            />

            {courseLimitReached && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center flex-shrink-0">
                        <Lock size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">Course limit reached</p>
                        <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            {deptCapacity.departmentName} has {deptCapacity.courseCount} courses but the limit is {deptCapacity.maxCourses}.
                            You can't approve more courses until a Super Admin raises the limit.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-card border border-border shadow-sm rounded-2xl p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-wrap gap-3">
                        {['ALL', 'PUBLISHED', 'PENDING', 'DRAFT', 'REJECTED', 'ARCHIVED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-sm ${filter === f ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-card text-muted-foreground border border-border hover:bg-muted/40 hover:text-foreground'}`}
                            >
                                <span className="flex items-center gap-2">
                                    {f}
                                    {f === 'PENDING' && courses.filter(c => c.status === 'PENDING').length > 0 && (
                                        <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px]">
                                            {courses.filter(c => c.status === 'PENDING').length}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by title or instructor..."
                                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="px-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm cursor-pointer"
                        >
                            <option value="ALL">All Categories</option>
                            {(categories ?? []).map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>

                        {isSuperAdmin() && (
                            <select
                                value={departmentFilter}
                                onChange={e => setDepartmentFilter(e.target.value)}
                                className="px-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm cursor-pointer"
                            >
                                <option value="ALL">🏛️ All Departments</option>
                                {(departments ?? []).map(d => (
                                    <option key={d.id} value={d.id}>{d.icon || '🏛️'} {d.name}</option>
                                ))}
                            </select>
                        )}

                        <select
                            value={sort}
                            onChange={e => setSort(e.target.value)}
                            className="px-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm cursor-pointer"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="popular">Most Popular</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <LoadingContainer height="h-64" />
                ) : (
                    <div className="space-y-5">
                        {displayCourses.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground font-medium">
                                No courses found in this category.
                            </div>
                        ) : displayCourses.map(course => (
                            <div key={course.id} className="bg-muted/40 border border-border p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center hover:bg-muted transition-colors relative group shadow-sm">
                                <div className="w-full md:w-56 h-32 rounded-xl overflow-hidden flex-shrink-0 relative shadow-sm border border-border">
                                    <CourseThumbnail thumbnail={course.thumbnail} title={course.title} className="w-full h-full object-cover" />
                                    
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                        <h3 className="text-lg font-bold text-foreground mb-1">
                                            <Link to={`/courses/${course.id}`} className="hover:text-indigo-600 transition-colors">{course.title}</Link>
                                        </h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Link
                                                to={`/courses/${course.id}/learn`}
                                                className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                🎬 Full Preview
                                            </Link>
                                        </div>
                                            <p className="text-[13px] font-semibold text-muted-foreground flex items-center gap-2 flex-wrap">
                                                By {course.instructorName} • {course.category}
                                                {course.departmentName && (
                                                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                        {course.departmentName}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[12px] font-bold text-muted-foreground/60 mt-2 bg-card border border-border px-3 py-1 rounded-lg inline-block">{course.lessonsCount} lessons • {course.duration}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start md:items-end gap-3 flex-shrink-0 w-full md:w-44 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                                    <div className="w-full">
                                        {statusBadge(course.status)}
                                    </div>

                                    {/* Approve/Reject for PENDING — gated by course.approve */}
                                    {course.status === 'PENDING' && (
                                        <div className="flex flex-col gap-2 w-full mt-1">
                                            {can('course.approve') && (
                                                <button
                                                    onClick={() => handleApprove(course.id)}
                                                    disabled={courseLimitReached}
                                                    title={courseLimitReached ? 'Course limit reached: you can\'t approve more courses until a Super Admin raises the limit' : undefined}
                                                    className={`${courseLimitReached ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} text-[12px] py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm`}
                                                >
                                                    {courseLimitReached ? <Lock size={14} /> : <CheckCircle size={14} />} Approve
                                                </button>
                                            )}
                                            {can('course.approve') && (
                                                <button onClick={() => setRejectTarget(course)} className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm">
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Edit/Delete/Draft for ALL statuses — gated by course.update / course.delete */}
                                    <div className="flex flex-col gap-2 w-full mt-1">
                                        {can('course.update') && (
                                            <button
                                                onClick={() => openEdit(course)}
                                                className="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                        )}

                                        {can('course.update') && (
                                            <button
                                                onClick={() => openAssignInstructor(course)}
                                                className="bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <UserPlus size={13} /> Assign Instructor
                                            </button>
                                        )}

                                        <button
                                            onClick={() => openEnrolledStudents(course)}
                                            className="bg-cyan-50 text-cyan-600 border border-cyan-200 hover:bg-cyan-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                        >
                                            <Users size={13} /> Students
                                        </button>

                                        {course.status === 'PUBLISHED' && can('course.approve') && (
                                            <button
                                                onClick={() => handleUnpublish(course.id, course.title)}
                                                className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <FileText size={13} /> Unpublish
                                            </button>
                                        )}

                                        {(course.status === 'REJECTED' || course.status === 'PENDING') && can('course.update') && (
                                            <button
                                                onClick={() => setRejectTarget(course)}
                                                className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <FileText size={13} /> Move to Draft
                                            </button>
                                        )}

                                        {course.status === 'DRAFT' && can('course.approve') && (
                                            <button
                                                onClick={() => handleApprove(course.id)}
                                                className="bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <CheckCircle size={13} /> Publish
                                            </button>
                                        )}

                                        {can('course.delete') && (
                                            <button
                                                onClick={() => handleDelete(course.id, course.title)}
                                                className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Assign Instructor Modal */}
            {assignCourse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <UserPlus size={20} className="text-indigo-600" /> Assign Instructor
                            </h3>
                            <button onClick={() => setAssignCourse(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm font-semibold text-muted-foreground mb-4">
                                <span className="font-black text-foreground">{assignCourse.title}</span> — current instructor:{' '}
                                {assignCourse.instructorName || 'None'}
                            </p>
                            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Instructor</label>
                            <select
                                value={assigningId ?? ''}
                                onChange={e => setAssigningId(e.target.value || null)}
                                className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium mb-5"
                            >
                                <option value="">— No instructor (unassigned) —</option>
                                {instructorOptions.map(inst => (
                                    <option key={inst.id} value={inst.id}>
                                        {inst.name} · {inst.email}{inst.designation ? ` · ${inst.designation}` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAssignCourse(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAssignInstructor(assigningId)}
                                    disabled={assigningId === null && !assignCourse.instructorId}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                                >
                                    {assigningId === null && !assignCourse.instructorId ? 'Unassigned Already' : assigningId === null ? 'Remove Instructor' : 'Assign Instructor'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Enrolled Students Modal */}
            {enrolledCourse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Users size={20} className="text-indigo-600" /> Enrolled Students
                            </h3>
                            <button onClick={() => setEnrolledCourse(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            <p className="text-sm font-semibold text-muted-foreground mb-4">
                                <span className="font-black text-foreground">{enrolledCourse.title}</span> — {enrolledStudents.length} student{enrolledStudents.length === 1 ? '' : 's'} enrolled
                            </p>
                            {studentsLoading ? (
                                <LoadingContainer height="h-48" />
                            ) : enrolledStudents.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground font-medium">No students enrolled in this course yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {enrolledStudents.map(s => (
                                        <div key={s.id} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl p-3">
                                            <img
                                                src={s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || '?')}&background=6366f1&color=fff`}
                                                alt={s.name}
                                                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                                                <p className="text-[11px] font-semibold text-muted-foreground truncate">{s.email}{s.rollNo ? ` · ${s.rollNo}` : ''}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${s.active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {s.active ? 'Active' : 'Suspended'}
                                                </span>
                                                <p className="text-[10px] font-bold text-muted-foreground mt-1">{s.progress || 0}% complete</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Course Modal */}
            {editingCourse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Edit2 size={20} className="text-indigo-600" /> Edit Course
                            </h3>
                            <button onClick={() => setEditingCourse(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Title *</label>
                                <input
                                    required
                                    type="text"
                                    value={editForm.title}
                                    onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Short Description</label>
                                <textarea
                                    rows={3}
                                    value={editForm.shortDesc}
                                    onChange={e => setEditForm(p => ({ ...p, shortDesc: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Level</label>
                                    <select
                                        value={editForm.level}
                                        onChange={e => setEditForm(p => ({ ...p, level: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium appearance-none"
                                    >
                                        {['Beginner', 'Intermediate', 'Advanced', 'All Levels'].map(l => <option key={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Duration</label>
                                    <input
                                        type="text"
                                        value={editForm.duration}
                                        onChange={e => setEditForm(p => ({ ...p, duration: e.target.value }))}
                                        placeholder="e.g. 10h 30m"
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingCourse(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</> : <><Save size={15} /> Save Changes</>}
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
