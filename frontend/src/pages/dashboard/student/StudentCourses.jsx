import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { enrollmentsAPI, coursesAPI } from '../../../services/api';
import { CourseCard } from '../../../components/ui/CourseCard';
import { BookOpen, Play, ChevronRight } from 'lucide-react';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader, SectionHeader } from '../../../components/ui/PageHeader';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';

export default function StudentCourses() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // enrollmentsAPI.getByStudent already joins the course object, so no separate fetch needed
    const { data: enrollments, loading } = useAsyncData(
        () => enrollmentsAPI.getByStudent(user.id),
        [user?.id]
    );

    const safeEnrollments = enrollments ?? [];
    const inProgress = safeEnrollments.filter(e => e.progress > 0 && e.progress < 100);

    // Fetch each in-progress course's lesson list so we can show "X/Y lessons
    // completed" and the title of the next lesson to continue from.
    const [courseLessons, setCourseLessons] = useState({});
    useEffect(() => {
        let cancelled = false;
        if (inProgress.length === 0) { setCourseLessons({}); return undefined; }
        Promise.all(inProgress.map(e =>
            coursesAPI.getLessons(e.courseId)
                .then(r => ({ courseId: e.courseId, lessons: r?.lessons || [] }))
                .catch(() => ({ courseId: e.courseId, lessons: [] }))
        )).then(results => {
            if (!cancelled) {
                const map = {};
                results.forEach(r => { map[r.courseId] = r.lessons; });
                setCourseLessons(map);
            }
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const continueRows = useMemo(() => {
        return inProgress.map(e => {
            const lessons = courseLessons[e.courseId] || [];
            const completedSet = new Set(e.completedLessons || []);
            const total = lessons.length || e.course?.lessonsCount || 0;
            const completed = lessons.filter(l => completedSet.has(l.id)).length || (e.completedLessons || []).length;
            const next = lessons.find(l => !completedSet.has(l.id)) || null;
            return {
                enrollment: e,
                course: e.course,
                total,
                completed,
                next,
            };
        }).sort((a, b) => b.enrollment.lastAccessed - a.enrollment.lastAccessed);
    }, [inProgress, courseLessons]);

    const enrolledCourses = safeEnrollments.map(e =>
        e.course ? {
            course: { ...e.course },
            enrollment: e  // pass full enrollment so CourseCard shows progress correctly
        } : null
    ).filter(Boolean);

    if (loading) return <LoadingContainer height="h-64" />;

    if (enrolledCourses.length === 0) {
        return (
            <EmptyState
                icon={BookOpen}
                message="You haven't enrolled in any courses yet. Explore our catalog to get started!"
                action={
                    <button onClick={() => navigate('/courses')} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">
                        Explore Courses
                    </button>
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="My Learning" subtitle="Jump back in and continue your progress" />

            {/* Continue Learning — rich resume rows */}
            {continueRows.length > 0 && (
                <div>
                    <SectionHeader
                        title="Continue Learning"
                        link={
                            <span className="text-indigo-600 text-sm font-medium flex items-center gap-1">
                                Resume anytime <ChevronRight size={16} />
                            </span>
                        }
                    />
                    <div className="space-y-3">
                        {continueRows.map(({ enrollment, course, total, completed, next }) => (
                            <div
                                key={enrollment.courseId}
                                onClick={() => navigate(`/courses/${enrollment.courseId}/learn`)}
                                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all cursor-pointer group"
                            >
                                {course?.thumbnail ? (
                                    <CourseThumbnail thumbnail={course.thumbnail} alt="" className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg object-cover shrink-0 bg-muted group-hover:scale-105 transition-transform" />
                                ) : (
                                    <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                                        <BookOpen size={24} className="text-muted-foreground/30" />
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                        <p className="text-foreground font-bold text-sm sm:text-base truncate group-hover:text-indigo-600 transition-colors">
                                            {course?.title}
                                        </p>
                                        <span className="text-sm font-black text-indigo-600 shrink-0">{enrollment.progress}%</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex-1"><ProgressBar value={enrollment.progress} /></div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                                        <span>{completed}/{total} lessons completed</span>
                                        {next ? (
                                            <span className="flex items-center gap-1 min-w-0">
                                                <span className="shrink-0">Next:</span>
                                                <span className="text-indigo-600 font-bold truncate">→ {next.title}</span>
                                            </span>
                                        ) : (
                                            <span className="text-emerald-600 font-bold">Almost there — finish the last lesson!</span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/courses/${enrollment.courseId}/learn`); }}
                                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-colors shrink-0"
                                >
                                    <Play size={15} /> Continue
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All enrolled courses grid */}
            <div>
                <SectionHeader title="All Courses" />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {enrolledCourses.map(({ course, enrollment }) => (
                        <CourseCard key={course.id} course={course} enrollment={enrollment} />
                    ))}
                </div>
            </div>
        </div>
    );
}
