import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Building2, Hash, Mail, Phone, Calendar, Award, BookOpen,
    KeyRound, Power, ExternalLink, LayoutDashboard, Trophy, Target, GraduationCap,
    CheckCircle2, Clock
} from 'lucide-react';
import { usersAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';
import PermissionBadges from '../../../components/ui/PermissionBadges';
import toast from 'react-hot-toast';

const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';
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

function ProgressBar({ value }) {
    const clamped = Math.min(100, Math.max(0, value));
    const color = clamped >= 100 ? 'bg-emerald-500' : clamped >= 50 ? 'bg-indigo-500' : 'bg-amber-500';
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full overflow-hidden h-2.5">
                <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${clamped}%` }} />
            </div>
            <span className="text-xs font-bold text-muted-foreground w-10 text-right">{Math.round(clamped)}%</span>
        </div>
    );
}

export default function StudentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data: detail, loading, reload } = useAsyncData(
        () => usersAPI.getById(id),
        [id]
    );

    // Effective permission list (role matrix + super-admin overrides).
    const { data: permData } = useAsyncData(
        () => usersAPI.getPermissions(id).catch(() => null),
        [id]
    );

    const [resetting, setResetting] = useState(false);
    const [toggling, setToggling] = useState(false);

    const student = detail?.data || detail || {};

    const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
    const certificates = Array.isArray(student.certificates) ? student.certificates : [];
    const quizStats = student.quizStats || { totalAttempts: 0, passedAttempts: 0, avgScore: 0 };
    const avgProgress = enrollments.length
        ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / enrollments.length)
        : 0;
    const completedCourses = enrollments.filter(e => (e.progress || 0) >= 100).length;

    const handleResetPassword = async () => {
        if (!window.confirm(`Reset password for ${student.name}? A new temporary password will be generated.`)) return;
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

    const handleToggleStatus = async () => {
        setToggling(true);
        try {
            await usersAPI.toggleStatus(id);
            toast.success(`${student.name} ${student.active === false ? 'activated' : 'suspended'}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally {
            setToggling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingContainer height="h-32" />
            </div>
        );
    }

    if (!student.id) {
        return (
            <div className="max-w-2xl mx-auto text-center py-24">
                <GraduationCap size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-foreground mb-1">Student not found</h2>
                <p className="text-sm text-muted-foreground mb-6">It may have been deleted or the link is invalid.</p>
                <button
                    onClick={() => navigate('/super-admin/students')}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
                >
                    <ArrowLeft size={15} /> Back to Students
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 max-w-6xl w-full mx-auto px-0 pb-12">
            {/* Back + Header Actions */}
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => navigate('/super-admin/students')}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Students
                </button>
                <div className="flex items-center gap-2">
                    <Link
                        to={`/admin/users/${student.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 border border-border px-3 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
                    >
                        <ExternalLink size={13} /> Full Profile
                    </Link>
                    <button
                        onClick={handleResetPassword}
                        disabled={resetting}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 border border-border px-3 py-2 rounded-xl hover:bg-violet-50 transition-colors disabled:opacity-50"
                    >
                        <KeyRound size={13} /> Reset Password
                    </button>
                    <button
                        onClick={handleToggleStatus}
                        disabled={toggling}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold border border-border px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                            student.active === false
                                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                        }`}
                    >
                        {toggling ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Power size={13} />}
                        {student.active === false ? 'Activate' : 'Suspend'}
                    </button>
                </div>
            </div>

            {/* Profile Header */}
            <div className="bg-card border border-border rounded-3xl shadow-sm p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    {student.avatar ? (
                        <img src={student.avatar} alt={student.name} className="w-20 h-20 rounded-2xl object-cover border border-border shadow-sm flex-shrink-0" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-black flex-shrink-0 shadow-sm">
                            {student.name?.charAt(0)?.toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{student.name}</h1>
                            <StatusBadge active={student.active} />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium mt-1 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1"><Mail size={13} /> {student.email}</span>
                            {student.username && <span className="inline-flex items-center gap-1 text-muted-foreground/70">· @{student.username}</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-3 flex-wrap text-xs font-bold">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                <Hash size={11} /> {student.rollNo || shortId(student.id)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                                <Building2 size={11} /> {student.departmentName || 'No department'}
                            </span>
                            <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">#{shortId(student.id)}</span>
                        </div>
                        {permData && (
                            <div className="mt-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">Permissions</p>
                                <PermissionBadges permissions={permData.effective || []} max={4} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick facts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 border-t border-border pt-5">
                    <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Phone</p>
                        <p className="text-sm font-bold text-foreground truncate">{student.phone || '—'}</p>
                    </div>
                    <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Created</p>
                        <p className="text-sm font-bold text-foreground truncate">{fmtDateTime(student.createdAt)}</p>
                    </div>
                    <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Last Login</p>
                        <p className="text-sm font-bold text-foreground truncate">{fmtDateTime(student.lastLogin)}</p>
                    </div>
                    <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Streak</p>
                        <p className="text-sm font-bold text-foreground truncate">{student.currentStreak || 0} days</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={BookOpen} label="Enrolled Courses" value={enrollments.length} sub={`${completedCourses} completed`} color="indigo" />
                <StatCard icon={Target} label="Avg Progress" value={`${avgProgress}%`} sub="Across enrollments" color="sky" />
                <StatCard icon={Award} label="Certificates" value={certificates.length} sub="Earned" color="amber" />
                <StatCard icon={LayoutDashboard} label="Quiz Score" value={`${quizStats.avgScore || 0}%`} sub={`${quizStats.passedAttempts || 0}/${quizStats.totalAttempts || 0} passed`} color="emerald" />
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <GraduationCap size={16} className="text-indigo-500" /> Student Details
                            </h4>
                        </div>
                        <div className="px-5 divide-y divide-border">
                            <DetailRow icon={Building2} label="Department" value={student.departmentName || '—'} />
                            <DetailRow icon={Hash} label="Roll Number" value={student.rollNo || '—'} />
                            <DetailRow icon={Phone} label="Phone" value={student.phone || '—'} />
                            <DetailRow icon={Mail} label="Email" value={student.email} />
                            <DetailRow icon={Calendar} label="Joined" value={fmtDate(student.createdAt)} />
                            <DetailRow icon={Clock} label="Last Login" value={fmtDateTime(student.lastLogin)} />
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <Trophy size={16} className="text-amber-500" /> Quiz Performance
                            </h4>
                        </div>
                        <div className="grid grid-cols-3 gap-3 p-5 text-center">
                            <div>
                                <p className="text-2xl font-black text-indigo-600">{quizStats.totalAttempts || 0}</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Attempts</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-emerald-600">{quizStats.passedAttempts || 0}</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Passed</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-foreground">{quizStats.avgScore || 0}%</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Avg Score</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Enrollments & Certificates */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <BookOpen size={16} className="text-indigo-500" /> Enrollments & Course Progress ({enrollments.length})
                            </h4>
                        </div>
                        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                            {enrollments.map(enr => {
                                const title = enr.title || enr.course?.title || 'Untitled course';
                                return (
                                    <div key={enr.id} className="px-5 py-4">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <Link to={`/courses/${enr.courseId}`} className="text-sm font-bold text-foreground hover:text-indigo-600 transition-colors truncate">
                                                {title}
                                            </Link>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter flex-shrink-0 ${
                                                enr.progress >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {enr.progress >= 100 ? 'Completed' : 'In Progress'}
                                            </span>
                                        </div>
                                        <ProgressBar value={enr.progress || 0} />
                                        <p className="text-[10px] text-muted-foreground/60 font-medium mt-1.5">
                                            Enrolled {fmtDate(enr.enrolledAt)} · Last accessed {fmtDateTime(enr.lastAccessed)}
                                        </p>
                                    </div>
                                );
                            })}
                            {enrollments.length === 0 && (
                                <div className="py-14 text-center text-muted-foreground/60 font-medium text-sm">
                                    <BookOpen size={28} className="opacity-20 mx-auto mb-2" />
                                    No enrollments yet
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border bg-muted/20">
                            <h4 className="font-bold text-foreground flex items-center gap-2">
                                <Award size={16} className="text-amber-500" /> Certificates ({certificates.length})
                            </h4>
                        </div>
                        <div className="divide-y divide-border">
                            {certificates.map(cert => (
                                <div key={cert.id} className="px-5 py-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                        <Award size={18} className="text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{cert.course_title || cert.courseTitle}</p>
                                        <p className="text-[11px] text-muted-foreground font-medium">
                                            <span className="font-mono">{cert.cert_id}</span> · {fmtDate(cert.issue_date || cert.issueDate)}
                                        </p>
                                    </div>
                                    <Link
                                        to={`/verify/${cert.cert_id}`}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex-shrink-0"
                                    >
                                        Verify <ExternalLink size={12} />
                                    </Link>
                                </div>
                            ))}
                            {certificates.length === 0 && (
                                <div className="py-12 text-center text-muted-foreground/60 font-medium text-sm">
                                    <CheckCircle2 size={28} className="opacity-20 mx-auto mb-2" />
                                    No certificates earned yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
