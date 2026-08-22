import { Link, useNavigate } from 'react-router-dom';
import {
    BookOpen, Users, Star, PlusCircle, TrendingUp,
    ChevronRight, BarChart2, Eye, Clock, HelpCircle, FileText, Megaphone,
    ClipboardCheck, Calendar, Gauge, CalendarCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { statsAPI, coursesAPI } from '../../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RatingDisplay } from '../../components/ui/RatingStars';
import { StatCard, StatCardGrid, StatCardSkeleton } from '../../components/ui/StatCard';
import { CourseThumbnail } from '../../components/ui/CourseThumbnail';
import { PageHeader, SectionHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, MetricRow } from '../../components/ui/Card';
import { ChartTooltip, ChartCard } from '../../components/ui/ChartComponents';
import { EmptyState, StatusBadge } from '../../components/ui/Feedback';
import { useMultipleAsync } from '../../hooks/useAsyncData';
import { CHART_MARGIN, CHART_AXIS_STYLE } from '../../lib/constants';
import PullToRefresh from '../../components/ui/PullToRefresh';

export default function InstructorDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { results, loading, reload } = useMultipleAsync([
        () => statsAPI.getInstructor(user.id),
        () => coursesAPI.getByInstructor(user.id),
    ], [user.id]);

    const stats = results[0] || null;
    const courses = results[1] || [];

    const statCards = stats ? [
        { label: 'My Courses', value: stats.totalCourses, icon: BookOpen, color: '#4f46e5', bg: 'bg-indigo-50', change: `${stats.publishedCourses || 0} published · ${stats.pendingCourses || 0} pending`, showTrend: false, onClick: () => navigate('/instructor/courses') },
        { label: 'Total Students', value: stats.totalEnrollments?.toLocaleString(), icon: Users, color: '#0891b2', bg: 'bg-cyan-50', change: `+${stats.thisMonth?.enrollments || 0} this month`, showTrend: (stats.thisMonth?.enrollments > 0), onClick: () => navigate('/instructor/students') },
        { label: 'Pending Assignments', value: stats.pendingAssignments ?? 0, icon: ClipboardCheck, color: '#d97706', bg: 'bg-amber-50', change: stats.pendingAssignments ? 'Submissions awaiting grading' : 'All caught up', showTrend: (stats.pendingAssignments > 0), onClick: () => navigate('/instructor/assessments') },
        { label: 'Avg Course Completion', value: `${stats.avgCompletion ?? 0}%`, icon: Gauge, color: '#059669', bg: 'bg-emerald-50', change: 'Across all your students', showTrend: false },
    ] : [];

    return (
        <PullToRefresh onRefresh={reload}>
        <div className="space-y-6 sm:space-y-8 max-w-6xl w-full mx-auto px-0">
            <PageHeader
                title="Instructor Dashboard"
                subtitle="Track your courses and student performance"
                action={
                    <Link
                        to="/instructor/create-course"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[15px] font-bold flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <PlusCircle size={18} /> New Course
                    </Link>
                }
            />

            {loading ? <StatCardSkeleton /> : (
                <StatCardGrid>
                    {statCards.map(card => <StatCard key={card.label} {...card} />)}
                </StatCardGrid>
            )}

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                {/* Enrollments Chart */}
                <ChartCard
                    title="Monthly Enrollments"
                    className="lg:col-span-2"
                >
                    {stats?.monthlyEnrollments && stats.monthlyEnrollments.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.monthlyEnrollments} margin={CHART_MARGIN}>
                                <defs>
                                    <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0891b2" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="count" name="Enrollments" stroke="#0891b2" strokeWidth={3} fill="url(#enrollGrad)" activeDot={{ r: 6, fill: '#0891b2', stroke: '#fff', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-2">
                            <TrendingUp size={32} className="opacity-20" />
                            <p className="text-sm font-medium">No enrollment data available yet</p>
                        </div>
                    )}
                </ChartCard>

                {/* Side Panel */}
                <div className="space-y-4 sm:space-y-6">
                    <Card>
                        <CardHeader title="Course Status" icon={<BarChart2 size={20} className="text-indigo-600" />} />
                        <div className="space-y-4">
                            <MetricRow
                                label="Published"
                                value={<span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded text-sm font-bold">{stats?.publishedCourses || 0}</span>}
                            />
                            <MetricRow
                                label="Pending Review"
                                value={<span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded text-sm font-bold">{stats?.pendingCourses || 0}</span>}
                            />
                            <div className="h-px bg-border" />
                            <MetricRow
                                label={<span className="text-foreground font-bold">Total Courses</span>}
                                value={<span className="text-foreground font-bold text-lg">{stats?.totalCourses || 0}</span>}
                            />
                        </div>
                    </Card>

                    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                        <h3 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">Quick Actions</h3>
                        <div className="space-y-2">
                            {[
                                { to: '/instructor/create-course', icon: PlusCircle, label: 'Create New Course', color: 'text-indigo-600' },
                                { to: '/instructor/students', icon: Users, label: 'Manage Students', color: 'text-cyan-600' },
                                { to: '/instructor/live-sessions', icon: CalendarCheck, label: 'Take Attendance', color: 'text-emerald-600' },
                                { to: '/instructor/reviews', icon: Star, label: 'Course Reviews', color: 'text-amber-500' },
                            ].map(({ to, icon: Icon, label, color }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className="flex items-center gap-3 text-[15px] font-medium text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-card py-3 px-4 rounded-xl border border-transparent hover:border-border hover:shadow-sm transition-all"
                                >
                                    <Icon size={18} className={`${color} flex-shrink-0`} /> {label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Classes + Quizzes */}
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                <Card>
                    <CardHeader title="Upcoming Classes" icon={<Calendar size={20} className="text-indigo-600" />} />
                    <div className="space-y-3">
                        {loading ? (
                            <div className="h-24 animate-pulse bg-muted rounded-xl" />
                        ) : (stats?.upcomingSessions || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground/70 py-8 text-center font-medium">No upcoming live classes scheduled.</p>
                        ) : stats.upcomingSessions.map(s => (
                            <div key={s.id} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <Clock size={18} className="text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{s.title}</p>
                                    <p className="text-[11px] font-semibold text-muted-foreground truncate">{s.courseTitle}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-bold text-indigo-600">{s.session_date}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground">{s.start_time || 'TBA'}{s.end_time ? ` – ${s.end_time}` : ''}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <CardHeader title="Upcoming Quizzes" icon={<HelpCircle size={20} className="text-amber-600" />} />
                    <div className="space-y-3">
                        {loading ? (
                            <div className="h-24 animate-pulse bg-muted rounded-xl" />
                        ) : (stats?.upcomingQuizzes || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground/70 py-8 text-center font-medium">No quizzes created in your courses yet.</p>
                        ) : stats.upcomingQuizzes.map(q => (
                            <div key={q.id} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                                    <HelpCircle size={18} className="text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{q.title}</p>
                                    <p className="text-[11px] font-semibold text-muted-foreground truncate">{q.courseTitle}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-bold text-amber-600">{q.timeLimit} min</p>
                                    <p className="text-[10px] font-bold text-muted-foreground">Pass: {q.passingScore}% · {q.attempts} attempts</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Submissions + Announcements */}
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                <Card>
                    <CardHeader
                        title="Recent Submissions"
                        right={
                            <Link to="/instructor/assessments" className="text-indigo-600 text-xs font-bold hover:text-indigo-700 flex items-center gap-1">
                                Review all <ChevronRight size={14} />
                            </Link>
                        }
                    />
                    <div className="space-y-3">
                        {loading ? (
                            <div className="h-24 animate-pulse bg-muted rounded-xl" />
                        ) : (stats?.recentSubmissions || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground/70 py-8 text-center font-medium">No submissions yet — students will appear here.</p>
                        ) : stats.recentSubmissions.map(s => (
                            <div key={s.id} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <FileText size={18} className="text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{s.studentName}</p>
                                    <p className="text-[11px] font-semibold text-muted-foreground truncate">{s.assignmentTitle} · {s.courseTitle}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {s.marks != null ? (
                                        <p className="text-xs font-bold text-emerald-600">{s.marks} pts</p>
                                    ) : (
                                        <p className="text-xs font-bold text-amber-600">Needs grading</p>
                                    )}
                                    <p className="text-[10px] font-bold text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <CardHeader title="Recent Announcements" icon={<Megaphone size={20} className="text-rose-500" />} />
                    <div className="space-y-3">
                        {loading ? (
                            <div className="h-24 animate-pulse bg-muted rounded-xl" />
                        ) : (stats?.recentAnnouncements || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground/70 py-8 text-center font-medium">No announcements for your department yet.</p>
                        ) : stats.recentAnnouncements.map(a => (
                            <div key={a.id} className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                                    <Megaphone size={18} className="text-rose-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{a.title}</p>
                                    <p className="text-[11px] font-semibold text-muted-foreground line-clamp-1">{a.content}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] font-bold text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
                                    {a.pinned && <p className="text-[10px] font-bold text-rose-500 mt-0.5">📌 Pinned</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Courses */}
            <div>
                <SectionHeader
                    title="Recent Courses"
                    link={
                        <Link to="/instructor/courses" className="text-indigo-600 text-[15px] font-bold hover:text-indigo-700 flex items-center gap-1">
                            View all <ChevronRight size={16} />
                        </Link>
                    }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
                    {loading ? (
                        [1, 2, 3, 4].map(i => <div key={i} className="bg-card border border-border rounded-2xl h-[100px] animate-pulse" />)
                    ) : courses?.slice(0, 4).map(course => (
                        <div key={course.id} className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow group">
                            <CourseThumbnail thumbnail={course.thumbnail} title={course.title} className="w-14 h-12 sm:w-20 sm:h-16 rounded-lg object-cover border border-border flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-foreground font-bold text-[15px] truncate group-hover:text-indigo-600 transition-colors">{course.title}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                                    <span className="flex items-center gap-1.5"><Users size={14} className="text-muted-foreground/60" /> {course.enrollmentCount?.toLocaleString()} students</span>
                                    <div className="w-1 h-1 bg-border rounded-full" />
                                    <RatingDisplay rating={course.rating} />
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <StatusBadge status={course.status} />
                                <Link to={`/courses/${course.id}`} className="bg-muted/40 hover:bg-indigo-50 text-muted-foreground/60 hover:text-indigo-600 p-2 rounded-lg transition-colors border border-border hover:border-indigo-200">
                                    <Eye size={16} />
                                </Link>
                            </div>
                        </div>
                    ))}
                    {!loading && (!courses || courses.length === 0) && (
                        <div className="col-span-full">
                            <EmptyState
                                icon={BookOpen}
                                message="No courses created yet"
                                action={
                                    <Link to="/instructor/create-course" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-[15px] font-bold shadow-sm inline-flex items-center gap-2">
                                        <PlusCircle size={20} /> Create Your First Course
                                    </Link>
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
        </PullToRefresh>
    );
}
