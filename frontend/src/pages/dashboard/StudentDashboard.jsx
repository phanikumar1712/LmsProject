import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Award, Play, ClipboardList, Flame, ChevronRight, Target, FileText, Megaphone, CalendarClock, CheckCircle, CalendarCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { enrollmentsAPI, quizzesAPI, statsAPI, assignmentsAPI, announcementsAPI, attendanceAPI } from '../../services/api';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatCard, StatCardGrid, StatCardSkeleton } from '../../components/ui/StatCard';
import { PageHeader, SectionHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { CourseThumbnail } from '../../components/ui/CourseThumbnail';
import { useMultipleAsync } from '../../hooks/useAsyncData';
import PullToRefresh from '../../components/ui/PullToRefresh';

export default function StudentDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { results, loading, reload } = useMultipleAsync([
        () => enrollmentsAPI.getByStudent(user.id),
        () => quizzesAPI.getAttempts(user.id),
        () => statsAPI.getStudentStreak(),
        () => assignmentsAPI.getStudentOverview().catch(() => ({ upcoming: [], recentGrades: [] })),
        () => quizzesAPI.getAvailableExams().catch(() => []),
        () => announcementsAPI.list().catch(() => []),
        () => attendanceAPI.getMyAttendance(user.id).catch(() => []),
    ], [user?.id]);

    const [enrollments, attempts, streakData, assignOverview, availableExams, announcements, attendanceData] = results;
    const safeEnrollments = enrollments ?? [];
    const safeAttempts = attempts ?? [];
    const upcomingAssignments = assignOverview?.upcoming || [];
    const recentGrades = assignOverview?.recentGrades || [];
    const safeAnnouncements = announcements ?? [];

    // Attendance percentage per course — computed from the student's own
    // per-session records (present counts toward the %, matching the instructor
    // report formula: present / marked sessions).
    const attendanceByCourse = (() => {
        const map = {};
        (attendanceData ?? []).forEach(r => {
            if (!map[r.course_id]) {
                map[r.course_id] = { courseId: r.course_id, courseTitle: r.course_title || 'Course', present: 0, total: 0 };
            }
            map[r.course_id].total += 1;
            if (r.status === 'present') map[r.course_id].present += 1;
        });
        return Object.values(map)
            .map(c => ({ ...c, pct: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0 }))
            .sort((a, b) => b.pct - a.pct);
    })();

    // Assessments that are upcoming (starts in the future) or still open (not
    // yet attempted / within the availability window).
    const now = Date.now();
    const upcomingQuizzes = (availableExams || [])
        .filter(q => {
            if (q.startDate && new Date(q.startDate).getTime() > now) return true; // not started yet
            if (q.endDate && new Date(q.endDate).getTime() < now) return false;     // window closed
            return !q.attempted;                                                     // open & unattempted
        })
        .sort((a, b) => new Date(a.startDate || a.createdAt) - new Date(b.startDate || b.createdAt))
        .slice(0, 4);

    // Most recent grades: quiz scores first, then assignment marks.
    const recentQuizGrades = safeAttempts.slice(0, 3).map(a => ({
        key: `q-${a.id}`,
        label: a.quiz?.title || 'Quiz',
        course: a.course?.title || '',
        score: a.score,
        passed: a.passed,
        at: a.completedAt,
        type: 'quiz',
    }));
    const recentAssignmentGrades = (recentGrades || []).slice(0, 4).map(g => ({
        key: `a-${g.assignmentId}`,
        label: g.title,
        course: g.courseTitle || '',
        score: Math.round((g.marks / (g.maxMarks || 1)) * 100),
        passed: g.marks >= ((g.maxMarks || 1) * 0.5),
        at: g.gradedAt,
        type: 'assignment',
        detail: `${g.marks}/${g.maxMarks}`,
    }));
    const recentGradeItems = [...recentAssignmentGrades, ...recentQuizGrades].slice(0, 6);

    const ASSIGN_STATUS = {
        GRADED: { label: 'Graded', cls: 'bg-emerald-50 text-emerald-600' },
        SUBMITTED: { label: 'Submitted', cls: 'bg-blue-50 text-blue-600' },
        LATE: { label: 'Late', cls: 'bg-rose-50 text-rose-600' },
        NOT_STARTED: { label: 'Not Started', cls: 'bg-muted text-muted-foreground' },
        RESUBMISSION_REQUIRED: { label: 'Resubmission Required', cls: 'bg-amber-50 text-amber-700' },
    };
    const safeStreak = streakData ?? { streakDays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], activeStreak: [false, false, false, false, false, false, false], currentStreak: 0 };

    const completedCourses = safeEnrollments.filter(e => e.progress === 100);
    const inProgressCourses = safeEnrollments.filter(e => e.progress > 0 && e.progress < 100);
    const avgProgress = safeEnrollments.length > 0
        ? Math.round(safeEnrollments.reduce((acc, e) => acc + e.progress, 0) / safeEnrollments.length)
        : 0;

    const statCards = [
        { label: 'Enrolled Courses', value: safeEnrollments.length, icon: BookOpen, color: '#4f46e5', bg: 'bg-indigo-50' },
        { label: 'Completed', value: completedCourses.length, icon: Award, color: '#16a34a', bg: 'bg-emerald-50' },
        { label: 'Quiz Attempts', value: safeAttempts.length, icon: ClipboardList, color: '#0891b2', bg: 'bg-cyan-50' },
        { label: 'Avg Progress', value: `${avgProgress}%`, icon: Target, color: '#d97706', bg: 'bg-amber-50' },
    ];

    return (
        <PullToRefresh onRefresh={reload}>
        <div className="space-y-6 sm:space-y-8 max-w-6xl w-full mx-auto px-0">
            {/* Welcome Header */}
            <PageHeader
                title={`Welcome back, ${user?.name?.split(' ')[0] || 'Student'}! 👋`}
                subtitle={
                    inProgressCourses.length > 0
                        ? `You have ${inProgressCourses.length} course${inProgressCourses.length > 1 ? 's' : ''} in progress`
                        : 'Ready to start learning today?'
                }
                action={
                    <Link
                        to="/courses"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hidden md:flex items-center gap-2 shadow-sm"
                    >
                        <BookOpen size={16} /> Browse Courses
                    </Link>
                }
            />

            {/* Stat Cards */}
            {loading ? (
                <StatCardSkeleton count={4} />
            ) : (
                <StatCardGrid>
                    {statCards.map(card => <StatCard key={card.label} {...card} />)}
                </StatCardGrid>
            )}

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                {/* Continue Learning */}
                <div className="lg:col-span-2">
                    <SectionHeader
                        title="Continue Learning"
                        link={
                            <Link to="/student/courses" className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                View all <ChevronRight size={16} />
                            </Link>
                        }
                    />
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => <div key={i} className="bg-card border border-border rounded-xl h-28 animate-pulse" />)}
                        </div>
                    ) : inProgressCourses.length === 0 && safeEnrollments.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            message="You haven't enrolled in any courses yet."
                            action={
                                <Link to="/courses" className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
                                    Explore Courses
                                </Link>
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            {(inProgressCourses.length > 0 ? inProgressCourses : safeEnrollments).slice(0, 4).map(e => (
                                <div
                                    key={e.id}
                                    className="bg-card border border-border rounded-xl p-4 flex gap-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/courses/${e.courseId}/learn`)}
                                >
{e.course?.thumbnail ? (
                                         <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                                             <CourseThumbnail thumbnail={e.course.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                         </div>
                                    ) : (
                                        <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                                            <BookOpen size={24} className="text-muted-foreground/30" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <p className="text-foreground font-bold text-sm sm:text-base truncate mb-1 group-hover:text-indigo-600 transition-colors">{e.course?.title}</p>
                                        <p className="text-muted-foreground text-xs sm:text-sm mb-3 truncate">{e.course?.instructorName}</p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1"><ProgressBar value={e.progress} /></div>
                                            <span className="text-xs font-bold text-foreground">{e.progress}%</span>
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex items-center shrink-0">
                                        <button className="w-10 h-10 rounded-full bg-muted group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 border border-border group-hover:border-indigo-200 dark:group-hover:border-indigo-700 flex items-center justify-center transition-colors">
                                            <Play size={16} className="text-muted-foreground group-hover:text-indigo-600 ml-1 transition-colors" fill="currentColor" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Side Panel */}
                <div className="space-y-4 sm:space-y-6">
                    {/* Learning Streak */}
                    <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <h3 className="text-foreground font-bold text-sm sm:text-base">Learning Streak</h3>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-full text-amber-600 dark:text-amber-400">
                                <Flame size={14} fill="currentColor" />
                                <span className="text-xs sm:text-sm font-bold">{safeStreak.currentStreak} days</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center gap-0.5 sm:gap-1">
                            {safeStreak.streakDays.map((day, i) => (
                                <div key={i} className="flex flex-col items-center">
                                    <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 sm:mb-2 text-xs transition-colors ${safeStreak.activeStreak[i] ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 ring-2 ring-amber-200 ring-offset-1 dark:ring-offset-card' : 'bg-muted text-muted-foreground border border-border'}`}>
                                        {safeStreak.activeStreak[i] ? <Flame size={16} fill="currentColor" /> : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                                    </div>
                                    <span className="text-muted-foreground text-[11px] font-medium">{day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attendance per course */}
                    {attendanceByCourse.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
                            <SectionHeader title="Attendance" icon={<CalendarCheck size={16} className="text-cyan-500" />} />
                            <div className="space-y-3.5">
                                {attendanceByCourse.map(c => (
                                    <div key={c.courseId}>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="text-xs font-bold text-foreground truncate">{c.courseTitle}</p>
                                            <span className={`text-xs font-black shrink-0 ${c.pct >= 75 ? 'text-emerald-600' : c.pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{c.pct}%</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${c.pct >= 75 ? 'bg-emerald-500' : c.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                style={{ width: `${c.pct}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">{c.present}/{c.total} sessions attended</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Quizzes */}
                    {safeAttempts.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                            <SectionHeader
                                title="Recent Quizzes"
                                link={
                                    <Link to="/student/quizzes" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                                        View all
                                    </Link>
                                }
                            />
                            <div className="space-y-3">
                                {safeAttempts.slice(0, 3).map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <p className="text-foreground text-sm font-medium truncate">{a.quiz?.title || 'Knowledge Check'}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full flex-shrink-0 ${a.passed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                            {a.score}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Upcoming Assignments + Upcoming Quizzes */}
            {(upcomingAssignments.length > 0 || upcomingQuizzes.length > 0) && (
                <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 pt-2">
                    {upcomingAssignments.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                            <SectionHeader
                                title="Upcoming Assignments"
                                icon={<FileText size={16} className="text-orange-500" />}
                                link={
                                    <Link to="/courses" className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                        View all <ChevronRight size={16} />
                                    </Link>
                                }
                            />
                            <div className="space-y-2.5">
                                {upcomingAssignments.slice(0, 4).map(a => {
                                    const st = ASSIGN_STATUS[a.status] || ASSIGN_STATUS.NOT_STARTED;
                                    const overdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status === 'NOT_STARTED';
                                    return (
                                        <div key={a.id} onClick={() => navigate('/student/assignments')} className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/70 transition-colors cursor-pointer">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-foreground text-sm font-bold truncate">{a.title}</p>
                                                <p className="text-[11px] text-muted-foreground font-medium truncate">
                                                    {a.courseTitle} · Due {new Date(a.dueDate).toLocaleDateString()}
                                                    {overdue && <span className="text-rose-500 font-bold"> (overdue)</span>}
                                                </p>
                                            </div>
                                            <span className={`px-2.5 py-1 text-[10px] font-black rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {upcomingQuizzes.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                            <SectionHeader
                                title="Upcoming Quizzes"
                                icon={<CalendarClock size={16} className="text-purple-500" />}
                                link={
                                    <Link to="/student/quizzes" className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                        View all <ChevronRight size={16} />
                                    </Link>
                                }
                            />
                            <div className="space-y-2.5">
                                {upcomingQuizzes.map(q => (
                                    <div key={q.id} className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/70 transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-foreground text-sm font-bold truncate">{q.title}</p>
                                            <p className="text-[11px] text-muted-foreground font-medium truncate">
                                                {q.courseTitle}
                                                {q.startDate && new Date(q.startDate).getTime() > now
                                                    ? ` · Opens ${new Date(q.startDate).toLocaleDateString()}`
                                                    : q.endDate ? ` · Open until ${new Date(q.endDate).toLocaleDateString()}` : ''}
                                            </p>
                                        </div>
                                        <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-purple-50 text-purple-600 flex-shrink-0">
                                            {q.questionCount} Q
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent Grades + Recent Announcements */}
            {(recentGradeItems.length > 0 || safeAnnouncements.length > 0) && (
                <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 pt-2">
                    {recentGradeItems.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                            <SectionHeader
                                title="Recent Grades"
                                icon={<CheckCircle size={16} className="text-emerald-500" />}
                                link={
                                    <Link to="/student/quizzes" className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                        View all <ChevronRight size={16} />
                                    </Link>
                                }
                            />
                            <div className="space-y-2.5">
                                {recentGradeItems.map(g => (
                                    <div key={g.key} className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl hover:bg-muted/70 transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-foreground text-sm font-bold truncate">{g.label}</p>
                                            <p className="text-[11px] text-muted-foreground font-medium truncate">
                                                {g.course} · {g.type === 'assignment' ? 'Assignment' : 'Quiz'}
                                                {g.at ? ` · ${new Date(g.at).toLocaleDateString()}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className={`text-sm font-black ${g.passed ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {g.detail ? `${g.detail} (${g.score}%)` : `${g.score}%`}
                                            </p>
                                            <p className={`text-[10px] font-bold uppercase tracking-wide ${g.passed ? 'text-emerald-500' : 'text-rose-400'}`}>
                                                {g.passed ? 'Passed' : 'Needs work'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {safeAnnouncements.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                            <SectionHeader
                                title="Recent Announcements"
                                icon={<Megaphone size={16} className="text-amber-500" />}
                                link={
                                    <Link to="/announcements" className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                        View all <ChevronRight size={16} />
                                    </Link>
                                }
                            />
                            <div className="space-y-2.5">
                                {safeAnnouncements.slice(0, 4).map(a => (
                                    <div key={a.id} className="p-3 bg-muted/40 rounded-xl hover:bg-muted/70 transition-colors">
                                        <p className="text-foreground text-sm font-bold truncate">{a.title}</p>
                                        {a.content && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>}
                                        <p className="text-[10px] text-muted-foreground/70 mt-1 font-medium">{new Date(a.createdAt || a.created_at).toLocaleDateString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Completed Courses */}
            {completedCourses.length > 0 && (
                <div className="pt-6">
                    <SectionHeader
                        title="Completed Courses"
                        link={
                            <Link to="/student/certificates" className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                View Certificates <ChevronRight size={16} />
                            </Link>
                        }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                        {completedCourses.map(e => (
                            <div key={e.id} className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:shadow-sm transition-shadow cursor-pointer">
{e.course?.thumbnail ? (
                                     <CourseThumbnail thumbnail={e.course.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 bg-muted" />
                                 ) : (
                                     <div className="w-16 h-16 rounded-lg bg-muted shrink-0 flex items-center justify-center border border-border">
                                         <Award size={20} className="text-muted-foreground/30" />
                                    </div>
                                )}
                            <div className="flex-1 min-w-0">
                                <p className="text-foreground text-sm font-bold truncate mb-1.5">{e.course?.title}</p>
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[11px] font-bold uppercase tracking-wide">
                                        <Award size={12} /> Completed
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        </PullToRefresh>
    );
}
