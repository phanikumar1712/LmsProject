import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Trash2, Edit2, FileText, X, Save, Search } from 'lucide-react';
import { coursesAPI, statsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function AdminCourses() {
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sort, setSort] = useState('newest');
    const { data, loading, reload } = useAsyncData(() => coursesAPI.getAll({ admin: true }), []);
    const { data: categories } = useAsyncData(() => statsAPI.getCategories(), []);
    const courses = data ?? [];

    const [editingCourse, setEditingCourse] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [courseOverrides, setCourseOverrides] = useState({});
    const [saving, setSaving] = useState(false);

    const handleApprove = async (courseId) => {
        try {
            await coursesAPI.approve(courseId);
            reload();
            toast.success('Course approved and published!');
        } catch {
            toast.error('Failed to approve course');
        }
    };

    const handleReject = async (courseId) => {
        try {
            await coursesAPI.reject(courseId);
            reload();
            toast.success('Course rejected.');
        } catch {
            toast.error('Failed to reject course');
        }
    };

    const handleMoveToDraft = async (courseId) => {
        const reason = window.prompt('Provide a reason for moving this course back to Draft. This will be sent to the instructor:');
        if (reason === null) return; // cancelled

        try {
            await coursesAPI.update(courseId, { status: 'DRAFT', reviewNote: reason });
            reload();
            toast.success('Course moved to Draft and instructor notified.');
        } catch {
            toast.error('Failed to update course status');
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

    const openEdit = (course) => {
        setEditingCourse(course);
        setEditForm({
            title: course.title || '',
            shortDesc: course.shortDesc || '',
            price: course.price ?? 0,
            discountPrice: course.discountPrice ?? '',
            level: course.level || 'Beginner',
            language: course.language || 'English',
            duration: course.duration || '',
        });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const price = editForm.price === '' ? 0 : Number(editForm.price);
            const discountPrice = editForm.discountPrice === '' ? null : Number(editForm.discountPrice);
            if (!Number.isFinite(price) || (discountPrice !== null && !Number.isFinite(discountPrice))) {
                throw new Error('Enter a valid price');
            }

            const updated = await coursesAPI.update(editingCourse.id, {
                title: editForm.title,
                short_desc: editForm.shortDesc,
                price,
                discount_price: discountPrice,
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
                case 'price_low': return (a.discountPrice || a.price || 0) - (b.discountPrice || b.price || 0);
                case 'price_high': return (b.discountPrice || b.price || 0) - (a.discountPrice || a.price || 0);
                case 'newest':
                default: return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

    const statusBadge = (status) => {
        if (status === 'PENDING') return <span className="bg-amber-50 text-amber-600 border border-amber-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><AlertTriangle size={14} /> Needs Review</span>;
        if (status === 'PUBLISHED') return <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><CheckCircle size={14} /> Published</span>;
        if (status === 'DRAFT') return <span className="bg-muted text-muted-foreground border border-border shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center">Draft</span>;
        if (status === 'REJECTED') return <span className="bg-rose-50 text-rose-600 border border-rose-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><XCircle size={14} /> Rejected</span>;
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
                            const csv = "Title,Instructor,Category,Price,Status,Enrollments\n" +
                                displayCourses.map(c => `"${c.title}","${c.instructorName}","${c.category}",${c.price},"${c.status}",${c.enrollmentsCount || 0}`).join("\n");
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

            <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-wrap gap-3">
                        {['ALL', 'PUBLISHED', 'PENDING', 'DRAFT', 'REJECTED'].map(f => (
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
                        <select
                            value={sort}
                            onChange={e => setSort(e.target.value)}
                            className="px-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm cursor-pointer"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="popular">Most Popular</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
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
                            <div key={course.id} className="bg-muted/40 border border-border p-5 rounded-2xl flex flex-col md:flex-row gap-6 items-center hover:bg-muted transition-colors relative group shadow-sm">
                                <div className="w-56 h-32 rounded-xl overflow-hidden flex-shrink-0 relative shadow-sm border border-border">
                                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                    <div className="absolute top-3 right-3 flex gap-1">
                                        <span className="bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] text-foreground font-bold tracking-wider shadow-sm border border-border">₹{course.discountPrice || course.price}</span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground mb-1">
                                                <Link to={`/courses/${course.id}`} className="hover:text-indigo-600 transition-colors">{course.title}</Link>
                                            </h3>
                                            <p className="text-[13px] font-semibold text-muted-foreground flex items-center gap-2">By {course.instructorName} • {course.category}</p>
                                            <p className="text-[12px] font-bold text-muted-foreground/60 mt-2 bg-card border border-border px-3 py-1 rounded-lg inline-block">{course.lessonsCount} lessons • {course.duration}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 flex-shrink-0 w-44 border-l border-border pl-6">
                                    <div className="w-full">
                                        {statusBadge(course.status)}
                                    </div>

                                    {/* Approve/Reject for PENDING */}
                                    {course.status === 'PENDING' && (
                                        <div className="flex flex-col gap-2 w-full mt-1">
                                            <button onClick={() => handleApprove(course.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm">
                                                <CheckCircle size={14} /> Approve
                                            </button>
                                            <button onClick={() => handleReject(course.id)} className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm">
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </div>
                                    )}

                                    {/* Edit/Delete/Draft for ALL statuses */}
                                    <div className="flex flex-col gap-2 w-full mt-1">
                                        <button
                                            onClick={() => openEdit(course)}
                                            className="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                        >
                                            <Edit2 size={13} /> Edit
                                        </button>

                                        {(course.status === 'PUBLISHED' || course.status === 'REJECTED') && (
                                            <button
                                                onClick={() => handleMoveToDraft(course.id)}
                                                className="bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <FileText size={13} /> Move to Draft
                                            </button>
                                        )}

                                        {course.status === 'DRAFT' && (
                                            <button
                                                onClick={() => handleApprove(course.id)}
                                                className="bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                            >
                                                <CheckCircle size={13} /> Publish
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(course.id, course.title)}
                                            className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"
                                        >
                                            <Trash2 size={13} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Price (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.price}
                                        onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Discount Price (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.discountPrice}
                                        onChange={e => setEditForm(p => ({ ...p, discountPrice: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
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
        </div>
    );
}
