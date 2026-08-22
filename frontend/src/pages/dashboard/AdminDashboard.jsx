import {
    Users, BookOpen, TrendingUp,
    ShieldCheck, AlertTriangle, ChevronRight, Activity, Gauge, GraduationCap,
    Building2, Award, Star, Presentation, CheckCircle, Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { statsAPI, usersAPI } from '../../services/api';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
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
        // Department-scoped admins get their own dept's usage vs limits for the
        // capacity visuals below. SUPER_ADMIN sees every dept — not meaningful
        // on this dashboard, so skip the request entirely.
        () => (isSuperAdmin ? Promise.resolve(null) : statsAPI.getAdminOverview().catch(() => null)),
        // Dept-admin dashboard aggregate: totals, recent activity, chart series.
        () => (isSuperAdmin ? Promise.resolve(null) : statsAPI.getDeptAdminDashboard().catch(() => null)),
    ], [isSuperAdmin]);

    const stats = results[0] || null;
    // getAuditLogs returns { data, total } — tolerate both shapes.
    const auditLogsRaw = results[1] || [];
    const auditLogs = Array.isArray(auditLogsRaw) ? auditLogsRaw : (auditLogsRaw.data || []);
    const instructorRequests = results[2] || [];
    const deptCapacity = results[3]?.data?.[0] || null;
    const deptDashboard = results[4] || null;
    const navigate = useNavigate();

    const statCards = stats ? (isSuperAdmin ? [
        { label: 'Total Users', value: stats.totalUsers?.toLocaleString(), icon: Users, color: '#4f46e5', bg: 'bg-indigo-50', change: `${stats.activeUsers?.toLocaleString() || 0} active`, to: '/admin/users' },
        { label: 'Total Departments', value: stats.totalDepartments, icon: Building2, color: '#0ea5e9', bg: 'bg-cyan-50', change: 'Academic departments', to: '/super-admin/departments' },
        { label: 'Department Admins', value: stats.totalAdmins, icon: ShieldCheck, color: '#f59e0b', bg: 'bg-amber-50', change: 'Managing departments', to: '/super-admin/admins' },
        { label: 'Total Students', value: stats.totalStudents?.toLocaleString(), icon: GraduationCap, color: '#6366f1', bg: 'bg-indigo-50', change: 'Enrolled learners', to: '/admin/users' },
        { label: 'Total Instructors', value: stats.totalInstructors, icon: Presentation, color: '#10b981', bg: 'bg-emerald-50', change: 'Course creators', to: '/admin/users' },
        { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${stats.approvedCourses || 0} published`, to: '/admin/courses' },
        { label: 'Active Courses', value: stats.activeCourses, icon: CheckCircle, color: '#059669', bg: 'bg-emerald-50', change: 'Published & live', to: '/admin/courses' },
        { label: 'Pending Approvals', value: stats.pendingApprovals, icon: AlertTriangle, color: '#e11d48', bg: 'bg-rose-50', change: 'Needs action', changeColor: '#e11d48', to: '/admin/courses?status=PENDING' },
        { label: 'Total Enrollments', value: stats.totalEnrollments?.toLocaleString(), icon: TrendingUp, color: '#059669', bg: 'bg-emerald-50', change: 'Course sign-ups', to: '/admin/student-progress' },
        { label: 'Completion Rate', value: `${stats.completionRate || 0}%`, icon: Award, color: '#f59e0b', bg: 'bg-amber-50', change: 'Courses completed', to: '/admin/student-progress' },
        { label: 'Active Users', value: stats.activeUsers?.toLocaleString(), icon: Activity, color: '#8b5cf6', bg: 'bg-violet-50', change: 'Not suspended', to: '/admin/users' },
        { label: 'Platform Rating', value: stats.avgRating?.toFixed(1) || '0.0', icon: Star, color: '#f59e0b', bg: 'bg-amber-50', change: 'Global avg course rating' },
    ] : (deptDashboard?.totals ? [
        { label: 'Total Students', value: deptDashboard.totals.totalStudents?.toLocaleString(), icon: GraduationCap, color: '#4f46e5', bg: 'bg-indigo-50', change: 'In this department', to: '/admin/students' },
        { label: 'Total Instructors', value: deptDashboard.totals.totalInstructors, icon: Presentation, color: '#10b981', bg: 'bg-emerald-50', change: 'Course creators', to: '/admin/users' },
        { label: 'Total Courses', value: deptDashboard.totals.totalCourses, icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${deptDashboard.totals.activeCourses} active`, to: '/admin/courses' },
        { label: 'Active Courses', value: deptDashboard.totals.activeCourses, icon: CheckCircle, color: '#059669', bg: 'bg-emerald-50', change: 'Published & live', to: '/admin/courses' },
        { label: 'Total Enrollments', value: deptDashboard.totals.totalEnrollments?.toLocaleString(), icon: TrendingUp, color: '#059669', bg: 'bg-emerald-50', change: 'Course sign-ups', to: '/admin/student-progress' },
        { label: 'Course Completion', value: `${deptDashboard.totals.courseCompletion}%`, icon: Award, color: '#f59e0b', bg: 'bg-amber-50', change: 'Enrollments finished', to: '/admin/student-progress' },
        { label: 'Pending Courses', value: deptDashboard.totals.pendingCourses, icon: AlertTriangle, color: '#e11d48', bg: 'bg-rose-50', change: 'Needs action', changeColor: '#e11d48', to: '/admin/courses?status=PENDING' },
    ] : [
        { label: 'Total Users', value: stats.totalUsers?.toLocaleString(), icon: Users, color: '#4f46e5', bg: 'bg-indigo-50', change: `${stats.studentGrowth >= 0 ? '+' : ''}${stats.studentGrowth || 0}% this month`, to: '/admin/users' },
        { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${stats.approvedCourses || 0} published`, to: '/admin/courses' },
        { label: 'Pending Approvals', value: stats.pendingCourses, icon: AlertTriangle, color: '#e11d48', bg: 'bg-rose-50', change: 'Needs action', changeColor: '#e11d48', to: '/admin/courses?status=PENDING' },
        { label: 'Total Enrollments', value: stats.totalEnrollments?.toLocaleString(), icon: TrendingUp, color: '#059669', bg: 'bg-emerald-50', change: `${stats.approvedCourses || 0} active courses`, to: '/admin/student-progress' },
    ])) : [];

    return (
        <PullToRefresh onRefresh={reload}>
        <div className="space-y-6 sm:space-y-8 max-w-7xl w-full mx-auto px-0">
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

            {loading ? <StatCardSkeleton count={isSuperAdmin ? 8 : 4} /> : (
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

            {/* Department capacity — shown to department-scoped admins when their
                dept is at/over its student or course quota. */}
            {deptCapacity && (deptCapacity.studentCount >= deptCapacity.maxStudents || deptCapacity.courseCount >= deptCapacity.maxCourses) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-amber-800 dark:text-amber-200">Department limit reached</p>
                        <p className="text-sm font-medium text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            {deptCapacity.studentCount >= deptCapacity.maxStudents
                                ? `${deptCapacity.departmentName} has ${deptCapacity.studentCount} students but the limit is ${deptCapacity.maxStudents}. You can't add more students until a Super Admin raises the limit.`
                                : `${deptCapacity.departmentName} has ${deptCapacity.courseCount} courses but the limit is ${deptCapacity.maxCourses}. You can't approve more courses until a Super Admin raises the limit.`}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/announcements')}
                        className="flex-shrink-0 text-[12px] font-bold px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
                    >
                        Contact Super Admin
                    </button>
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
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
                <div className="space-y-4 sm:space-y-6">
                    {/* Department Capacity */}
                    {deptCapacity && !isSuperAdmin && (
                        <Card>
                            <CardHeader title="Department Capacity" icon={<Gauge size={18} className="text-cyan-500" />} />
                            <div className="space-y-4">
                                {[
                                    { label: 'Students', used: deptCapacity.studentCount, max: deptCapacity.maxStudents, over: deptCapacity.studentCount >= deptCapacity.maxStudents },
                                    { label: 'Courses', used: deptCapacity.courseCount, max: deptCapacity.maxCourses, over: deptCapacity.courseCount >= deptCapacity.maxCourses },
                                ].map(bar => {
                                    const pct = bar.max > 0 ? Math.min(100, Math.round((bar.used / bar.max) * 100)) : 0;
                                    return (
                                        <div key={bar.label}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                                    {bar.label === 'Students' ? <GraduationCap size={14} className="text-cyan-500" /> : <BookOpen size={14} className="text-cyan-500" />}
                                                    {bar.label}
                                                </span>
                                                <span className={`text-sm font-bold ${bar.over ? 'text-rose-600' : 'text-muted-foreground'}`}>
                                                    {bar.used}/{bar.max}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${bar.over ? 'bg-rose-500' : 'bg-cyan-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                <p className="text-[11px] font-medium text-muted-foreground pt-1">
                                    Reach the limit and approvals/student additions are blocked until a Super Admin raises it.
                                </p>
                            </div>
                        </Card>
                    )}

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
                                { label: 'Enrollment Management', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', to: '/admin/enrollments' },
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

            {/* ── DEPARTMENT ADMIN: dept-scoped charts & recent lists ─────────── */}
            {!isSuperAdmin && deptDashboard && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Chart row 1 */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <ChartCard title="Students by Year">
                            {deptDashboard.charts?.studentsByYear?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptDashboard.charts.studentsByYear} margin={CHART_MARGIN}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="year" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }} />
                                        <Bar dataKey="count" name="Students" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={42} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<GraduationCap size={32} className="opacity-20" />} text="No year data yet — assign students a year" />
                            )}
                        </ChartCard>

                        <ChartCard title="Students by Section">
                            {deptDashboard.charts?.studentsBySection?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptDashboard.charts.studentsBySection} margin={CHART_MARGIN}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="section" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(8, 145, 178, 0.06)' }} />
                                        <Bar dataKey="count" name="Students" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={42} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<Layers size={32} className="opacity-20" />} text="No section data yet" />
                            )}
                        </ChartCard>
                    </div>

                    {/* Chart row 2 */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <ChartCard title="Course Enrollment">
                            {deptDashboard.charts?.courseEnrollment?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptDashboard.charts.courseEnrollment} margin={CHART_MARGIN}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="title" tick={{ ...CHART_AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={50} />
                                        <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} />
                                        <Bar dataKey="students" name="Students" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={42} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<TrendingUp size={32} className="opacity-20" />} text="No enrollments yet" />
                            )}
                        </ChartCard>

                        <ChartCard title="Course Completion">
                            {deptDashboard.charts?.courseCompletion?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptDashboard.charts.courseCompletion} margin={CHART_MARGIN}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="title" tick={{ ...CHART_AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={50} />
                                        <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} unit="%" />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.06)' }} />
                                        <Bar dataKey="completionRate" name="Completion %" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={42} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<Award size={32} className="opacity-20" />} text="No completion data yet" />
                            )}
                        </ChartCard>
                    </div>

                    {/* Chart row 3: instructor course count */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <ChartCard title="Instructor Course Count">
                            {deptDashboard.charts?.instructorCourseCount?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptDashboard.charts.instructorCourseCount} margin={CHART_MARGIN} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                        <XAxis type="number" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ ...CHART_AXIS_STYLE, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.06)' }} />
                                        <Bar dataKey="courses" name="Courses" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<Presentation size={32} className="opacity-20" />} text="No instructors yet" />
                            )}
                        </ChartCard>

                        <Card onClick={() => navigate('/admin/students')} title="Manage students">
                            <CardHeader title="Student Cohort Breakdown" icon={<GraduationCap size={18} className="text-indigo-500" />} />
                            <div className="space-y-4">
                                {(deptDashboard.charts?.studentsByYear?.length || deptDashboard.charts?.studentsBySection?.length) ? (
                                    <>
                                        <div className="flex flex-wrap gap-2">
                                            {(deptDashboard.charts?.studentsByYear || []).map(row => (
                                                <div key={row.year} className="flex-1 min-w-[90px] bg-muted/40 border border-border rounded-xl p-3 text-center">
                                                    <p className="text-lg font-black text-foreground">{row.count}</p>
                                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Year {row.year}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(deptDashboard.charts?.studentsBySection || []).map(row => (
                                                <div key={row.section} className="flex-1 min-w-[70px] bg-muted/40 border border-border rounded-xl p-3 text-center">
                                                    <p className="text-lg font-black text-foreground">{row.count}</p>
                                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Section {row.section}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-32 flex items-center justify-center text-muted-foreground/60">No cohort data yet</div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Recent students / instructors / courses */}
                    <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                        <Card>
                            <CardHeader title="Recent Students" icon={<GraduationCap size={18} className="text-indigo-500" />} />
                            <div className="space-y-3">
                                {deptDashboard.recent?.students?.length > 0 ? (
                                    deptDashboard.recent.students.map(u => (
                                        <div key={u.id} className="flex items-center gap-3">
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                                                    <GraduationCap size={15} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                                                <p className="text-xs font-medium text-muted-foreground truncate">
                                                    {[u.roll_no && `Roll ${u.roll_no}`, u.section && `Sec ${u.section}`].filter(Boolean).join(' · ') || u.email}
                                                </p>
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">{timeAgo(u.created_at)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No recent students</p>
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Recent Instructors" icon={<Presentation size={18} className="text-emerald-500" />} />
                            <div className="space-y-3">
                                {deptDashboard.recent?.instructors?.length > 0 ? (
                                    deptDashboard.recent.instructors.map(u => (
                                        <div key={u.id} className="flex items-center gap-3">
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                                                    <Presentation size={15} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                                                <p className="text-xs font-medium text-muted-foreground truncate">{u.email}</p>
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">{timeAgo(u.created_at)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No recent instructors</p>
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Recent Courses" icon={<BookOpen size={18} className="text-cyan-500" />} />
                            <div className="space-y-3">
                                {deptDashboard.recent?.courses?.length > 0 ? (
                                    deptDashboard.recent.courses.map(c => (
                                        <div key={c.id} className="flex items-center gap-3">
                                            {c.thumbnail ? (
                                                <img src={c.thumbnail} alt={c.title} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0">
                                                    <BookOpen size={15} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{c.title}</p>
                                                <p className="text-xs font-medium text-muted-foreground truncate">{c.instructor_name}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter flex-shrink-0 ${STATUS_BADGES[c.status] || STATUS_BADGES.DRAFT}`}>
                                                {c.status}
                                            </span>
                                            <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">{timeAgo(c.created_at)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No recent courses</p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── SUPER ADMIN: platform-wide stats, charts & recent lists ──────── */}
            {isSuperAdmin && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Monthly growth charts */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <ChartCard title="Monthly User Registrations" badge={
                            <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">Last 6 months</span>
                        }>
                            {stats?.monthlyUserRegistrations?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.monthlyUserRegistrations} margin={CHART_MARGIN}>
                                        <defs>
                                            <linearGradient id="userRegGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Area type="monotone" dataKey="count" name="Users" stroke="#4f46e5" strokeWidth={2.5} fill="url(#userRegGrad)" dot={{ fill: '#4f46e5', r: 4 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<Users size={32} className="opacity-20" />} text="No registration data" />
                            )}
                        </ChartCard>

                        <ChartCard title="Monthly Course Creation" badge={
                            <span className="text-[10px] font-black uppercase tracking-tighter text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-1 rounded-md">Last 6 months</span>
                        }>
                            {stats?.monthlyCourseCreation?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.monthlyCourseCreation} margin={CHART_MARGIN}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(8, 145, 178, 0.06)' }} />
                                        <Bar dataKey="count" name="Courses" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={42} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChart icon={<BookOpen size={32} className="opacity-20" />} text="No course creation data" />
                            )}
                        </ChartCard>
                    </div>

                    {/* Department charts (row 1) */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <ChartCard title="Students by Department">
                            {stats?.studentsByDepartment?.length > 0 ? (
                                <DeptBarChart data={stats.studentsByDepartment} />
                            ) : (
                                <EmptyChart icon={<GraduationCap size={32} className="opacity-20" />} text="No department data" />
                            )}
                        </ChartCard>
                        <ChartCard title="Instructors by Department">
                            {stats?.instructorsByDepartment?.length > 0 ? (
                                <DeptBarChart data={stats.instructorsByDepartment} />
                            ) : (
                                <EmptyChart icon={<Presentation size={32} className="opacity-20" />} text="No department data" />
                            )}
                        </ChartCard>
                    </div>

                    {/* Department charts (row 2) */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <ChartCard title="Courses by Department">
                            {stats?.coursesByDepartment?.length > 0 ? (
                                <DeptBarChart data={stats.coursesByDepartment} />
                            ) : (
                                <EmptyChart icon={<BookOpen size={32} className="opacity-20" />} text="No department data" />
                            )}
                        </ChartCard>
                        <ChartCard title="Enrollments by Department">
                            {stats?.enrollmentsByDepartment?.length > 0 ? (
                                <DeptBarChart data={stats.enrollmentsByDepartment} />
                            ) : (
                                <EmptyChart icon={<TrendingUp size={32} className="opacity-20" />} text="No department data" />
                            )}
                        </ChartCard>
                    </div>

                    {/* Course completion rate by department */}
                    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <h3 className="text-foreground font-bold text-base sm:text-lg">Course Completion Rate by Department</h3>
                            <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">% of enrollments finished</span>
                        </div>
                        {stats?.completionByDepartment?.length > 0 ? (
                            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
                                {stats.completionByDepartment.map((d, i) => (
                                    <div key={d.name}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-bold text-foreground/80">{d.name}</span>
                                            <span className="text-sm font-bold text-muted-foreground">{d.completionRate}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${Math.min(100, d.completionRate)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/40/50 rounded-xl border border-dashed border-border">
                                <Award size={32} className="opacity-20 mb-2" />
                                <p className="text-sm font-medium">No completion data</p>
                            </div>
                        )}
                    </div>

                    {/* Recently added users + recent courses */}
                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        <Card>
                            <CardHeader title="Recently Added Users" icon={<Users size={18} className="text-indigo-500" />} />
                            <div className="space-y-3">
                                {stats?.recentlyAddedUsers?.length > 0 ? (
                                    stats.recentlyAddedUsers.map(u => (
                                        <div key={u.id} className="flex items-center gap-3">
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                                                    <Users size={15} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                                                <p className="text-xs font-medium text-muted-foreground truncate">{u.email}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter flex-shrink-0 ${ROLE_BADGES[u.role] || ROLE_BADGES.STUDENT}`}>
                                                {u.role?.replace('_', ' ')}
                                            </span>
                                            <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">{timeAgo(u.createdAt)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No recent users</p>
                                )}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Recent Courses" icon={<BookOpen size={18} className="text-cyan-500" />} />
                            <div className="space-y-3">
                                {stats?.recentCourses?.length > 0 ? (
                                    stats.recentCourses.map(c => (
                                        <div key={c.id} className="flex items-center gap-3">
                                            {c.thumbnail ? (
                                                <img src={c.thumbnail} alt={c.title} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0">
                                                    <BookOpen size={15} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{c.title}</p>
                                                <p className="text-xs font-medium text-muted-foreground truncate">{c.instructorName}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter flex-shrink-0 ${STATUS_BADGES[c.status] || STATUS_BADGES.DRAFT}`}>
                                                {c.status}
                                            </span>
                                            <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">{timeAgo(c.createdAt)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No recent courses</p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
        </PullToRefresh>
    );
}

// ── Helpers (super admin dashboard) ───────────────────────────────────────────
const ROLE_BADGES = {
    STUDENT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    INSTRUCTOR: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    SUPER_ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const STATUS_BADGES = {
    PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
};

/** Horizontal bar chart for per-department series (names on the Y axis). */
function DeptBarChart({ data = [] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ ...CHART_AXIS_STYLE, fontSize: 11 }} axisLine={false} tickLine={false} width={96} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                    {data.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/** Empty-state placeholder used inside ChartCards. */
function EmptyChart({ icon, text }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/40/50 rounded-xl border border-dashed border-border">
            {icon}
            <p className="text-sm font-medium mt-2">{text}</p>
        </div>
    );
}
