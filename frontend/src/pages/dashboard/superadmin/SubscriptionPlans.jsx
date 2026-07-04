import { useState, useEffect } from 'react';
import { CreditCard, Check, Star, Edit2, Save, X, Plus, Trash2, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { coursesAPI, subscriptionsAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

const PLAN_COLORS = {
    FREE: '#94a3b8',
    BASIC: '#3b82f6',
    PRO: '#a855f7',
    ENTERPRISE: '#f59e0b'
};

// removed DEFAULT_COLORS

const emptyPlan = {
    name: '',
    price: 0,
    duration: 30,
    features: [''],
    popular: false,
    courseIds: [],
};

const getPlanCourseIds = (plan) => (
    plan.courseIds || plan.course_ids || (plan.courses || []).map(course => course.id)
);

function CoursePriorityPicker({ courses, selectedIds, onChange }) {
    const [search, setSearch] = useState('');
    const selectedSet = new Set(selectedIds);
    const selectedCourses = selectedIds
        .map(id => courses.find(course => course.id === id))
        .filter(Boolean);
    const availableCourses = courses.filter(course => (
        !selectedSet.has(course.id) &&
        course.title.toLowerCase().includes(search.toLowerCase())
    ));

    const addCourse = (courseId) => onChange([...selectedIds, courseId]);
    const removeCourse = (courseId) => onChange(selectedIds.filter(id => id !== courseId));
    const moveCourse = (index, direction) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= selectedIds.length) return;
        const next = [...selectedIds];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        onChange(next);
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Courses by Priority</label>
                {selectedCourses.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl py-4 px-3 text-center text-xs font-medium text-muted-foreground/70">
                        No courses assigned to this plan yet.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {selectedCourses.map((course, idx) => (
                            <div key={course.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
                                <span className="w-6 h-6 rounded-lg bg-card border border-border text-[11px] font-black text-muted-foreground flex items-center justify-center">
                                    {idx + 1}
                                </span>
                                {course.thumbnail && (
                                    <img src={course.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover bg-muted flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-foreground truncate">{course.title}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">{course.status || 'COURSE'}</p>
                                </div>
                                <button type="button" onClick={() => moveCourse(idx, -1)} disabled={idx === 0} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg disabled:opacity-30 transition-colors" title="Move up">
                                    <ArrowUp size={13} />
                                </button>
                                <button type="button" onClick={() => moveCourse(idx, 1)} disabled={idx === selectedCourses.length - 1} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg disabled:opacity-30 transition-colors" title="Move down">
                                    <ArrowDown size={13} />
                                </button>
                                <button type="button" onClick={() => removeCourse(course.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove course">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search courses to add..."
                        className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {availableCourses.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs font-medium text-muted-foreground/70">
                            No available courses found.
                        </div>
                    ) : availableCourses.map(course => (
                        <button
                            type="button"
                            key={course.id}
                            onClick={() => addCourse(course.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                        >
                            {course.thumbnail && (
                                <img src={course.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover bg-muted flex-shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 text-xs font-bold text-foreground truncate">{course.title}</span>
                            <Plus size={13} className="text-indigo-600 flex-shrink-0" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SubscriptionPlans() {
    const [plans, setPlans] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editData, setEditData] = useState({});
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlan, setNewPlan] = useState({ ...emptyPlan });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        Promise.allSettled([
            subscriptionsAPI.getPlans(),
            coursesAPI.getAll({ admin: true, status: 'ALL', limit: 500 }),
        ])
            .then(([plansResult, coursesResult]) => {
                if (plansResult.status === 'fulfilled') {
                    setPlans(plansResult.value);
                } else {
                    console.error('[SubscriptionPlans] Failed to load plans:', plansResult.reason);
                    toast.error(plansResult.reason?.message || 'Failed to load subscription plans');
                }

                if (coursesResult.status === 'fulfilled') {
                    setCourses(coursesResult.value);
                } else {
                    console.error('[SubscriptionPlans] Failed to load courses:', coursesResult.reason);
                    toast.error(coursesResult.reason?.message || 'Failed to load courses for plan assignments');
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const startEdit = (plan) => {
        setEditing(plan.id);
        setEditData({
            ...plan,
            price: plan.price,
            duration: plan.duration,
            features: Array.isArray(plan.features) ? [...plan.features] : [],
            courseIds: getPlanCourseIds(plan),
        });
    };

    const saveEdit = async (planId) => {
        try {
            const updated = await subscriptionsAPI.updatePlan(planId, {
                ...editData,
                price: Number(editData.price),
                duration: Number(editData.duration),
                features: editData.features.filter(f => f.trim() !== ''),
                courseIds: editData.courseIds || [],
            });
            setPlans(plans.map(p => p.id === planId ? updated : p));
            setEditing(null);
            toast.success('Subscription plan updated!');
        } catch (err) {
            toast.error(err?.message || 'Failed to update plan');
        }
    };

    const handleCreatePlan = async (e) => {
        e.preventDefault();
        if (!newPlan.name.trim()) { toast.error('Plan name is required'); return; }
        setCreating(true);
        try {
            const res = await subscriptionsAPI.createPlan({
                ...newPlan,
                price: Number(newPlan.price),
                duration: Number(newPlan.duration),
                features: newPlan.features.filter(f => f.trim() !== ''),
                courseIds: newPlan.courseIds || [],
            });
            setPlans(prev => [...prev, res]);
            setShowCreateModal(false);
            setNewPlan({ ...emptyPlan });
            toast.success('Custom plan created!');
        } catch (err) {
            toast.error(err.message || 'Failed to create plan');
        } finally {
            setCreating(false);
        }
    };

    const handleDeletePlan = async (planId, planName) => {
        if (!window.confirm(`Delete plan "${planName}"? This cannot be undone.`)) return;
        try {
            await subscriptionsAPI.deletePlan(planId);
            setPlans(prev => prev.filter(p => p.id !== planId));
            toast.success('Plan deleted.');
        } catch (err) {
            toast.error(err.message || 'Failed to delete plan');
        }
    };

    const addFeatureToEdit = () => setEditData(p => ({ ...p, features: [...p.features, ''] }));
    const removeFeatureFromEdit = (idx) => setEditData(p => ({ ...p, features: p.features.filter((_, i) => i !== idx) }));
    const updateFeatureInEdit = (idx, val) => setEditData(p => ({ ...p, features: p.features.map((f, i) => i === idx ? val : f) }));

    const addFeatureToNew = () => setNewPlan(p => ({ ...p, features: [...p.features, ''] }));
    const removeFeatureFromNew = (idx) => setNewPlan(p => ({ ...p, features: p.features.filter((_, i) => i !== idx) }));
    const updateFeatureInNew = (idx, val) => setNewPlan(p => ({ ...p, features: p.features.map((f, i) => i === idx ? val : f) }));

    if (loading) return <div className="p-8 text-center text-muted-foreground font-medium">Loading plans...</div>;

    return (
        <div className="space-y-8 max-w-5xl">
            <PageHeader
                title="Subscription Plans"
                subtitle="Manage pricing tiers and feature access. Create custom plans for special cases."
                action={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Create Custom Plan
                    </button>
                }
            />

            <div className="grid lg:grid-cols-2 gap-6">
                {plans.map(plan => {
                    const planColor = PLAN_COLORS[plan.name?.toUpperCase()] || '#6366f1';
                    return (
                        <div key={plan.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-border" style={{ borderTop: `4px solid ${planColor}` }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            {plan.popular && <Star size={15} fill="currentColor" className="text-amber-500" />}
                                            <h3 className="text-foreground font-extrabold text-lg">{plan.name}</h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {editing === plan.id ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => saveEdit(plan.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors">
                                                    <Save size={12} /> Save
                                                </button>
                                                <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted transition-colors">
                                                    <X size={12} /> Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button onClick={() => startEdit(plan)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/40 transition-colors">
                                                    <Edit2 size={12} /> Edit
                                                </button>
                                                {!['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].includes(plan.name?.toUpperCase()) && (
                                                    <button onClick={() => handleDeletePlan(plan.id, plan.name)} className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 transition-colors">
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {editing === plan.id ? (
                                    <div className="space-y-3 mt-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { key: 'price', label: 'Price (₹)' },
                                                { key: 'duration', label: 'Duration (Days)' },
                                            ].map(({ key, label }) => (
                                                <div key={key}>
                                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                                                    <input
                                                        type="number"
                                                        value={editData[key]}
                                                        onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))}
                                                        className="w-full bg-card border border-border rounded-lg py-2 px-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-indigo-100 outline-none"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Features</label>
                                            {editData.features.map((f, idx) => (
                                                <div key={idx} className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={f}
                                                        onChange={e => updateFeatureInEdit(idx, e.target.value)}
                                                        placeholder={`Feature ${idx + 1}`}
                                                        className="flex-1 bg-card border border-border rounded-lg py-1.5 px-3 text-sm font-medium text-foreground focus:ring-2 focus:ring-indigo-100 outline-none"
                                                    />
                                                    <button type="button" onClick={() => removeFeatureFromEdit(idx)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={addFeatureToEdit} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1">
                                                <Plus size={13} /> Add Feature
                                            </button>
                                        </div>
                                        <CoursePriorityPicker
                                            courses={courses}
                                            selectedIds={editData.courseIds || []}
                                            onChange={courseIds => setEditData(p => ({ ...p, courseIds }))}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-3 mt-4">
                                        <div>
                                            <p className="text-3xl font-extrabold text-foreground" style={{ color: planColor }}>
                                                {Number(plan.price) === 0 ? 'Free' : `₹${Number(plan.price).toLocaleString()}`}
                                            </p>
                                        </div>
                                        {plan.duration > 0 && (
                                            <div className="pb-1 text-muted-foreground text-sm font-medium">
                                                {plan.duration} Days
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-6">
                                <p className="text-[11px] font-extrabold text-muted-foreground/60 uppercase tracking-wider mb-3">Features Included</p>
                                <ul className="space-y-2 mb-4">
                                    {(editing === plan.id ? editData.features : (plan.features || [])).filter(f => f).map((f, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                                            <Check size={14} className="text-emerald-500 flex-shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-[11px] font-extrabold text-muted-foreground/60 uppercase tracking-wider mb-3">Courses Included</p>
                                {(plan.courses || []).length === 0 ? (
                                    <p className="text-xs font-medium text-muted-foreground/70">No courses assigned.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {(plan.courses || []).map(course => (
                                            <div key={course.id} className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                                                <span className="w-5 h-5 rounded-md bg-muted text-[10px] font-black text-muted-foreground flex items-center justify-center flex-shrink-0">{course.priority}</span>
                                                <span className="truncate">{course.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create Custom Plan Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <CreditCard size={20} className="text-indigo-600" /> Create Custom Plan
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreatePlan} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Plan Name *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. UNIVERSITY, TEAM, LIFETIME"
                                    value={newPlan.name}
                                    onChange={e => setNewPlan(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Price (₹) *</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={newPlan.price}
                                        onChange={e => setNewPlan(p => ({ ...p, price: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">Duration (Days)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newPlan.duration}
                                        onChange={e => setNewPlan(p => ({ ...p, duration: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="popular-check"
                                    checked={newPlan.popular}
                                    onChange={e => setNewPlan(p => ({ ...p, popular: e.target.checked }))}
                                    className="w-4 h-4 rounded accent-indigo-600"
                                />
                                <label htmlFor="popular-check" className="text-sm font-semibold text-foreground cursor-pointer">Mark as Popular</label>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 block">Features</label>
                                {newPlan.features.map((f, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={f}
                                            onChange={e => updateFeatureInNew(idx, e.target.value)}
                                            placeholder={`Feature ${idx + 1}`}
                                            className="flex-1 bg-muted/40 border border-border rounded-xl py-2 px-3 text-sm font-medium text-foreground focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        />
                                        <button type="button" onClick={() => removeFeatureFromNew(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={addFeatureToNew} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                                    <Plus size={13} /> Add Feature
                                </button>
                            </div>
                            <CoursePriorityPicker
                                courses={courses}
                                selectedIds={newPlan.courseIds || []}
                                onChange={courseIds => setNewPlan(p => ({ ...p, courseIds }))}
                            />
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {creating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</> : <><Plus size={15} /> Create Plan</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
