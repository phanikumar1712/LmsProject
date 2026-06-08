import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { coursesAPI, statsAPI } from '../services/api';
import { CourseCard, SkeletonCard } from '../components/ui/CourseCard';
import { useAuth } from '../contexts/AuthContext';
import { enrollmentsAPI } from '../services/api';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const SORTS = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'newest', label: 'Newest' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'price_low', label: 'Price: Low to High' },
];

export default function CoursesPage() {
    const [params, setParams] = useSearchParams();
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [showFilters, setShowFilters] = useState(false);

    const [filters, setFilters] = useState({
        search: params.get('search') || '',
        category: params.get('category') || '',
        level: 'All',
        sort: 'popular',
    });

    useEffect(() => {
        statsAPI.getCategories().then(cats => setCategories([{ id: '', name: 'All Categories', icon: '📚' }, ...cats]));
        if (user) enrollmentsAPI.getByStudent(user.id).then(setEnrollments);
    }, [user]);

    useEffect(() => {
        setLoading(true);
        const f = {
            status: 'PUBLISHED',
            search: filters.search || undefined,
            category: filters.category || undefined,
            level: filters.level !== 'All' ? filters.level : undefined,
            sort: filters.sort,
        };
        coursesAPI.getAll(f).then(setCourses).finally(() => setLoading(false));
    }, [filters]);

    const updateFilter = (key, val) => {
        setFilters(f => ({ ...f, [key]: val }));
        const newParams = new URLSearchParams(params);
        if (val) newParams.set(key, val); else newParams.delete(key);
        setParams(newParams, { replace: true });
    };

    const clearFilters = () => {
        setFilters({ search: '', category: '', level: 'All', sort: 'popular' });
        setParams({}, { replace: true });
    };

    const hasActiveFilters = filters.search || filters.category || filters.level !== 'All';

    const getEnrollment = (courseId) => enrollments.find(e => e.courseId === courseId);

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 w-full">
            {/* Header */}
            <div className="mb-10 text-center sm:text-left">
                <h1 className="text-4xl font-extrabold text-foreground mb-3 tracking-tight">All Courses</h1>
                <p className="text-muted-foreground font-medium text-lg max-w-2xl">Discover expert-led courses across all domains to advance your career.</p>
            </div>

            {/* Search & Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-card p-2 rounded-2xl border border-border shadow-sm">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search courses, instructors..."
                        value={filters.search}
                        onChange={e => updateFilter('search', e.target.value)}
                        className="w-full bg-muted border-none outline-none text-foreground placeholder:text-muted-foreground rounded-xl py-3.5 pl-11 pr-10 focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        id="course-search"
                    />
                    {filters.search && (
                        <button onClick={() => updateFilter('search', '')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-white rounded-full p-0.5 shadow-sm">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <select
                            value={filters.sort}
                            onChange={e => updateFilter('sort', e.target.value)}
                            className="h-full bg-muted border-none outline-none text-foreground font-medium appearance-none pl-4 pr-10 rounded-xl cursor-pointer min-w-40 focus:ring-2 focus:ring-indigo-100 transition-shadow"
                            id="course-sort"
                        >
                            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-5 rounded-xl flex items-center justify-center gap-2 text-[15px] font-bold transition-colors ${showFilters ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                        <SlidersHorizontal size={18} /> Filters {hasActiveFilters && <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                    </button>
                </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 mb-8 shadow-sm text-card-foreground">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Categories */}
                        <div className="flex-1 min-w-48">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Category</p>
                            <div className="flex flex-wrap gap-2.5">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => updateFilter('category', cat.id)}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filters.category === cat.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                                    >
                                        {cat.icon} {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Level */}
                        <div className="md:border-l md:border-slate-100 md:pl-8">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Level</p>
                            <div className="flex gap-2.5 flex-wrap">
                                {LEVELS.map(level => (
                                    <button
                                        key={level}
                                        onClick={() => updateFilter('level', level)}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filters.level === level ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end">
                            <button onClick={clearFilters} className="text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors">
                                <X size={14} /> Clear all filters
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between mb-6">
                <p className="text-muted-foreground font-medium text-[15px]">
                    {loading ? 'Finding courses...' : <><span className="text-foreground font-bold">{courses.length}</span> course{courses.length !== 1 ? 's' : ''} available</>}
                </p>
            </div>

            {/* Course grid */}
            {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : courses.length === 0 ? (
                <div className="text-center py-24 bg-card border border-border border-dashed rounded-3xl mx-auto max-w-2xl">
                    <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner shadow-slate-100">🔍</div>
                    <h3 className="text-foreground font-bold text-xl mb-3">No courses found</h3>
                    <p className="text-muted-foreground font-medium mb-8">We couldn't find any courses matching your current active filters.</p>
                    <button onClick={clearFilters} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-[15px] font-bold shadow-sm transition-colors">Clear Filters</button>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {courses.map(course => (
                        <CourseCard key={course.id} course={course} enrollment={getEnrollment(course.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}
