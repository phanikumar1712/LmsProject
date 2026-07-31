import { useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
    Layers, BookOpen, Users, TrendingUp, ArrowLeft, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { statsAPI, coursesAPI } from '../../../services/api';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';

const statusColors = {
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    DRAFT: 'bg-muted text-muted-foreground',
    REJECTED: 'bg-rose-100 text-rose-700',
};

export default function CategoryDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const backDeptId = searchParams.get('departmentId');

    const { data: category, loading: catLoading, error } = useAsyncData(
        () => statsAPI.getCategoryDetail(id),
        [id]
    );
    // admin: true so DRAFT/PENDING courses are included (public view forces PUBLISHED only)
    const { data: rawCourses, loading: coursesLoading } = useAsyncData(
        () => coursesAPI.getAll({ category: id, admin: true, limit: 100 }),
        [id]
    );
    const { data: departments } = useAsyncData(() => statsAPI.getDepartments(), []);

    const courses = Array.isArray(rawCourses) ? rawCourses : [];
    const publishedCount = useMemo(
        () => courses.filter(c => c.status === 'PUBLISHED').length,
        [courses]
    );
    const deptId = category?.departmentId || backDeptId;
    const department = useMemo(
        () => (departments || []).find(d => d.id === deptId) || null,
        [departments, deptId]
    );

    const goBack = () => {
        if (backDeptId) navigate(`/super-admin/departments/${backDeptId}`);
        else navigate(-1);
    };

    if (catLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingContainer height="h-32" />
            </div>
        );
    }

    if (error || !category) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Layers size={64} className="text-muted-foreground/20 mb-4" />
                <h2 className="text-2xl font-extrabold text-foreground mb-2">Category Not Found</h2>
                <p className="text-muted-foreground font-medium mb-6">This category doesn't exist or has been removed.</p>
                <button
                    onClick={() => navigate('/super-admin/departments')}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Departments
                </button>
            </div>
        );
    }

    const kpiCards = [
        { label: 'Total Courses', value: category.courseCount ?? courses.length, icon: BookOpen, color: '#4f46e5', bg: 'bg-indigo-50' },
        { label: 'Published', value: publishedCount, icon: CheckCircle2, color: '#16a34a', bg: 'bg-emerald-50' },
        { label: 'Unique Learners', value: category.userCount ?? 0, icon: Users, color: '#d97706', bg: 'bg-amber-50' },
        { label: 'Total Enrollments', value: category.enrollmentCount ?? 0, icon: TrendingUp, color: '#0891b2', bg: 'bg-cyan-50' },
    ];

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* Back link */}
            <button
                onClick={goBack}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors"
            >
                <ArrowLeft size={16} /> {department ? `Back to ${department.name}` : 'Back'}
            </button>

            {/* Category Header */}
            <div className="bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-pink-500/10 border border-border rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-4xl shadow-lg border border-white/20 flex-shrink-0">
                        {category.icon || '📚'}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{category.name}</h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            {department ? (
                                <>
                                    Category in{' '}
                                    <Link to={`/super-admin/departments/${department.id}`} className="text-indigo-600 hover:text-indigo-700 font-bold">
                                        {department.name}
                                    </Link>
                                </>
                            ) : (
                                'Category details, courses, and enrollment stats'
                            )}
                        </p>
                        <div className="flex items-center gap-4 mt-4 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold">
                                <BookOpen size={14} /> {category.courseCount ?? 0} Courses
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold">
                                <Users size={14} /> {category.userCount ?? 0} Learners
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">
                                <TrendingUp size={14} /> {category.enrollmentCount ?? 0} Enrollments
                            </span>
                            {category.createdAt && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-xl text-xs font-bold">
                                    Created {new Date(category.createdAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map(card => (
                    <div key={card.label} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                            <card.icon size={18} style={{ color: card.color }} />
                        </div>
                        <p className="text-2xl font-extrabold text-foreground">{Number(card.value || 0).toLocaleString()}</p>
                        <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider mt-0.5">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Courses List */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                        <BookOpen size={16} /> Courses ({courses.length})
                    </h4>
                    <Link
                        to={`/admin/categories`}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                    >
                        <ExternalLink size={12} /> Manage
                    </Link>
                </div>
                {coursesLoading ? (
                    <LoadingContainer height="h-48" />
                ) : (
                    <div className="divide-y divide-border">
                        {courses.map(course => (
                            <Link
                                key={course.id}
                                to={`/courses/${course.id}`}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                            >
{course.thumbnail ? (
                                     <CourseThumbnail thumbnail={course.thumbnail} title={course.title} className="w-12 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                 ) : (
                                     <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                         {course.title?.charAt(0)}
                                     </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">
                                        {course.title}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {course.instructorName} · {course.lessonsCount || 0} lessons · {course.enrollmentCount || 0} enrolled
                                    </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${statusColors[course.status] || 'bg-muted text-muted-foreground'}`}>
                                    {course.status}
                                </span>
                            </Link>
                        ))}
                        {courses.length === 0 && (
                            <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                                <BookOpen size={32} className="opacity-20 mx-auto mb-2" />
                                <p>No courses in this category yet</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
