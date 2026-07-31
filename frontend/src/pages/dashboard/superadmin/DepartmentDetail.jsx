import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Building2, Users, BookOpen, Star, GraduationCap,
    ShieldCheck, TrendingUp, ArrowLeft, BarChart3, Layers, Save,
    UserCheck, Eye, ExternalLink, Gauge, Plus, X, Mail, Lock, User
} from 'lucide-react';
import { statsAPI, usersAPI, coursesAPI, departmentsAPI } from '../../../services/api';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import toast from 'react-hot-toast';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    ResponsiveContainer, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { CHART_COLORS, CHART_MARGIN, CHART_AXIS_STYLE } from '../../../lib/constants';
import { ChartTooltip, ChartCard } from '../../../components/ui/ChartComponents';

const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'admins', label: 'Admins', icon: ShieldCheck },
    { key: 'instructors', label: 'Instructors', icon: GraduationCap },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'categories', label: 'Categories', icon: Layers },
    { key: 'courses', label: 'Courses', icon: BookOpen },
    { key: 'reports', label: 'Reports', icon: TrendingUp },
];

// ─── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ dept, deptStats }) {
    const [savingLimits, setSavingLimits] = useState(false);
    const [showLimitsEditor, setShowLimitsEditor] = useState(false);

    // Derive limit defaults from department data
    const limitFormDefaults = useMemo(() => ({
        maxStudents: dept?.maxStudentsOverride ?? '',
        maxCourses: dept?.maxCoursesOverride ?? '',
    }), [dept?.maxStudentsOverride, dept?.maxCoursesOverride]);
    const [limitForm, setLimitForm] = useState(limitFormDefaults);

    const handleSaveLimits = async () => {
        setSavingLimits(true);
        try {
            await departmentsAPI.updateLimits(dept.id, {
                maxStudents: limitForm.maxStudents === '' ? null : Number(limitForm.maxStudents),
                maxCourses: limitForm.maxCourses === '' ? null : Number(limitForm.maxCourses),
            });
            toast.success('Department limits updated!');
            setShowLimitsEditor(false);
        } catch (err) {
            toast.error(err.message || 'Failed to update limits');
        } finally {
            setSavingLimits(false);
        }
    };

    const stats = deptStats;
    const kpiCards = stats ? [
        { label: 'Active Students', value: stats.activeStudents?.toLocaleString() || stats.totalEnrollments?.toLocaleString() || '0', icon: Users, color: '#4f46e5', bg: 'bg-indigo-50', change: 'Currently enrolled' },
        { label: 'Total Enrollments', value: stats.totalEnrollments?.toLocaleString() || '0', icon: TrendingUp, color: '#16a34a', bg: 'bg-emerald-50', change: `${stats.studentGrowth >= 0 ? '+' : ''}${stats.studentGrowth || 0}% this month` },
        { label: 'Courses', value: `${dept.coursePublished}/${dept.courseTotal}`, icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50', change: `${dept.coursePending || 0} pending approval` },
        { label: 'Rating', value: dept.avgRating?.toFixed(1) || '—', icon: Star, color: '#f59e0b', bg: 'bg-amber-50', change: 'Avg course rating' },
    ] : [];

    return (
        <div className="space-y-6">
            {/* Limits Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
                        <Gauge size={16} className="text-cyan-500" /> Department Limits
                    </h4>
                    <button
                        onClick={() => setShowLimitsEditor(!showLimitsEditor)}
                        className="text-xs font-bold text-cyan-600 hover:text-cyan-700 px-3 py-1.5 rounded-lg hover:bg-cyan-50 transition-colors"
                    >
                        {showLimitsEditor ? 'Cancel' : 'Edit Limits'}
                    </button>
                </div>
                {showLimitsEditor ? (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground/70 font-medium mb-2">
                            All admins in this department share these limits. Leave blank to inherit the platform default.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Max Students</label>
                                <input
                                    type="number" min="0"
                                    placeholder="Platform default"
                                    value={limitForm.maxStudents}
                                    onChange={e => setLimitForm(f => ({ ...f, maxStudents: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Max Courses</label>
                                <input
                                    type="number" min="0"
                                    placeholder="Platform default"
                                    value={limitForm.maxCourses}
                                    onChange={e => setLimitForm(f => ({ ...f, maxCourses: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm font-medium"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveLimits}
                            disabled={savingLimits}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
                        >
                            {savingLimits ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                            {savingLimits ? 'Saving...' : 'Save Limits'}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <GraduationCap size={16} className="text-indigo-500" />
                            <span className="text-sm font-bold text-foreground">
                                Students: <span className="text-indigo-600">{dept.studentCount?.toLocaleString() || 0}</span>
                                <span className="text-muted-foreground"> / {dept.maxStudentsOverride ?? 'Default'}</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BookOpen size={16} className="text-cyan-500" />
                            <span className="text-sm font-bold text-foreground">
                                Courses: <span className="text-cyan-600">{dept.courseTotal || dept.coursePublished || 0}</span>
                                <span className="text-muted-foreground"> / {dept.maxCoursesOverride ?? 'Default'}</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map(card => (
                    <div key={card.label} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                                <card.icon size={18} style={{ color: card.color }} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground mb-0.5">{card.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{card.label}</p>
                        {card.change && <p className="text-[10px] font-bold text-muted-foreground/50 mt-0.5">{card.change}</p>}
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
                <ChartCard title="Enrollment Trend">
                    {stats?.enrollmentsByMonth?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.enrollmentsByMonth} margin={CHART_MARGIN}>
                                <defs>
                                    <linearGradient id={`enrollGrad-${dept.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="count" name="Enrollments" stroke="#0ea5e9" strokeWidth={2.5} fill={`url(#enrollGrad-${dept.id})`} dot={{ fill: '#0ea5e9', r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60">
                            <TrendingUp size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No enrollment trend data</p>
                        </div>
                    )}
                </ChartCard>

                <ChartCard title="Enrollment Growth">
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
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60">
                            <TrendingUp size={32} className="opacity-20 mb-2" />
                            <p className="text-sm font-medium">No enrollment data</p>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* Users by Role + Categories */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <h4 className="font-bold text-foreground text-sm mb-4 flex items-center gap-2">
                        <UserCheck size={16} className="text-indigo-500" /> Users by Role
                    </h4>
                    {stats?.usersByRole?.length > 0 ? (
                        <div className="flex items-center gap-6">
                            <div className="h-36 w-36 flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={stats.usersByRole} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={65} innerRadius={40} paddingAngle={3}>
                                            {stats.usersByRole.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-2.5">
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
                        <div className="h-36 flex items-center justify-center text-muted-foreground/60">
                            <Users size={28} className="opacity-20 mb-1" />
                            <p className="text-sm font-medium">No user data</p>
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <h4 className="font-bold text-foreground text-sm mb-4 flex items-center gap-2">
                        <Layers size={16} className="text-purple-500" /> Top Categories
                    </h4>
                    {stats?.topCategories?.length > 0 ? (
                        <div className="space-y-3.5">
                            {stats.topCategories.map((cat, i) => {
                                const max = stats.topCategories[0]?.enrollments || 1;
                                const pct = Math.round((cat.enrollments / max) * 100);
                                return (
                                    <div key={cat.name}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-bold text-foreground/80">{cat.name}</span>
                                            <span className="text-sm font-bold text-muted-foreground">{cat.enrollments.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-36 flex items-center justify-center text-muted-foreground/60">
                            <Layers size={28} className="opacity-20 mb-1" />
                            <p className="text-sm font-medium">No category data</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ dept }) {
    const { data: users, loading } = useAsyncData(
        () => usersAPI.getAll({ departmentId: dept.id, limit: 100 }),
        [dept.id]
    );

    const userList = Array.isArray(users) ? users : users?.data || [];

    if (loading) return <LoadingContainer height="h-48" />;

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                    <Users size={16} /> All Users ({userList.length})
                </h4>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium">
                        {dept.studentCount} students · {dept.instructorCount} instructors · {dept.adminCount} admins
                    </span>
                    <Link
                        to={`/admin/users?departmentId=${dept.id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                    >
                        <ExternalLink size={12} /> Manage
                    </Link>
                </div>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {userList.slice(0, 50).map(user => (
                    <Link key={user.id} to={`/admin/users/${user.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-xl object-cover border border-border" />
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                                {user.name?.charAt(0)?.toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">{user.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${
                            user.role === 'STUDENT' ? 'bg-indigo-100 text-indigo-700' :
                            user.role === 'INSTRUCTOR' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-amber-100 text-amber-700'
                        }`}>{user.role}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${
                            user.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                        }`}>{user.active !== false ? 'Active' : 'Suspended'}</span>
                    </Link>
                ))}
                {userList.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                        No users in this department
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Courses Tab ───────────────────────────────────────────────────────────────
function CoursesTab({ dept }) {
    const { data: raw, loading } = useAsyncData(
        () => coursesAPI.getAll({ admin: true, departmentId: dept.id, limit: 100 }),
        [dept.id]
    );

    const courses = useMemo(() => {
        if (!Array.isArray(raw)) return [];
        return raw;
    }, [raw]);

    const statusColors = {
        PUBLISHED: 'bg-emerald-100 text-emerald-700',
        PENDING: 'bg-amber-100 text-amber-700',
        DRAFT: 'bg-muted text-muted-foreground',
        REJECTED: 'bg-rose-100 text-rose-700',
    };

    if (loading) return <LoadingContainer height="h-48" />;

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                    <BookOpen size={16} /> Courses ({dept.courseTotal})
                </h4>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium">
                        {dept.coursePublished} published · {dept.coursePending} pending
                    </span>
                    <Link
                        to={`/admin/courses?departmentId=${dept.id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                    >
                        <ExternalLink size={12} /> Manage
                    </Link>
                </div>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {courses.slice(0, 50).map(course => (
                    <Link key={course.id} to={`/courses/${course.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group">
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
                                {course.instructorName} · {course.categoryName || 'Uncategorized'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${statusColors[course.status] || 'bg-muted text-muted-foreground'}`}>
                                {course.status}
                            </span>
                        </div>
                    </Link>
                ))}
                {courses.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                        No courses found in this department
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({ dept, deptStats }) {
    if (!deptStats) return <LoadingContainer height="h-48" />;

    const stats = deptStats;
    const metrics = [
        { label: 'Active Students', value: stats.activeStudents?.toLocaleString() || stats.totalEnrollments?.toLocaleString() || '0', sub: 'Currently enrolled', color: 'text-indigo-600' },
        { label: 'Total Enrollments', value: stats.totalEnrollments?.toLocaleString() || '0', sub: 'Across all courses', color: 'text-emerald-600' },
        { label: 'Total Courses', value: dept.courseTotal?.toLocaleString() || '0', sub: 'All statuses', color: 'text-cyan-600' },
        { label: 'Platform Rating', value: stats.avgRating?.toFixed(1) || '—', sub: 'Out of 5.0', color: 'text-amber-500' },
        { label: 'Instructors', value: dept.instructorCount?.toLocaleString() || '0', sub: 'Active instructors', color: 'text-emerald-600' },
        { label: 'Pending Courses', value: stats.pendingCourses || dept.coursePending || '0', sub: 'Awaiting approval', color: 'text-orange-600' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.map(m => (
                    <div key={m.label} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-indigo-200 transition-colors">
                        <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                        <p className="text-[11px] font-bold text-foreground/80 mt-0.5">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-medium">{m.sub}</p>
                    </div>
                ))}
            </div>

            {/* Quick actions */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                    <Eye size={16} className="text-indigo-500" /> Quick Actions
                </h4>
                <div className="flex flex-wrap gap-3">
                    <Link
                        to={`/admin/reports?departmentId=${dept.id}`}
                        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                        <BarChart3 size={16} /> View Full Reports
                    </Link>
                    <Link
                        to={`/admin/users?departmentId=${dept.id}`}
                        className="inline-flex items-center gap-2 bg-cyan-50 text-cyan-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-100 transition-colors border border-cyan-200"
                    >
                        <Users size={16} /> Manage Users
                    </Link>
                    <Link
                        to={`/admin/courses?departmentId=${dept.id}`}
                        className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors border border-amber-200"
                    >
                        <BookOpen size={16} /> Browse Courses
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ─── Admins Tab ────────────────────────────────────────────────────────────────
function AdminsTab({ dept }) {
    const { data: deptAdmins, loading, reload } = useAsyncData(
        () => usersAPI.getAll({ role: 'ADMIN', departmentId: dept.id, limit: 100 }),
        [dept.id]
    );

    const [showCreateAdmin, setShowCreateAdmin] = useState(false);
    const [createAdminForm, setCreateAdminForm] = useState({ name: '', email: '', password: '' });
    const [creatingAdmin, setCreatingAdmin] = useState(false);

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        if (!createAdminForm.password || createAdminForm.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setCreatingAdmin(true);
        try {
            await usersAPI.inviteAdmin({
                name: createAdminForm.name,
                email: createAdminForm.email,
                password: createAdminForm.password,
                role: 'ADMIN',
                departmentIds: [dept.id],
            });
            toast.success(`Admin "${createAdminForm.name}" created for ${dept.name}`);
            setShowCreateAdmin(false);
            setCreateAdminForm({ name: '', email: '', password: '' });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create admin');
        } finally {
            setCreatingAdmin(false);
        }
    };

    const [adminExtraDepts, setAdminExtraDepts] = useState({});

    useEffect(() => {
        const list = Array.isArray(deptAdmins) ? deptAdmins : deptAdmins?.data || [];
        if (list.length > 0 && Object.keys(adminExtraDepts).length === 0) {
            const fetchExtra = async () => {
                const result = {};
                await Promise.all(list.slice(0, 20).map(async (admin) => {
                    try {
                        const depts = await usersAPI.getUserDepartments(admin.id);
                        if (Array.isArray(depts) && depts.length > 0) {
                            result[admin.id] = depts;
                        }
                    } catch { /* ignore */ }
                }));
                setAdminExtraDepts(result);
            };
            fetchExtra();
        }
    }, [deptAdmins]);

    const adminList = Array.isArray(deptAdmins) ? deptAdmins : deptAdmins?.data || [];

    if (loading) return <LoadingContainer height="h-48" />;

    const inputCls = 'w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium';

    return (
        <>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                        <ShieldCheck size={16} /> Admins ({dept.adminCount})
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCreateAdmin(true)}
                            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                            <Plus size={14} /> Create Admin
                        </button>
                        <Link
                            to={`/super-admin/admins`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                        >
                            <ExternalLink size={12} /> Manage All
                        </Link>
                    </div>
                </div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                    {adminList.slice(0, 50).map(admin => {
                        const extraDepts = adminExtraDepts[admin.id] || [];
                        return (
                            <div key={admin.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                <Link to={`/admin/users/${admin.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                                {admin.avatar ? (
                                    <img src={admin.avatar} alt={admin.name} className="w-9 h-9 rounded-xl object-cover border border-border" />
                                ) : (
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white text-sm font-bold">
                                        {admin.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">{admin.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{admin.email}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700">
                                            {admin.role}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${admin.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                                            {admin.active !== false ? 'Active' : 'Suspended'}
                                        </span>
                                        {extraDepts.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700">
                                                +{extraDepts.length} depts
                                            </span>
                                        )}
                                    </div>
                                </div>
                                </Link>
                                <Link
                                    to={`/super-admin/admins`}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold whitespace-nowrap"
                                >
                                    Manage
                                </Link>
                            </div>
                        );
                    })}
                    {adminList.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                            No admins assigned to this department
                        </div>
                    )}
                </div>
            </div>

            {/* Create Admin Modal */}
            {showCreateAdmin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <ShieldCheck size={20} className="text-amber-600" /> Admin for {dept.name}
                            </h3>
                            <button onClick={() => setShowCreateAdmin(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAdmin} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Full Name *</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input required type="text" placeholder="e.g. Alex Rivera" value={createAdminForm.name}
                                        onChange={e => setCreateAdminForm(f => ({ ...f, name: e.target.value }))}
                                        className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Email Address *</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input required type="email" placeholder="alex@example.com" value={createAdminForm.email}
                                        onChange={e => setCreateAdminForm(f => ({ ...f, email: e.target.value }))}
                                        className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Password *</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input required type="password" placeholder="Min. 8 characters" value={createAdminForm.password}
                                        onChange={e => setCreateAdminForm(f => ({ ...f, password: e.target.value }))}
                                        className={inputCls} />
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 font-medium ml-1">The admin will be auto-assigned to {dept.name} department.</p>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowCreateAdmin(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creatingAdmin}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98]">
                                    {creatingAdmin ? 'Creating...' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({ dept }) {
    const { data: allCategories, loading } = useAsyncData(() => statsAPI.getCategories(), []);

    const deptCategories = useMemo(() => {
        if (!allCategories) return [];
        return allCategories.filter(cat => cat.departmentId === dept.id);
    }, [allCategories, dept.id]);

    if (loading) return <LoadingContainer height="h-48" />;

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                    <Layers size={16} /> Subject Categories ({deptCategories.length})
                </h4>
                <Link
                    to={`/admin/categories`}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                >
                    <ExternalLink size={12} /> Manage
                </Link>
            </div>
            <div className="divide-y divide-border">
                {deptCategories.length > 0 ? (
                    deptCategories.map(cat => {
                        const colorIdx = deptCategories.indexOf(cat) % CHART_COLORS.length;
                        return (
                            <Link
                                key={cat.id}
                                to={`/super-admin/categories/${cat.id}?departmentId=${dept.id}`}
                                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                            >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: CHART_COLORS[colorIdx] + '20' }}>
                                    {cat.icon || '📚'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground group-hover:text-indigo-600 transition-colors">{cat.name}</p>
                                    <p className="text-[11px] text-muted-foreground/70 font-medium">
                                        {cat.courseCount || 0} courses
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                                    style={{ backgroundColor: CHART_COLORS[colorIdx] + '15', color: CHART_COLORS[colorIdx] }}>
                                    <BookOpen size={12} /> {cat.courseCount || 0} courses
                                </span>
                            </Link>
                        );
                    })
                ) : (
                    <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                        <Layers size={32} className="opacity-20 mx-auto mb-2" />
                        <p>No categories assigned to this department</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Instructors Tab ───────────────────────────────────────────────────────────
function InstructorsTab({ dept }) {
    const { data: instructors, loading, reload } = useAsyncData(
        () => usersAPI.getAll({ role: 'INSTRUCTOR', departmentId: dept.id, limit: 100 }),
        [dept.id]
    );

    const [showCreateInstructor, setShowCreateInstructor] = useState(false);
    const [createInstructorForm, setCreateInstructorForm] = useState({ name: '', email: '', password: '' });
    const [creatingInstructor, setCreatingInstructor] = useState(false);

    const handleCreateInstructor = async (e) => {
        e.preventDefault();
        if (!createInstructorForm.password || createInstructorForm.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setCreatingInstructor(true);
        try {
            await usersAPI.createInstructor({
                name: createInstructorForm.name,
                email: createInstructorForm.email,
                password: createInstructorForm.password,
                departmentId: dept.id,
            });
            toast.success(`Instructor "${createInstructorForm.name}" created for ${dept.name}`);
            setShowCreateInstructor(false);
            setCreateInstructorForm({ name: '', email: '', password: '' });
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create instructor');
        } finally {
            setCreatingInstructor(false);
        }
    };

    const instructorList = Array.isArray(instructors) ? instructors : instructors?.data || [];

    if (loading) return <LoadingContainer height="h-48" />;

    const inputCls = 'w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium';

    return (
        <>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                        <GraduationCap size={16} /> Instructors ({dept.instructorCount || instructorList.length})
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCreateInstructor(true)}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                            <Plus size={14} /> Create Instructor
                        </button>
                        <Link
                            to={`/admin/users?role=INSTRUCTOR&departmentId=${dept.id}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                        >
                            <ExternalLink size={12} /> Manage
                        </Link>
                    </div>
                </div>
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                    {instructorList.length > 0 ? (
                        instructorList.map(instructor => (
                            <div key={instructor.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                                <Link to={`/admin/users/${instructor.id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                                {instructor.avatar ? (
                                    <img src={instructor.avatar} alt={instructor.name} className="w-11 h-11 rounded-xl object-cover border border-border" />
                                ) : (
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                                        {instructor.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">{instructor.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{instructor.email}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                                            instructor.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                                        }`}>
                                            {instructor.active !== false ? 'Active' : 'Suspended'}
                                        </span>
                                        {instructor.rollNo && (
                                            <span className="text-[10px] font-mono font-bold text-muted-foreground/60">
                                                {instructor.rollNo}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                </Link>
                                <Link
                                    to={`/instructor/${instructor.id}`}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold whitespace-nowrap"
                                >
                                    View Profile
                                </Link>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                            <GraduationCap size={32} className="opacity-20 mx-auto mb-2" />
                            <p>No instructors in this department</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Instructor Modal */}
            {showCreateInstructor && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <GraduationCap size={20} className="text-emerald-600" /> Instructor for {dept.name}
                            </h3>
                            <button onClick={() => setShowCreateInstructor(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateInstructor} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Full Name *</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input required type="text" placeholder="e.g. Jane Smith" value={createInstructorForm.name}
                                        onChange={e => setCreateInstructorForm(f => ({ ...f, name: e.target.value }))}
                                        className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Email Address *</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input required type="email" placeholder="jane@example.com" value={createInstructorForm.email}
                                        onChange={e => setCreateInstructorForm(f => ({ ...f, email: e.target.value }))}
                                        className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Password *</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input required type="password" placeholder="Min. 8 characters" value={createInstructorForm.password}
                                        onChange={e => setCreateInstructorForm(f => ({ ...f, password: e.target.value }))}
                                        className={inputCls} />
                                </div>
                                <p className="text-[11px] text-muted-foreground/70 font-medium ml-1">The instructor will be auto-assigned to {dept.name} department.</p>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowCreateInstructor(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creatingInstructor}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-none transition-all active:scale-[0.98]">
                                    {creatingInstructor ? 'Creating...' : 'Create Instructor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Main Department Detail Page ───────────────────────────────────────────────
export default function DepartmentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    // Fetch all departments to find the selected one + its stats
    const { data: departments, loading: deptsLoading } = useAsyncData(() => statsAPI.getDepartments(), []);
    const { data: deptStats, loading: statsLoading } = useAsyncData(
        () => statsAPI.getPlatform({ departmentId: id }),
        [id]
    );

    const dept = useMemo(() => {
        if (!departments) return null;
        return departments.find(d => d.id === id) || null;
    }, [departments, id]);

    if (deptsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingContainer height="h-32" />
            </div>
        );
    }

    if (!dept) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Building2 size={64} className="text-muted-foreground/20 mb-4" />
                <h2 className="text-2xl font-extrabold text-foreground mb-2">Department Not Found</h2>
                <p className="text-muted-foreground font-medium mb-6">This department doesn't exist or has been removed.</p>
                <button
                    onClick={() => navigate('/super-admin/departments')}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Departments
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* Back link */}
            <button
                onClick={() => navigate('/super-admin/departments')}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Back to All Departments
            </button>

            {/* Department Header */}
            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-border rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-4xl shadow-lg border border-white/20 flex-shrink-0">
                        {dept.icon || '🏛️'}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{dept.name}</h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Full department analytics, users, courses, and reports
                        </p>
                        <div className="flex items-center gap-4 mt-4 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold">
                                <Users size={14} /> {dept.studentCount?.toLocaleString()} Students
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold">
                                <GraduationCap size={14} /> {dept.instructorCount?.toLocaleString()} Instructors
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">
                                <ShieldCheck size={14} /> {dept.adminCount} Admins
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-xl text-xs font-bold">
                                <BookOpen size={14} /> {dept.coursePublished} Courses
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">
                                <Star size={14} /> {dept.avgRating ? dept.avgRating.toFixed(1) : '—'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-xl text-xs font-bold">
                                <Gauge size={14} /> Limits: {dept.maxStudentsOverride ?? '∞'}/{dept.maxCoursesOverride ?? '∞'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted/10 rounded-t-2xl px-2">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-4 text-sm font-bold border-b-2 transition-all ${
                            activeTab === tab.key
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
                {statsLoading && activeTab === 'overview' ? (
                    <LoadingContainer height="h-48" />
                ) : activeTab === 'overview' && (
                    <OverviewTab dept={dept} deptStats={deptStats} />
                )}
                {activeTab === 'admins' && <AdminsTab dept={dept} />}
                {activeTab === 'instructors' && <InstructorsTab dept={dept} />}
                {activeTab === 'users' && <UsersTab dept={dept} />}
                {activeTab === 'categories' && <CategoriesTab dept={dept} />}
                {activeTab === 'courses' && <CoursesTab dept={dept} />}
                {activeTab === 'reports' && <ReportsTab dept={dept} deptStats={deptStats} />}
            </div>
        </div>
    );
}
