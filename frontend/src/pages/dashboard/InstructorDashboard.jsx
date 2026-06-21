import { Link } from 'react-router-dom';
import {
    BookOpen, Users, Star, DollarSign, TrendingUp, PlusCircle,
    ChevronRight, BarChart2, Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { statsAPI, coursesAPI } from '../../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RatingDisplay } from '../../components/ui/RatingStars';
import { StatCard, StatCardGrid, StatCardSkeleton } from '../../components/ui/StatCard';
import { PageHeader, SectionHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, MetricRow } from '../../components/ui/Card';
import { ChartTooltip, ChartCard } from '../../components/ui/ChartComponents';
import { EmptyState, StatusBadge } from '../../components/ui/Feedback';
import { useMultipleAsync } from '../../hooks/useAsyncData';
import { CHART_MARGIN, CHART_AXIS_STYLE } from '../../lib/constants';

export default function InstructorDashboard() {
    const { user } = useAuth();

    const { results, loading } = useMultipleAsync([
        () => statsAPI.getInstructor(user.id),
        () => coursesAPI.getByInstructor(user.id),
    ], [user.id]);

    const stats = results[0] || null;
    const courses = results[1] || [];

    const statCards = stats ? [
        { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: '#4f46e5', bg: 'bg-indigo-50', change: `+${stats.thisMonth?.newCourses || 0} this month`, showTrend: (stats.thisMonth?.newCourses > 0) },
        { label: 'Total Students', value: stats.totalEnrollments?.toLocaleString(), icon: Users, color: '#0891b2', bg: 'bg-cyan-50', change: `+${stats.thisMonth?.enrollments || 0} this month`, showTrend: (stats.thisMonth?.enrollments > 0) },
        { label: 'Avg Rating', value: `${stats.avgRating}/5`, icon: Star, color: '#d97706', bg: 'bg-amber-50', change: 'Live rating', showTrend: false },
        { label: 'Total Earnings', value: `₹${stats.earnings?.toLocaleString()}`, icon: DollarSign, color: '#059669', bg: 'bg-emerald-50', change: `+₹${stats.thisMonth?.earnings?.toLocaleString()} this month`, showTrend: (stats.thisMonth?.earnings > 0) },
    ] : [];

    return (
        <div className="space-y-8 max-w-6xl">
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

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Earnings Chart */}
                <ChartCard
                    title="Monthly Earnings"
                    badge={stats?.thisMonth?.earnings > 0 && <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-sm font-bold">+₹{stats.thisMonth.earnings.toLocaleString()} this month</span>}
                    className="lg:col-span-2"
                >
                    {stats?.monthlyEarnings && stats.monthlyEarnings.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.monthlyEarnings} margin={CHART_MARGIN}>
                                <defs>
                                    <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `₹${v.toLocaleString()}`} />
                                <Tooltip content={<ChartTooltip prefix="₹" />} />
                                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fill="url(#earningsGrad)" activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-2">
                            <DollarSign size={32} className="opacity-20" />
                            <p className="text-sm font-medium">No revenue data available yet</p>
                        </div>
                    )}
                </ChartCard>

                {/* Side Panel */}
                <div className="space-y-6">
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

                    <div className="bg-card border border-border rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-foreground mb-4">Quick Actions</h3>
                        <div className="space-y-2">
                            {[
                                { to: '/instructor/create-course', icon: PlusCircle, label: 'Create New Course', color: 'text-indigo-600' },
                                { to: '/instructor/students', icon: Users, label: 'Manage Students', color: 'text-cyan-600' },
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
                <div className="grid md:grid-cols-2 gap-6">
                    {loading ? (
                        [1, 2, 3, 4].map(i => <div key={i} className="bg-card border border-border rounded-2xl h-[100px] animate-pulse" />)
                    ) : courses?.slice(0, 4).map(course => (
                        <div key={course.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow group">
                            <img src={course.thumbnail} alt="" className="w-20 h-16 rounded-lg object-cover border border-border flex-shrink-0" />
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
    );
}
