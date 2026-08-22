import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Layers, BookOpen, Users, TrendingUp,
    Search, Plus, X,
    ChevronRight, ShieldCheck
} from 'lucide-react';
import { statsAPI, departmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import toast from 'react-hot-toast';

function CategoryCard({ cat, rank }) {
    const bgGradients = [
        'from-indigo-500 to-violet-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-cyan-500 to-blue-600',
        'from-rose-500 to-pink-600',
        'from-fuchsia-500 to-purple-600',
    ];
    const gradient = bgGradients[Math.abs(cat.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % bgGradients.length)];

    return (
        <div className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className={`h-2 bg-gradient-to-r ${gradient}`} />
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl shadow-md`}>
                            {cat.icon || '📚'}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-extrabold text-foreground text-[15px] truncate group-hover:text-indigo-600 transition-colors">{cat.name}</h3>
                            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                                {cat.courseCount || 0} courses · {cat.studentCount || 0} students
                            </p>
                        </div>
                    </div>
                    <Link
                        to={`/super-admin/categories/${cat.id}`}
                        className="w-8 h-8 rounded-full bg-muted hover:bg-indigo-50 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-indigo-600 transition-colors" />
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="bg-indigo-50 rounded-xl p-3 border border-white/60 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center"><BookOpen size={14} className="text-indigo-600" /></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 leading-none">Courses</p><p className="text-base font-black text-indigo-600 mt-0.5">{cat.courseCount || 0}</p></div>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 border border-white/60 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Users size={14} className="text-emerald-600" /></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 leading-none">Students</p><p className="text-base font-black text-emerald-600 mt-0.5">{(cat.studentCount || 0).toLocaleString()}</p></div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 border border-white/60 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><TrendingUp size={14} className="text-amber-600" /></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 leading-none">Enrollments</p><p className="text-base font-black text-amber-600 mt-0.5">{(cat.enrollmentCount || 0).toLocaleString()}</p></div>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-3 border border-white/60 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><ShieldCheck size={14} className="text-violet-600" /></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 leading-none">Avg Rating</p><p className="text-base font-black text-violet-600 mt-0.5">{cat.avgRating ? cat.avgRating.toFixed(1) : '—'}</p></div>
                    </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <span className="text-[11px] text-muted-foreground/50 font-medium">Rank #{rank}</span>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active</span>
                </div>
            </div>
        </div>
    );
}

export default function CategoryOverview() {
    const { data: categories, loading, reload } = useAsyncData(() => statsAPI.getCategories(), []);
    const { data: departments } = useAsyncData(() => departmentsAPI.list(), []);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', icon: '📚', departmentId: '' });
    const [creating, setCreating] = useState(false);

    const filtered = useMemo(() => {
        if (!categories) return [];
        return categories.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [categories, searchTerm]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name.trim()) { toast.error('Category name is required'); return; }
        setCreating(true);
        try {
            const payload = { name: createForm.name.trim(), icon: createForm.icon || '📚' };
            if (createForm.departmentId) payload.departmentId = createForm.departmentId;
            await statsAPI.createCategory(payload);
            toast.success(`Category "${createForm.name}" created`);
            setShowCreate(false);
            setCreateForm({ name: '', icon: '📚', departmentId: '' });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create category');
        } finally { setCreating(false); }
    };

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
                title="Categories"
                subtitle="Manage course categories — each groups related courses together"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        <Plus size={16} /> New Category
                    </button>
                }
            />

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm font-medium text-foreground focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all placeholder:text-muted-foreground/30"
                />
            </div>

            {/* Grid */}
            {filtered.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((cat, i) => (
                        <CategoryCard key={cat.id} cat={cat} rank={i + 1} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-border">
                    <Layers size={48} className="text-muted-foreground/15 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-1">No categories found</h3>
                    <p className="text-muted-foreground text-sm">Create your first category to organize courses</p>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <Layers size={18} className="text-indigo-600" /> Create Category
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 dark:hover:bg-black/20 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Category Name *</label>
                                <input required type="text" placeholder="e.g. Web Development" value={createForm.name}
                                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Icon Emoji</label>
                                <input type="text" placeholder="📚" maxLength={2} value={createForm.icon}
                                    onChange={e => setCreateForm(f => ({ ...f, icon: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm text-center" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Department (Optional)</label>
                                <select value={createForm.departmentId} onChange={e => setCreateForm(f => ({ ...f, departmentId: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium appearance-none">
                                    <option value="">Global (no department)</option>
                                    {(departments || []).map(d => (
                                        <option key={d.id} value={d.id}>{d.icon || '🏛️'} {d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                    {creating ? 'Creating...' : 'Create Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}