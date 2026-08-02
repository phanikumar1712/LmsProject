import { TrendingUp, Users, BookOpen, Star, CheckCircle, AlertTriangle, Layers, Building2 } from 'lucide-react';
import { statsAPI } from '../../../services/api';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    ResponsiveContainer, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import { StatCard, StatCardGrid } from '../../../components/ui/StatCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ChartTooltip, ChartCard } from '../../../components/ui/ChartComponents';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { CHART_COLORS, CHART_MARGIN, CHART_AXIS_STYLE } from '../../../lib/constants';

export default function SuperAdminAnalytics() {
    const { data: stats, loading } = useAsyncData(() => statsAPI.getPlatform(), []);
    const { data: adminOverview } = useAsyncData(() => statsAPI.getAdminOverview(), []);
    const admins = adminOverview?.data || [];

    const kpis = stats ? [
        { label: 'Active Students', value: stats.activeStudents?.toLocaleString() || '0', icon: Users, color: '#4f46e5', bg: 'bg-indigo-50', change: `${stats.studentGrowth >= 0 ? '+' : ''}${stats.studentGrowth || 0}% this month` },
        { label: 'Total Courses', value: stats.totalCourses || '0', icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${stats.approvedCourses || 0} published` },
        { label: 'Platform Rating', value: stats.avgRating?.toFixed(1) || '0.0', icon: Star, color: '#f59e0b', bg: 'bg-amber-50', change: 'Global avg course rating' },
    ] : [];

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <LoadingContainer height="h-32" />
        </div>
    );

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto px-0 pb-12">
            <PageHeader
                title="Super Admin Analytics"
                subtitle="High-level overview of platform health and performance"
            />

            <StatCardGrid>
                {kpis.map(card => <StatCard key={card.label} {...card} />)}
            </StatCardGrid>

            {/* Enrollment + Student Charts */}
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                <ChartCard title="Monthly Enrollments">
                    {stats?.enrollmentsByMonth?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.enrollmentsByMonth} margin={CHART_MARGIN}>
                                <defs>
                                    <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="count" name="Enrollments" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#enrollGrad)" dot={{ fill: '#0ea5e9', r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/40/50 rounded-xl border border-dashed border-border">
                            <TrendingUp size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No enrollment data</p>
                        </div>
                    )}
                </ChartCard>

                <ChartCard title="Platform Overview">
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <BookOpen size={40} className="text-indigo-400 mb-4" />
                        <p className="text-foreground font-bold text-lg mb-2">All Courses Are Free 🎉</p>
                        <p className="text-muted-foreground font-medium text-sm max-w-sm">
                            The platform provides all courses at no cost. Focus on learning, not pricing.
                        </p>
                        <div className="flex gap-8 mt-6">
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-foreground">{stats?.totalCourses || 0}</p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Courses</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-foreground">{stats?.totalEnrollments?.toLocaleString() || 0}</p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Enrollments</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-foreground">{stats?.totalInstructors || 0}</p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Instructors</p>
                            </div>
                        </div>
                    </div>
                </ChartCard>
            </div>

            {/* Users by Role + Categories */}
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm">
                    <h3 className="text-foreground font-bold text-lg mb-6">Users by Role</h3>
                    {stats?.usersByRole?.length > 0 ? (
                        <div className="flex items-center gap-8">
                            <div className="h-44 w-44 flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={stats.usersByRole} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={3}>
                                            {stats.usersByRole.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-3">
                                {stats.usersByRole.map((item, i) => (
                                    <div key={item.role} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            <span className="text-foreground/80 font-medium text-sm">{item.role}</span>
                                        </div>
                                        <span className="text-foreground font-bold text-sm">{item.count.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-muted-foreground/60 bg-muted/40/50 rounded-xl border border-dashed border-border">
                            <Users size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No user data</p>
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <h3 className="text-foreground font-bold text-lg mb-6">Top Categories</h3>
                    {stats?.topCategories?.length > 0 ? (
                        <div className="space-y-4">
                            {stats.topCategories.map((cat, i) => {
                                const max = stats.topCategories[0].enrollments;
                                const pct = max > 0 ? Math.round((cat.enrollments / max) * 100) : 0;
                                return (
                                    <div key={cat.name}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-bold text-foreground/80">{cat.name}</span>
                                            <span className="text-sm font-bold text-muted-foreground">{cat.enrollments.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-muted-foreground/60 bg-muted/40/50 rounded-xl border border-dashed border-border">
                            <Layers size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No category data</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Per-Department overview */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-foreground font-bold text-lg mb-1 flex items-center gap-2">
                    <Building2 size={20} className="text-indigo-600" /> Department Limits Overview
                </h3>
                <p className="text-muted-foreground text-sm font-medium mb-6">
                    Students &amp; courses managed per department, against their limits.
                    All admins in a department share the same quota.
                    {adminOverview?.defaults ? ` Global defaults: ${adminOverview.defaults.maxStudents} students / ${adminOverview.defaults.maxCourses} courses.` : ''}
                </p>
                {admins.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                                    <th className="py-3 pr-4">Department</th>
                                    <th className="py-3 pr-4">Admins</th>
                                    <th className="py-3 pr-4">Students</th>
                                    <th className="py-3 pr-4">Courses</th>
                                    <th className="py-3 pr-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {admins.map(d => (
                                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-3 pr-4">
                                            <p className="font-bold text-foreground">{d.departmentName}</p>
                                        </td>
                                        <td className="py-3 pr-4 text-foreground/80 font-medium">{d.adminCount || 0}</td>
                                        <td className={`py-3 pr-4 font-bold ${d.studentsOver ? 'text-rose-600' : 'text-foreground/80'}`}>
                                            {d.studentCount}/{d.maxStudents}
                                            {d.maxStudentsOverride != null && (
                                                <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] font-black uppercase bg-cyan-100 text-cyan-700">Custom</span>
                                            )}
                                        </td>
                                        <td className={`py-3 pr-4 font-bold ${d.coursesOver ? 'text-rose-600' : 'text-foreground/80'}`}>
                                            {d.courseCount}/{d.maxCourses}
                                            {d.maxCoursesOverride != null && (
                                                <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] font-black uppercase bg-cyan-100 text-cyan-700">Custom</span>
                                            )}
                                        </td>
                                        <td className="py-3 pr-4">
                                            {d.studentsOver || d.coursesOver ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-rose-100 text-rose-700">
                                                    <AlertTriangle size={11} /> Over limit
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700">
                                                    <CheckCircle size={11} /> Within limit
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/40/50 rounded-xl border border-dashed border-border">
                        <Building2 size={32} className="opacity-20 mb-2" />
                        <p className="text-sm font-medium">No departments found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
