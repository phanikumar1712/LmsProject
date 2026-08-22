import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Building2, Mail, Phone, BookOpen, Star, Users, GraduationCap,
    TrendingUp, Award, ExternalLink, KeyRound, Power, Clock, Award as CertificateIcon,
    FileText, Hash
} from 'lucide-react';
import { usersAPI, coursesAPI, statsAPI } from '../../../services/api';
import { useMultipleAsync, useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';
import PermissionBadges from '../../../components/ui/PermissionBadges';
import toast from 'react-hot-toast';

const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function StatusBadge({ active }) {
    return active !== false ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
        </span>
    );
}

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
        violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300',
        sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300',
    };
    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">{label}</p>
                    <p className="text-2xl font-black text-foreground">{value}</p>
                    {sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>}
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color] || colors.indigo}`}>
                    <Icon size={22} />
                </div>
            </div>
        </div>
    );
}

function DetailRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{value || '—'}</p>
            </div>
        </div>
    );
}

const statusColors = {
    PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    DRAFT: 'bg-muted text-muted-foreground',
    REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function InstructorDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { results, loading } = useMultipleAsync(
        [
            () => usersAPI.getById(id),
            () => statsAPI.getInstructor(id).catch(() => null),
            () => coursesAPI.getByInstructor(id).catch(() => []),
        ],
        [id]
    );

    // Effective permission list (role matrix + super-admin overrides).
    const { data: permData } = useAsyncData(
        () => usersAPI.getPermissions(id).catch(() => null),
        [id]
    );

    const [toggling, setToggling] = useState(false);
    const [resetting, setResetting] = useState(false);

    const [profileRes, stats, courses] = results;
    const instructor = profileRes?.data || profileRes || {};
    const courseList = Array.isArray(courses) ? courses : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingContainer height="h-32" />
            </div>
        );
    }

    if (!instructor.id) {
        return (
            <div className="max-w-2xl mx-auto text-center py-24">
                <GraduationCap size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-foreground mb-1">Instructor not found</h2>
                <p className="text-sm text-muted-foreground mb-6">They may have been deleted or the link is invalid.</p>
                <button
                    onClick={() => navigate('/super-admin/instructors')}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
                >
                    <ArrowLeft size={15} /> Back to Instructors
                </button>
            </div>
        );
    }

    const totalStudents = stats?.totalEnrollments ?? courseList.reduce((acc, c) => acc + (c.enrollmentCount || 0), 0);
    const published = stats?.publishedCourses ?? courseList.filter(c => c.status === 'PUBLISHED').length;

    const handleToggleStatus = async () => {
        setToggling(true);
        try {
            await usersAPI.toggleStatus(id);
            toast.success(`${instructor.name} ${instructor.active === false ? 'activated' : 'suspended'}`);
            navigate(0);
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally {
            setToggling(false);
        }
    };

    const handleResetPassword = async () => {
        if (!window.confirm(`Reset password for ${instructor.name}? A new temporary password will be generated.`)) return;
        setResetting(true);
        try {
            const res = await usersAPI.resetPassword(id);
            window.prompt('Temporary password (shown once — copy it now):', res.tempPassword || '');
            toast.success('Password reset');
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 max-w-6xl w-full mx-auto px-0 pb-12">
            {/* Back + actions */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => navigate('/super-admin/instructors')}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft size={16} /> Back to Instructors
                </button>
                <div className="flex items-center gap-2">
                    <Link to={`/admin/users/${instructor.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 border border-border px-3 py-2 rounded-xl hover:bg-indigo-50 transition-colors">
                        <ExternalLink size={13} /> Full Profile
                    </Link>
                    <button onClick={handleResetPassword} disabled={resetting}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 border border-border px-3 py-2 rounded-xl hover:bg-violet-50 transition-colors disabled:opacity-50">
                        <KeyRound size={13} /> Reset Password
                    </button>
                    <button onClick={handleToggleStatus} disabled={toggling}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold border border-border px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                            instructor.active === false
                                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                        }`}>
                        {toggling ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Power size={13} />}
                        {instructor.active === false ? 'Activate' : 'Suspend'}
                    </button>
                </div>
            </div>

            {/* Profile header */}
            <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    {instructor.avatar ? (
                        <img src={instructor.avatar} alt={instructor.name} className="w-20 h-20 rounded-2xl object-cover border border-border shadow-sm flex-shrink-0" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-3xl font-black flex-shrink-0 shadow-sm">
                            {instructor.name?.charAt(0)?.toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{instructor.name}</h1>
                            <StatusBadge active={instructor.active} />
                            {instructor.designation && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold">{instructor.designation}</span>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground font-medium mt-1 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1"><Mail size={13} /> {instructor.email}</span>
                            {instructor.username && <span className="text-muted-foreground/70">· @{instructor.username}</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-3 flex-wrap text-xs font-bold">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                <Building2 size={11} /> {instructor.departmentName || 'No department'}
                            </span>
                            {instructor.qualification && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                                    <Award size={11} /> {instructor.qualification}
                                </span>
                            )}
                            <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">#{shortId(instructor.id)}</span>
                        </div>
                        {permData && (
                            <div className="mt-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">Permissions</p>
                                <PermissionBadges permissions={permData.effective || []} max={4} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Performance stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={BookOpen} label="Total Courses" value={courseList.length} sub={`${published} published`} color="indigo" />
                <StatCard icon={Users} label="Students" value={totalStudents.toLocaleString()} sub="Across enrollments" color="emerald" />
                <StatCard icon={Star} label="Avg Rating" value={stats?.avgRating?.toFixed(1) ?? '—'} sub="Course reviews" color="amber" />
                <StatCard icon={TrendingUp} label="This Month" value={`${stats?.thisMonth?.enrollments ?? 0} enrollments`} sub={`${stats?.thisMonth?.newCourses ?? 0} new courses`} color="sky" />
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <GraduationCap size={16} className="text-emerald-500" /> Instructor Details
                            </h4>
                        </div>
                        <div className="px-5 divide-y divide-border">
                            <DetailRow icon={Building2} label="Department" value={instructor.departmentName || '—'} />
                            <DetailRow icon={Award} label="Designation" value={instructor.designation || '—'} />
                            <DetailRow icon={CertificateIcon} label="Qualification" value={instructor.qualification || '—'} />
                            <DetailRow icon={FileText} label="Specialization" value={instructor.specialization || '—'} />
                            <DetailRow icon={Phone} label="Phone" value={instructor.phone || '—'} />
                            <DetailRow icon={Mail} label="Email" value={instructor.email} />
                            <DetailRow icon={Clock} label="Joined" value={fmtDateTime(instructor.createdAt)} />
                            <DetailRow icon={Hash} label="Last Login" value={fmtDateTime(instructor.lastLogin)} />
                        </div>
                    </div>

                    {stats?.monthlyEnrollments?.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-border bg-muted/20">
                                <h4 className="font-bold text-foreground flex items-center gap-2">
                                    <TrendingUp size={16} className="text-sky-500" /> Enrollments — Last 6 Months
                                </h4>
                            </div>
                            <div className="p-5">
                                <div className="flex items-end gap-2 h-28">
                                    {stats.monthlyEnrollments.map((m, i) => {
                                        const max = Math.max(...stats.monthlyEnrollments.map(x => x.count), 1);
                                        const h = Math.round((m.count / max) * 100);
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <span className="text-[10px] font-bold text-foreground">{m.count}</span>
                                                <div className="w-full rounded-t-md bg-sky-500/80" style={{ height: `${Math.max(h, 4)}%` }} />
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.month}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Courses */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <BookOpen size={16} className="text-indigo-500" /> Courses ({courseList.length})
                            </h4>
                            <Link to={`/super-admin/courses?instructorId=${instructor.id}`}
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                Manage <ExternalLink size={12} />
                            </Link>
                        </div>
                        <div className="divide-y divide-border max-h-[460px] overflow-y-auto">
                            {courseList.map(course => (
                                <Link key={course.id} to={`/courses/${course.id}`}
                                    className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors group">
                                    {course.thumbnail ? (
                                        <img src={course.thumbnail} alt={course.title} className="w-14 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                                    ) : (
                                        <div className="w-14 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                            {course.title?.charAt(0)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">{course.title}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium truncate">
                                            {course.categoryName || 'Uncategorized'} · {course.departmentName || 'No dept'} · {course.lessonsCount || 0} lessons
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground flex-shrink-0">
                                        <Users size={12} /> {course.enrollmentCount || 0}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter flex-shrink-0 ${statusColors[course.status] || 'bg-muted text-muted-foreground'}`}>
                                        {course.status}
                                    </span>
                                </Link>
                            ))}
                            {courseList.length === 0 && (
                                <div className="py-14 text-center text-muted-foreground/60 font-medium text-sm">
                                    <BookOpen size={28} className="opacity-20 mx-auto mb-2" />
                                    No courses yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Students across courses */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <Users size={16} className="text-emerald-500" /> Students ({totalStudents})
                            </h4>
                        </div>
                        <div className="divide-y divide-border">
                            {courseList.filter(c => (c.enrollmentCount || 0) > 0).slice(0, 10).map(course => (
                                <div key={course.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                                    <Link to={`/courses/${course.id}`} className="text-sm font-bold text-foreground hover:text-indigo-600 transition-colors truncate">
                                        {course.title}
                                    </Link>
                                    <span className="text-xs font-bold text-muted-foreground flex-shrink-0">{course.enrollmentCount} students</span>
                                </div>
                            ))}
                            {courseList.filter(c => (c.enrollmentCount || 0) > 0).length === 0 && (
                                <div className="py-10 text-center text-muted-foreground/60 font-medium text-sm">No student enrollments yet</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
