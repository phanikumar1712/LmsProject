import {
    Users, BookOpen, TrendingUp,
    ShieldCheck, AlertTriangle, ChevronRight, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { statsAPI, usersAPI } from '../../services/api';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { StatCard, StatCardGrid, StatCardSkeleton } from '../../components/ui/StatCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { ChartTooltip, ChartCard } from '../../components/ui/ChartComponents';
import { useMultipleAsync } from '../../hooks/useAsyncData';
import { CHART_COLORS, CHART_MARGIN, CHART_AXIS_STYLE } from '../../lib/constants';
import PullToRefresh from '../../components/ui/PullToRefresh';

export default function AdminDashboard() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const { results, loading, reload } = useMultipleAsync([
        () => statsAPI.getPlatform(),
        () => (isSuperAdmin ? statsAPI.getAuditLogs() : Promise.resolve([])),
        () => usersAPI.getInstructorRequests().catch(() => []),
    ], [isSuperAdmin]);

    const stats = results[0] || null;
    const auditLogs = results[1] || [];
    const instructorRequests = results[2] || [];
    const navigate = useNavigate();

    const statCards = stats ? [
        { label: 'Total Users', value: stats.totalUsers?.toLocaleString(), icon: Users, color: '#4f46e5', bg: 'bg-indigo-50', change: `${stats.studentGrowth >= 0 ? '+' : ''}${stats.studentGrowth || 0}% this month`, to: '/admin/users' },
        { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${stats.approvedCourses || 0} published`, to: '/admin/courses' },
        { label: 'Pending Approvals', value: stats.pendingCourses, icon: AlertTriangle, color: '#e11d48', bg: 'bg-rose-50', change: 'Needs action', changeColor: '#e11d48', to: '/admin/courses?status=PENDING' },
        { label: 'Total Enrollments', value: stats.totalEnrollments?.toLocaleString(), icon: TrendingUp, color: '#059669', bg: 'bg-emerald-50', change: `${stats.approvedCourses || 0} active courses`, to: '/admin/student-progress' },
    ] : [];

    return (
        <PullToRefresh onRefresh={reload}>
        <div className="space-y-8 max-w-7xl w-full">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
                        {isSuperAdmin && (
                            <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wide flex items-center shadow-sm">
                                <ShieldCheck size={14} className="inline mr-1" /> Super
                            </span>
                        )}
                    </span>
                }
                subtitle="Platform overview and management"
            />

            {loading ? <StatCardSkeleton count={4} /> : (
                <StatCardGrid cols={4}>
                    {statCards.map(card => (
                        <StatCard
                            key={card.label}
                            {...card}
                            onClick={() => navigate(card.to)}
                            title={`View ${card.label} details`}
                        />
                    ))}
                </StatCardGrid>
            )}

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                        {/* Roles Pie */}
                        <Card onClick={() => navigate('/admin/users')} title="View all users">
                            <CardHeader title="Users by Role" />
                            {stats?.usersByRole && stats.usersByRole.length > 0 ? (
                                <div className="h-48 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={stats.usersByRole} dataKey="count" nameKey="role" cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={3}>
                                                {stats.usersByRole.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<ChartTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-foreground font-extrabold text-2xl">{stats.totalUsers?.toLocaleString()}</span>
                                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Total</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-48 flex items-center justify-center text-muted-foreground/60">No user data</div>
                            )}
                        </Card>

                        {/* Top Categories */}
                        <Card onClick={() => navigate('/admin/categories')} title="View categories">
                            <CardHeader title="Top Categories" />
                            <div className="space-y-4">
                                {stats?.topCategories && stats.topCategories.length > 0 ? (
                                    stats.topCategories.slice(0, 5).map((cat, i) => (
                                        <div key={cat.name} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">{i + 1}</div>
                                                <span className="text-foreground font-medium group-hover:text-indigo-600 transition-colors">{cat.name}</span>
                                            </div>
                                            <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-md text-xs font-bold">{cat.enrollments.toLocaleString()}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-8 text-center text-muted-foreground text-sm">No category data available</div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                    {/* Action Required */}
                    <Card accentColor="#f59e0b">
                        <CardHeader title="Action Required" icon={<AlertTriangle size={18} className="text-amber-500" />} className="pl-3" />
                        <div className="space-y-4">
                            {[
                                { title: 'Pending Courses', sub: `${stats?.pendingCourses || 0} awaiting approval`, btnClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200', btnText: 'Review', to: '/admin/courses' },
                                { title: 'Instructor Requests', sub: `${instructorRequests.length} pending application${instructorRequests.length === 1 ? '' : 's'}`, btnClass: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 hover:bg-rose-200', btnText: 'Check', to: '/admin/users' },
                            ].map(item => (
                                <div key={item.title} className="flex items-center justify-between bg-muted/30 border border-border p-4 rounded-xl hover:bg-muted hover:border-border transition-all shadow-sm">
                                    <div>
                                        <p className="font-bold text-foreground text-[15px]">{item.title}</p>
                                        <p className="text-sm font-medium text-muted-foreground mt-1">{item.sub}</p>
                                    </div>
                                    <button onClick={() => navigate(item.to)} className={`${item.btnClass} px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-sm`}>{item.btnText}</button>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Quick Links */}
                    <Card>
                        <CardHeader title="Quick Links" />
                        <div className="space-y-2">
                            {[
                                { label: 'Bulk Enrollment', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', to: '/admin/bulk-enroll' },
                                { label: 'Announcements', icon: BookOpen, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20', to: '/admin/announcements' },
                                { label: 'Student Progress', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', to: '/admin/student-progress' },
                                { label: 'Assignments', icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', to: '/admin/assignments' },
                                { label: 'Academic Calendar', icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', to: '/admin/timetable' },
                            ].map(link => (
                                <button key={link.label} onClick={() => navigate(link.to)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${link.bg}`}>
                                            <link.icon size={16} className={link.color} />
                                        </div>
                                        <span className="text-[15px] font-medium text-muted-foreground group-hover:text-indigo-600 transition-colors">{link.label}</span>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-indigo-500" />
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Super Admin: Recent Activity */}
                    {isSuperAdmin && (
                        <Card>
                            <CardHeader
                                title="Recent Activity"
                                icon={<Activity size={18} className="text-rose-500" />}
                                right={
                                    <button
                                        onClick={() => {
                                            const csv = "User,Action,Target,Timestamp,IP\n" +
                                                auditLogs.map(log => `"${log.userName}","${log.action}","${log.target}","${new Date(log.timestamp).toLocaleString()}",${log.ip}`).join("\n");
                                            const blob = new Blob([csv], { type: 'text/csv' });
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`;
                                            a.click();
                                        }}
                                        className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 hover:text-indigo-600 transition-colors"
                                    >
                                        Export CSV
                                    </button>
                                }
                            />
                            <div className="space-y-4">
                                {(auditLogs ?? []).slice(0, 4).map(log => (
                                    <div key={log.id} className="text-sm border-b border-border last:border-0 pb-4 last:pb-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-foreground font-bold">{log.userName}</span>
                                            <span className="text-muted-foreground font-medium text-xs">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">
                                                {log.action.replace('_', ' ')}
                                            </span>
                                            <span className="text-muted-foreground font-medium">{log.target}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
        </PullToRefresh>
    );
}
