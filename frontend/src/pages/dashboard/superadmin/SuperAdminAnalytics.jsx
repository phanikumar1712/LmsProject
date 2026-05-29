import { TrendingUp, Users, BookOpen, DollarSign } from 'lucide-react';
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

    const kpis = stats ? [
        { label: 'Total Revenue', value: stats.totalRevenue >= 100000 ? `₹${(stats.totalRevenue / 100000).toFixed(1)}L` : `₹${stats.totalRevenue?.toLocaleString()}`, icon: DollarSign, color: '#16a34a', bg: 'bg-emerald-50', change: `${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth || 0}% this month` },
        { label: 'Active Students', value: stats.activeStudents?.toLocaleString() || '0', icon: Users, color: '#4f46e5', bg: 'bg-indigo-50', change: `${stats.studentGrowth >= 0 ? '+' : ''}${stats.studentGrowth || 0}% this month` },
        { label: 'Total Courses', value: stats.totalCourses || '0', icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${stats.approvedCourses || 0} published` },
        { label: 'Platform Growth', value: `${stats.platformGrowth >= 0 ? '+' : ''}${stats.platformGrowth || 0}%`, icon: TrendingUp, color: '#d97706', bg: 'bg-amber-50', change: 'MoM growth rate' },
    ] : [];

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <LoadingContainer height="h-32" />
        </div>
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <PageHeader
                title="Super Admin Analytics"
                subtitle="High-level overview of platform health and performance"
            />

            <StatCardGrid>
                {kpis.map(card => <StatCard key={card.label} {...card} />)}
            </StatCardGrid>

            {/* Revenue + Enrollment Charts */}
            <div className="grid lg:grid-cols-2 gap-8">
                <ChartCard title="Monthly Revenue">
                    {stats?.monthlyRevenue?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.monthlyRevenue} margin={CHART_MARGIN}>
                                <defs>
                                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
                                <Tooltip content={<ChartTooltip prefix="₹" />} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#4f46e5', r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <DollarSign size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No revenue data</p>
                        </div>
                    )}
                </ChartCard>

                <ChartCard title="Monthly Enrollments">
                    {stats?.enrollmentsByMonth?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.enrollmentsByMonth} margin={CHART_MARGIN}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="count" name="Enrollments" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <TrendingUp size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No enrollment data</p>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* Users by Role + Categories */}
            <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-slate-900 font-bold text-lg mb-6">Users by Role</h3>
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
                                            <span className="text-slate-700 font-medium text-sm">{item.role}</span>
                                        </div>
                                        <span className="text-slate-900 font-bold text-sm">{item.count.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <Users size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No user data</p>
                        </div>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-slate-900 font-bold text-lg mb-6">Top Categories</h3>
                    {stats?.topCategories?.length > 0 ? (
                        <div className="space-y-4">
                            {stats.topCategories.map((cat, i) => {
                                const max = stats.topCategories[0].enrollments;
                                const pct = max > 0 ? Math.round((cat.enrollments / max) * 100) : 0;
                                return (
                                    <div key={cat.name}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-bold text-slate-700">{cat.name}</span>
                                            <span className="text-sm font-bold text-slate-500">{cat.enrollments.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                        <div className="h-44 flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <BookOpen size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No category data</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
