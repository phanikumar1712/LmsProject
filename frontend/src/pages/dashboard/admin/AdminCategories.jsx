import { useState, useRef, useMemo, useCallback } from 'react';
import { statsAPI, departmentsAPI, coursesAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { Plus, Edit2, Trash2, Upload, X, Search, Filter, ChevronDown, RefreshCw, BookOpen, Building2, Hash, Download, LayoutGrid, List, Calendar, ArrowRight, ExternalLink, Eye, CheckCircle, User, TrendingUp, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const EMOJI_LIST = ['💻', '📊', '📈', '🎨', '📚', '🔬', '🏥', '⚖️', '💰', '🎵', '🌍', '🏗️', '🚀', '🎮', '📝', '🧠', '🎯', '🏛️', '🔧', '📖', '🎭', '🌿', '⚡', '💡', '🔬', '📐', '🎪', '🏫', '📦', '🛠️'];

export default function AdminCategories() {
    const navigate = useNavigate();
    const { isSuperAdmin } = useAuth();
    const { data, loading, reload } = useAsyncData(() => statsAPI.getCategories(), []);
    const { data: departments } = useAsyncData(
        () => isSuperAdmin() ? departmentsAPI.list() : Promise.resolve([]),
        [isSuperAdmin]
    );
    const categories = data ?? [];

    // UI state
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [viewMode, setViewMode] = useState('grid');
    const [filterDept, setFilterDept] = useState('ALL');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [form, setForm] = useState({ name: '', icon: '📚', departmentId: '' });
    const [saving, setSaving] = useState(false);

    // Detail view
    const [detailCat, setDetailCat] = useState(null);
    const [detailStats, setDetailStats] = useState(null);
    const [detailCourses, setDetailCourses] = useState([]);
    const [detailCoursesLoading, setDetailCoursesLoading] = useState(false);

    // Rename inline
    const [renameActive, setRenameActive] = useState(false);
    const [renameName, setRenameName] = useState('');
    const [renaming, setRenaming] = useState(false);

    // Add courses
    const [showAddCourses, setShowAddCourses] = useState(false);
    const [courseSearch, setCourseSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchingCourses, setSearchingCourses] = useState(false);
    const [addingCourse, setAddingCourse] = useState(null);
    const [removingCourse, setRemovingCourse] = useState(null);

    // Delete confirm
    const [deleting, setDeleting] = useState(null);

    // Import modal state
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const abortRef = useRef(null);

    // Derived data
    const totalCourses = categories.reduce((sum, c) => sum + (c.courseCount || 0), 0);

    // Build a department lookup map (id → {name, icon}) for the 'visible to' indicator
    const deptMap = useMemo(() => {
        const map = {};
        (departments ?? []).forEach(d => { map[d.id] = d; });
        return map;
    }, [departments]);

    const q = search.trim().toLowerCase();
    const filtered = useMemo(() => {
        return categories
            .filter(c => !q || c.name?.toLowerCase().includes(q))
            .filter(c => filterDept === 'ALL' || c.departmentId === filterDept)
            .sort((a, b) => {
                switch (sortBy) {
                    case 'name': return a.name?.localeCompare(b.name);
                    case 'name_desc': return b.name?.localeCompare(a.name);
                    case 'courses': return (b.courseCount || 0) - (a.courseCount || 0);
                    case 'courses_asc': return (a.courseCount || 0) - (b.courseCount || 0);
                    default: return 0;
                }
            });
    }, [categories, q, filterDept, sortBy]);

    // ── CRUD Handlers ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditingCat(null);
        setForm({ name: '', icon: '📚', departmentId: '' });
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setEditingCat(cat);
        setForm({
            name: cat.name || '',
            icon: cat.icon || '📚',
            departmentId: cat.departmentId || '',
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Category name is required'); return; }
        setSaving(true);
        try {
            const payload = { name: form.name.trim(), icon: form.icon };
            if (form.departmentId) payload.departmentId = form.departmentId;

            if (editingCat) {
                await statsAPI.updateCategory(editingCat.id, payload);
                toast.success('Category updated!');
            } else {
                await statsAPI.createCategory(payload);
                toast.success('Category created!');
            }
            setShowModal(false);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to save category');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (cat) => {
        if (!window.confirm(
            `Delete category "${cat.name}"?\n\n${cat.courseCount || 0} course(s) are associated with this category. They will have their category removed and may become uncategorized.`
        )) return;
        setDeleting(cat.id);
        try {
            await statsAPI.deleteCategory(cat.id);
            toast.success(`"${cat.name}" deleted`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete category');
        } finally {
            setDeleting(null);
        }
    };

    // ── Detail View ───────────────────────────────────────────────────────────

    const openDetail = async (cat) => {
        setDetailCat(cat);
        setDetailStats(null);
        setDetailCourses([]);
        setDetailCoursesLoading(true);
        setRenameActive(false);
        try {
            const [detail, courses] = await Promise.all([
                statsAPI.getCategoryDetail(cat.id),
                coursesAPI.getAll({ category: cat.id, limit: 100 }),
            ]);
            setDetailStats(detail);
            setDetailCourses(Array.isArray(courses) ? courses : []);
        } catch {
            setDetailCourses([]);
            toast.error('Failed to load category details');
        } finally {
            setDetailCoursesLoading(false);
        }
    };

    const startRename = () => {
        setRenameName(detailCat.name || '');
        setRenameActive(true);
    };

    const handleRename = async () => {
        if (!renameName.trim()) { toast.error('Name is required'); return; }
        setRenaming(true);
        try {
            const updated = await statsAPI.updateCategory(detailCat.id, {
                name: renameName.trim(),
                icon: detailCat.icon,
            });
            setDetailCat(prev => ({ ...prev, name: renameName.trim() }));
            setRenameActive(false);
            toast.success('Category renamed!');
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to rename');
        } finally {
            setRenaming(false);
        }
    };

    const handleRemoveCourse = async (course) => {
        if (!window.confirm(`Remove "${course.title}" from this category?`)) return;
        setRemovingCourse(course.id);
        try {
            await statsAPI.removeCourseFromCategory(detailCat.id, course.id);
            setDetailCourses(prev => prev.filter(c => c.id !== course.id));
            setDetailStats(prev => prev ? {
                ...prev,
                courseCount: (prev.courseCount || 1) - 1,
            } : prev);
            toast.success(`"${course.title}" removed`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to remove course');
        } finally {
            setRemovingCourse(null);
        }
    };

    const handleSearchCourses = useCallback(async (query) => {
        setCourseSearch(query);
        if (!query.trim()) { setSearchResults([]); return; }
        setSearchingCourses(true);
        try {
            const results = await coursesAPI.getAll({
                search: query.trim(),
                limit: 20,
                admin: true,
            });
            // Filter out courses already in this category
            const existingIds = new Set(detailCourses.map(c => c.id));
            setSearchResults((Array.isArray(results) ? results : []).filter(c => !existingIds.has(c.id)));
        } catch {
            setSearchResults([]);
        } finally {
            setSearchingCourses(false);
        }
    }, [detailCourses]);

    const handleAddCourse = async (course) => {
        setAddingCourse(course.id);
        try {
            await statsAPI.assignCourseToCategory(detailCat.id, course.id);
            setDetailCourses(prev => [...prev, course]);
            setSearchResults(prev => prev.filter(c => c.id !== course.id));
            setDetailStats(prev => prev ? {
                ...prev,
                courseCount: (prev.courseCount || 0) + 1,
            } : prev);
            toast.success(`"${course.title}" added!`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to add course');
        } finally {
            setAddingCourse(null);
        }
    };

    const handleDeleteFromDetail = async () => {
        if (!window.confirm(
            `Delete category "${detailCat.name}"?\n\n${detailCourses.length} course(s) will have their category removed and may become uncategorized.`
        )) return;
        setDeleting(detailCat.id);
        try {
            await statsAPI.deleteCategory(detailCat.id);
            toast.success(`"${detailCat.name}" deleted`);
            setDetailCat(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete category');
        } finally {
            setDeleting(null);
        }
    };

    // ── Import ─────────────────────────────────────────────────────────────────

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile) { toast.error('Choose a CSV or Excel file'); return; }
        setImporting(true);
        setImportResults(null);
        const ac = new AbortController();
        abortRef.current = ac;
        try {
            const res = await statsAPI.importCategories(importFile, { signal: ac.signal });
            setImportResults(res);
            reload();
            toast.success(`${res.created} created, ${res.failed} failed`);
        } catch (err) {
            if (err.name === 'AbortError') toast.error('Import timed out. Try a smaller file.');
            else toast.error(err.message || 'Import failed');
        } finally {
            setImporting(false);
            abortRef.current = null;
        }
    };

    const cancelImport = () => {
        abortRef.current?.abort();
        setImporting(false);
    };

    // ── Render Helpers ─────────────────────────────────────────────────────────

    const renderCard = (cat) => {
        const deptInfo = cat.departmentId ? deptMap[cat.departmentId] : null;
        return (
        <div
            key={cat.id}
            className="bg-card border border-border rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
        >
            {/* Icon */}
            <div className="text-5xl mb-4 text-center">{cat.icon || '📚'}</div>

            {/* Name */}
            <h3 className="font-bold text-foreground text-center text-[15px] mb-1 truncate">{cat.name}</h3>

            {/* Department badge */}
            {cat.departmentId && deptInfo && (
                <div className="flex items-center justify-center mt-1 mb-3">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 px-2.5 py-1 rounded-full flex items-center gap-1 border border-indigo-200 dark:border-indigo-800">
                        <Building2 size={10} /> {deptInfo.icon || '🏛️'} {deptInfo.name}
                    </span>
                </div>
            )}

            {/* Course count */}
            <div className="flex items-center justify-center mb-4">
                <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <BookOpen size={11} /> {cat.courseCount || 0} courses
                </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border">
                <button
                    onClick={() => openDetail(cat)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-foreground bg-muted hover:bg-muted/80 dark:bg-muted/30 dark:hover:bg-muted/50 transition-colors"
                >
                    <Eye size={12} /> Details
                </button>
                <button
                    onClick={() => openEdit(cat)}
                    className="flex items-center justify-center p-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 transition-colors"
                >
                    <Edit2 size={12} />
                </button>
                <button
                    onClick={() => handleDelete(cat)}
                    disabled={deleting === cat.id}
                    className="flex items-center justify-center p-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                >
                    {deleting === cat.id ? (
                        <div className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Trash2 size={12} />
                    )}
                </button>
            </div>
        </div>
    );
    };

    const renderListRow = (cat) => {
        const deptInfo = cat.departmentId ? deptMap[cat.departmentId] : null;
        return (
        <div
            key={cat.id}
            className="flex items-center gap-4 px-5 py-4 bg-card border border-border rounded-xl hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 group"
        >
            <span className="text-2xl flex-shrink-0">{cat.icon || '📚'}</span>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-[15px] truncate">{cat.name}</p>
                <p className="text-xs text-muted-foreground">
                    {cat.courseCount || 0} courses · ID: {cat.id ? cat.id.slice(0, 8) : ''}...
                </p>
                {/* Department badge */}
                {cat.departmentId && deptInfo && (
                    <div className="mt-1.5">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-indigo-200 dark:border-indigo-800">
                            <Building2 size={10} /> {deptInfo.icon || '🏛️'} {deptInfo.name}
                        </span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={() => openDetail(cat)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-foreground bg-muted hover:bg-muted/80 transition-colors flex items-center gap-1"
                >
                    <Eye size={13} /> View
                </button>
                <button
                    onClick={() => openEdit(cat)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                    <Edit2 size={14} />
                </button>
                <button
                    onClick={() => handleDelete(cat)}
                    disabled={deleting === cat.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50"
                >
                    {deleting === cat.id ? (
                        <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Trash2 size={14} />
                    )}
                </button>
            </div>
        </div>
    );
    };

    if (loading) return <LoadingContainer height="h-96" />;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Course Categories"
                subtitle="Organize courses into categories for easy browsing and filtering."
                action={
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => { setShowImport(true); setImportResults(null); setImportFile(null); }}
                            className="bg-card border border-border text-foreground/80 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-muted/60 transition-colors"
                        >
                            <Upload size={16} /> Import
                        </button>
                        <button
                            onClick={openCreate}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                        >
                            <Plus size={16} /> Add Category
                        </button>
                    </div>
                }
            />

            {/* Stats banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <p className="text-3xl font-extrabold text-foreground">{categories.length}</p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Categories</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <p className="text-3xl font-extrabold text-foreground">{totalCourses}</p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Courses</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <p className="text-3xl font-extrabold text-foreground">
                        {totalCourses > 0 ? Math.round(totalCourses / categories.length) : 0}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Avg Courses/Category</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <p className="text-3xl font-extrabold text-foreground">
                        {categories.filter(c => (c.courseCount || 0) > 0).length}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Active Categories</p>
                </div>
            </div>

            {/* Filters & Toolbar */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search categories..."
                            className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                        />
                    </div>

                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold cursor-pointer min-w-[140px]"
                    >
                        <option value="name">Name A-Z</option>
                        <option value="name_desc">Name Z-A</option>
                        <option value="courses">Most Courses</option>
                        <option value="courses_asc">Least Courses</option>
                    </select>

                    {isSuperAdmin() && (
                        <select
                            value={filterDept}
                            onChange={e => setFilterDept(e.target.value)}
                            className="px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold cursor-pointer min-w-[160px]"
                        >
                            <option value="ALL">All Departments</option>
                            {(departments ?? []).map(d => (
                                <option key={d.id} value={d.id}>{d.icon || '🏛️'} {d.name}</option>
                            ))}
                        </select>
                    )}

                    <div className="flex items-center border border-border rounded-xl overflow-hidden flex-shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}`}
                            title="Grid view"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted'}`}
                            title="List view"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => { reload(); toast.success('Refreshed!'); }}
                        className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>

                {search && (
                    <div className="mt-3 text-xs text-muted-foreground font-medium">
                        Found <span className="text-foreground font-bold">{filtered.length}</span> of {categories.length} categories
                        {search && (
                            <button onClick={() => setSearch('')} className="ml-2 text-indigo-600 hover:text-indigo-700 font-bold">
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Categories Display */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 bg-muted/40 rounded-2xl border border-border border-dashed">
                    {search ? (
                        <>
                            <Search size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">No categories match your search</p>
                            <button onClick={() => setSearch('')} className="text-indigo-600 text-sm font-bold mt-2 hover:text-indigo-700">
                                Clear search
                            </button>
                        </>
                    ) : (
                        <>
                            <BookOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">No categories yet</p>
                            <button onClick={openCreate} className="text-indigo-600 text-sm font-bold mt-2 hover:text-indigo-700">
                                Create your first category
                            </button>
                        </>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filtered.map(renderCard)}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(renderListRow)}
                </div>
            )}

            {/* ── Create/Edit Modal ─────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                {editingCat ? (
                                    <><Edit2 size={18} className="text-indigo-600" /> Edit Category</>
                                ) : (
                                    <><Plus size={18} className="text-indigo-600" /> New Category</>
                                )}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">
                                    Category Name *
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Web Development"
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    autoFocus
                                />
                            </div>

                            {/* Icon Picker */}
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">
                                    Icon {form.icon && <span className="text-lg ml-1">{form.icon}</span>}
                                </label>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-xl border border-border">
                                    {EMOJI_LIST.map(emoji => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setForm(p => ({ ...p, icon: emoji }))}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-all ${
                                                form.icon === emoji
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500 scale-110 shadow-sm'
                                                    : 'hover:bg-muted'
                                            }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Department (super admin only) */}
                            {isSuperAdmin() && (
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">
                                        Department <span className="text-muted-foreground/50 font-normal normal-case">(optional)</span>
                                    </label>
                                    <select
                                        value={form.departmentId}
                                        onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    >
                                        <option value="">No department (global)</option>
                                        {(departments ?? []).map(d => (
                                            <option key={d.id} value={d.id}>{d.icon || '🏛️'} {d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Preview */}
                            {form.name && (
                                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{form.icon || '📚'}</span>
                                        <div>
                                            <p className="font-bold text-foreground">{form.name}</p>
                                            <p className="text-xs text-muted-foreground">0 courses</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !form.name.trim()}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                                    ) : editingCat ? (
                                        <><Edit2 size={15} /> Save Changes</>
                                    ) : (
                                        <><Plus size={15} /> Create Category</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Import Modal ───────────────────────────────────────────────────── */}
            {showImport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Upload size={18} className="text-indigo-600" /> Import Categories
                            </h3>
                            <button onClick={() => setShowImport(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            {!importResults ? (
                                <form onSubmit={handleImport} className="space-y-5">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Upload a <b>CSV or Excel</b> file with columns <code className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">name</code> and optional <code className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">icon</code> (emoji).
                                    </p>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5">
                                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-3 uppercase tracking-wider">Expected Format:</p>
                                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-indigo-100 dark:border-indigo-800">
                                            <code className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono whitespace-pre leading-relaxed">name,icon{'\n'}Web Development,💻{'\n'}Data Science,📊{'\n'}Marketing,📈{'\n'}Design,🎨</code>
                                        </div>
                                    </div>

                                    <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                                        onClick={() => document.getElementById('import-file-input')?.click()}
                                    >
                                        <Upload size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            {importFile ? importFile.name : 'Click to select a file'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">CSV or Excel (.csv, .xlsx)</p>
                                        <input
                                            id="import-file-input"
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            onChange={e => setImportFile(e.target.files[0])}
                                            className="hidden"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowImport(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                            Cancel
                                        </button>
                                        {importing ? (
                                            <button type="button" onClick={cancelImport} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Cancel Import
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={!importFile} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all">
                                                Import
                                            </button>
                                        )}
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    {/* Results summary */}
                                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border">
                                        <div className="flex-1 text-center">
                                            <p className="text-2xl font-extrabold text-emerald-600">{importResults.created || 0}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Created</p>
                                        </div>
                                        <div className="w-px h-10 bg-border" />
                                        <div className="flex-1 text-center">
                                            <p className="text-2xl font-extrabold text-rose-600">{importResults.failed || 0}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Failed</p>
                                        </div>
                                        <div className="w-px h-10 bg-border" />
                                        <div className="flex-1 text-center">
                                            <p className="text-2xl font-extrabold text-foreground">{(importResults.results || []).length}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</p>
                                        </div>
                                    </div>

                                    {/* Results list */}
                                    <div className="max-h-64 overflow-y-auto border border-border rounded-2xl divide-y divide-border">
                                        {(importResults.results || []).map((r, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
                                                <span className="font-medium text-foreground truncate flex items-center gap-2">
                                                    {r.icon && <span>{r.icon}</span>}
                                                    {r.name || '(no name)'}
                                                </span>
                                                {r.status === 'created' ? (
                                                    <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                                                        Created
                                                    </span>
                                                ) : (
                                                    <span className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2 py-1 rounded-lg" title={r.error}>
                                                        {r.error || 'Failed'}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => { setShowImport(false); setImportResults(null); }}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200"
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* ── Category Detail / Management Modal ──────────────────────────── */}
            {detailCat && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailCat(null)}>
                    <div className="bg-card w-full max-w-3xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* ── Header with rename ── */}
                        <div className="p-6 border-b border-border bg-gradient-to-r from-indigo-500/5 to-transparent">
                            <div className="flex items-start gap-4">
                                <span className="text-5xl flex-shrink-0">{detailCat.icon || '📚'}</span>
                                <div className="flex-1 min-w-0">
                                    {renameActive ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={renameName}
                                                onChange={e => setRenameName(e.target.value)}
                                                className="flex-1 px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg font-extrabold"
                                                autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameActive(false); }}
                                            />
                                            <button onClick={handleRename} disabled={renaming}
                                                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition-colors"
                                            >
                                                {renaming ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                                            </button>
                                            <button onClick={() => setRenameActive(false)}
                                                className="p-2.5 bg-muted hover:bg-muted/80 rounded-xl transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">{detailCat.name}</h3>
                                            <button onClick={startRename}
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="Rename"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                        <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                            <BookOpen size={12} /> {(detailStats?.courseCount ?? detailCat.courseCount) || 0} courses
                                        </span>
                                        <span className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-lg">
                                            ID: {detailCat.id?.slice(0, 8)}...
                                        </span>
                                        {detailCat.created_at && (
                                            <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                                <Calendar size={11} /> Created {new Date(detailCat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => setDetailCat(null)} className="p-2 hover:bg-muted rounded-full transition-colors flex-shrink-0">
                                    <X size={20} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* ── Stats cards ── */}
                        <div className="px-6 py-4 border-b border-border bg-muted/20 grid grid-cols-3 gap-4">
                            <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
                                <BookOpen size={20} className="mx-auto text-indigo-500 mb-1" />
                                <p className="text-2xl font-extrabold text-foreground">{(detailStats?.courseCount ?? detailCat.courseCount) || 0}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Courses</p>
                            </div>
                            <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
                                <User size={20} className="mx-auto text-emerald-500 mb-1" />
                                <p className="text-2xl font-extrabold text-foreground">{detailStats?.userCount || 0}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Students</p>
                            </div>
                            <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
                                <TrendingUp size={20} className="mx-auto text-amber-500 mb-1" />
                                <p className="text-2xl font-extrabold text-foreground">{detailStats?.enrollmentCount || 0}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Enrollments</p>
                            </div>
                        </div>

                        {/* ── Department info ── */}
                        {detailCat.departmentId && deptMap[detailCat.departmentId] && (
                            <div className="px-6 py-3 border-b border-border bg-muted/20 flex items-center gap-4">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Department</p>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800">
                                    <Building2 size={12} /> {deptMap[detailCat.departmentId].icon || '🏛️'} {deptMap[detailCat.departmentId].name}
                                </span>
                            </div>
                        )}

                        {/* ── Courses in category ── */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <BookOpen size={14} /> Courses in this Category
                                    {detailCourses.length > 0 && (
                                        <span className="text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-lg">{detailCourses.length}</span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-2">
                                    {detailCoursesLoading && (
                                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    )}
                                    <button
                                        onClick={() => { setShowAddCourses(true); setCourseSearch(''); setSearchResults([]); }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm"
                                    >
                                        <Plus size={13} /> Add Courses
                                    </button>
                                </div>
                            </div>

                            {detailCoursesLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : detailCourses.length === 0 ? (
                                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-border border-dashed">
                                    <BookOpen size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                                    <p className="text-muted-foreground font-medium text-sm">No courses in this category</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Courses" above to assign courses.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {detailCourses.map(course => (
                                        <div key={course.id} className="flex items-center gap-4 p-4 bg-muted/20 border border-border rounded-xl hover:bg-muted/40 transition-colors group">
                                            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                                                {course.thumbnail ? (
                                                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    course.title?.charAt(0) || '?'
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground text-sm truncate">{course.title}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {course.instructorName || 'Unknown'} · {course.level || 'All levels'}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${course.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : course.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                                                {course.status || 'DRAFT'}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveCourse(course)}
                                                disabled={removingCourse === course.id}
                                                className="p-2 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                title="Remove from category"
                                            >
                                                {removingCourse === course.id ? (
                                                    <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <X size={14} />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Footer actions ── */}
                        <div className="p-4 border-t border-border bg-muted/20 flex items-center gap-3">
                            <button
                                onClick={() => navigate(`/admin/courses?category=${encodeURIComponent(detailCat.name)}`)}
                                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                <BookOpen size={14} /> View Courses
                            </button>
                            <button
                                onClick={handleDeleteFromDetail}
                                disabled={deleting === detailCat.id}
                                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                            >
                                {deleting === detailCat.id ? (
                                    <><div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" /> Deleting...</>
                                ) : (
                                    <><Trash2 size={14} /> Delete</>
                                )}
                            </button>
                            <button
                                onClick={() => setDetailCat(null)}
                                className="flex-1 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Courses Modal ──────────────────────────────────────────── */}
            {showAddCourses && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAddCourses(false)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Plus size={18} className="text-indigo-600" /> Add Courses to "{detailCat?.name}"
                            </h3>
                            <button onClick={() => setShowAddCourses(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={courseSearch}
                                    onChange={e => handleSearchCourses(e.target.value)}
                                    placeholder="Search courses by title..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    autoFocus
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {searchingCourses ? (
                                    <div className="text-center py-8">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </div>
                                ) : courseSearch && searchResults.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                                        <Search size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                                        {courseSearch.trim() ? 'No courses found matching your search' : 'Type to search for courses'}
                                    </div>
                                ) : (
                                    searchResults.map(course => (
                                        <div key={course.id} className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl hover:bg-muted/40 transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                                                {course.thumbnail ? (
                                                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    course.title?.charAt(0) || '?'
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{course.title}</p>
                                                <p className="text-[11px] text-muted-foreground">{course.instructorName || 'Unknown'} · {course.status}</p>
                                            </div>
                                            <button
                                                onClick={() => handleAddCourse(course)}
                                                disabled={addingCourse === course.id}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                            >
                                                {addingCourse === course.id ? (
                                                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <><Plus size={12} /> Add</>
                                                )}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/20">
                            <button
                                onClick={() => setShowAddCourses(false)}
                                className="w-full py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
