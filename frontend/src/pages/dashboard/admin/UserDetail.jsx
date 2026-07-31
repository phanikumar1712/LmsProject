import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    User, Mail, Shield, Building2, Calendar, Hash, Phone, Award, BookOpen,
    RotateCcw, Ban, CheckCircle, Trash2, Plus, X, Search,
    ChevronLeft, Star, BarChart3, Layers, Trophy, Target, Activity,
    Crown, Swords, Copy, ExternalLink, GraduationCap, Users, Megaphone
} from 'lucide-react';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import toast from 'react-hot-toast';
import { usersAPI, coursesAPI, departmentsAPI, enrollmentsAPI, notificationsAPI, statsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const ROLE_BADGES = {
    STUDENT: { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', icon: GraduationCap },
    INSTRUCTOR: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Users },
    ADMIN: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Shield },
    SUPER_ADMIN: { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', icon: Crown },
};

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
    const colorMap = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
        violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300',
        sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300',
    };
    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">{label}</p>
                    <p className="text-2xl font-black text-foreground">{value}</p>
                    {sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>}
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.indigo}`}>
                    <Icon size={22} />
                </div>
            </div>
        </div>
    );
}

function ProgressBar({ value, size = 'md', showLabel = true }) {
    const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };
    const clamped = Math.min(100, Math.max(0, value));
    const color = clamped >= 100 ? 'bg-emerald-500' : clamped >= 50 ? 'bg-indigo-500' : 'bg-amber-500';
    return (
        <div className="flex items-center gap-3">
            <div className={`flex-1 bg-muted rounded-full overflow-hidden ${heights[size]}`}>
                <div className={`${color} ${heights[size]} rounded-full transition-all duration-500`} style={{ width: `${clamped}%` }} />
            </div>
            {showLabel && <span className="text-xs font-bold text-muted-foreground w-10 text-right">{Math.round(clamped)}%</span>}
        </div>
    );
}

function DetailRow({ icon: Icon, label, value, href }) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">{label}</p>
                {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:text-indigo-600 transition-colors truncate block">
                        {value || '—'}
                    </a>
                ) : (
                    <p className="text-sm font-semibold text-foreground truncate">{value || '—'}</p>
                )}
            </div>
        </div>
    );
}

export default function UserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser, isSuperAdmin } = useAuth();
    const isInstructor = currentUser?.role === 'INSTRUCTOR';
    const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    // Modals
    const [resetResult, setResetResult] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showAssignCourse, setShowAssignCourse] = useState(false);

    // Course assignment
    const [courseSearch, setCourseSearch] = useState('');
    const [allCourses, setAllCourses] = useState([]);
    const [coursesLoading, setCoursesLoading] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState(null);

    // Create notification
    const [showNotify, setShowNotify] = useState(false);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [sendingNotify, setSendingNotify] = useState(false);

    const fetchUser = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await usersAPI.getById(id);
            setUser(res.data);
        } catch (err) {
            setError(err.message || 'Failed to load user');
            toast.error(err.message || 'Failed to load user details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchCourses = useCallback(async () => {
        if (!showAssignCourse) return;
        setCoursesLoading(true);
        try {
            const data = await coursesAPI.getAll({ limit: 100 });
            setAllCourses(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error('Failed to load courses');
        } finally {
            setCoursesLoading(false);
        }
    }, [showAssignCourse]);

    useEffect(() => { fetchUser(); }, [fetchUser]);
    useEffect(() => { fetchCourses(); }, [fetchCourses]);

    const handleRoleChange = async (newRole) => {
        if (newRole === user.role) return;
        if (['ADMIN', 'SUPER_ADMIN'].includes(newRole) && !isSuperAdmin()) {
            toast.error('Only Super Admin can assign admin roles');
            return;
        }
        try {
            const updated = await usersAPI.updateRole(user.id, newRole);
            setUser(prev => ({ ...prev, role: updated.role }));
            toast.success(`Role updated to ${newRole.replace('_', ' ')}`);
        } catch (err) {
            toast.error(err.message || 'Failed to update role');
        }
    };

    const handleToggleStatus = async () => {
        try {
            const updated = await usersAPI.toggleStatus(user.id);
            setUser(prev => ({ ...prev, active: updated.active }));
            toast.success(updated.active ? 'User activated' : 'User suspended');
        } catch (err) {
            toast.error(err.message || 'Failed to toggle status');
        }
    };

    const handleResetPassword = async () => {
        if (!window.confirm(`Reset password for ${user.name}? A new temporary password will be generated.`)) return;
        try {
            const res = await usersAPI.resetPassword(user.id);
            setResetResult({ name: user.name, tempPassword: res.tempPassword });
            toast.success('Password reset');
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        }
    };

    const handleDeleteUser = async () => {
        if (user.id === currentUser?.id) {
            toast.error("You can't delete your own account");
            return;
        }
        setDeleting(true);
        try {
            await usersAPI.delete(user.id);
            toast.success('User deleted');
            navigate('/admin/users');
        } catch (err) {
            toast.error(err.message || 'Failed to delete user');
        } finally {
            setDeleting(false);
            setDeleteConfirm(false);
        }
    };

    const handleEnrollCourse = async () => {
        if (!selectedCourseId) { toast.error('Select a course'); return; }
        setEnrolling(true);
        try {
            // Use bulkEnroll which is designed for admin-enrolling students
            await statsAPI.bulkEnroll(selectedCourseId, [user.id], []);
            toast.success('Student enrolled successfully');
            setShowAssignCourse(false);
            setSelectedCourseId(null);
            fetchUser(); // Refresh user data
        } catch (err) {
            toast.error(err.message || 'Failed to enroll');
        } finally {
            setEnrolling(false);
        }
    };

    const handleSendNotification = async () => {
        if (!notifyMessage.trim()) return;
        setSendingNotify(true);
        try {
            await notificationsAPI.create({ userId: user.id, message: notifyMessage });
            toast.success('Notification sent');
            setShowNotify(false);
            setNotifyMessage('');
        } catch (err) {
            toast.error(err.message || 'Failed to send notification');
        } finally {
            setSendingNotify(false);
        }
    };

    // ── Loading state ──
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-[4px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                    <p className="text-muted-foreground font-medium">Loading user details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto">
                        <X size={28} className="text-rose-600" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Failed to Load User</h3>
                    <p className="text-muted-foreground text-sm">{error}</p>
                    <div className="flex gap-3 justify-center pt-2">
                        <button onClick={fetchUser} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">
                            Try Again
                        </button>
                        <button onClick={() => navigate('/admin/users')} className="px-6 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                            Back to Users
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const RoleIcon = ROLE_BADGES[user.role]?.icon || Shield;
    const enrolledCourseIds = new Set((user.enrollments || []).map(e => e.courseId));
    const availableCourses = (allCourses || []).filter(c =>
        c.status === 'PUBLISHED' &&
        !enrolledCourseIds.has(c.id) &&
        (c.title?.toLowerCase().includes(courseSearch.toLowerCase()) || !courseSearch)
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* ── Back button ── */}
            <button
                onClick={() => navigate(isInstructor ? '/instructor/students' : '/admin/users')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors group"
            >
                <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                {isInstructor ? 'Back to My Students' : 'Back to Users'}
            </button>

            {/* ── Profile Header Card ── */}
            <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                <div className="h-36 sm:h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
                </div>
                <div className="px-5 sm:px-10 pb-8">
                    {/* Avatar + basic info */}
                    <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-7 -mt-14 sm:-mt-16">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-4 border-background object-cover shadow-xl" />
                            ) : (
                                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-4 border-background bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center shadow-xl">
                                    <User size={44} className="text-indigo-400 dark:text-indigo-300" />
                                </div>
                            )}
                            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background ${user.active !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </div>
                        {/* Name / info */}
                        <div className="flex-1 text-center sm:text-left min-w-0">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{user.name}</h1>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${ROLE_BADGES[user.role]?.color}`}>
                                    <RoleIcon size={14} />
                                    {user.role?.replace('_', ' ')}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${user.active !== false
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'}`}>
                                    {user.active !== false ? <CheckCircle size={12} /> : <Ban size={12} />}
                                    {user.active !== false ? 'Active' : 'Suspended'}
                                </span>
                            </div>
                            <p className="text-muted-foreground font-medium mt-1.5 flex items-center justify-center sm:justify-start gap-2 truncate">
                                <Mail size={14} className="flex-shrink-0" />
                                <span className="truncate">{user.email}</span>
                            </p>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2 sm:pb-1">
                            <button onClick={() => navigate(isInstructor ? '/instructor/students' : '/admin/users')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors">
                                Back
                            </button>
                            <button onClick={() => setShowNotify(true)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors flex items-center gap-1.5">
                                <Megaphone size={15} /> Notify
                            </button>
                        </div>
                    </div>

                    {/* Quick action buttons — instructors see minimal actions */}
                    <div className="flex flex-wrap gap-2 pb-6 border-b border-border">
                        {canManage && (
                            <select
                                value={user.role}
                                onChange={e => handleRoleChange(e.target.value)}
                                className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="STUDENT">Student</option>
                                <option value="INSTRUCTOR">Instructor</option>
                                {isSuperAdmin() && <option value="ADMIN">Admin</option>}
                                {isSuperAdmin() && <option value="SUPER_ADMIN">Super Admin</option>}
                            </select>
                        )}
                        {canManage && (
                            <button
                                onClick={handleToggleStatus}
                                disabled={user.id === currentUser?.id}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 ${user.active !== false
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-700'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700'}`}
                            >
                                {user.active !== false ? <Ban size={14} /> : <CheckCircle size={14} />}
                                {user.active !== false ? 'Suspend' : 'Activate'}
                            </button>
                        )}
                        {canManage && (
                            <button
                                onClick={handleResetPassword}
                                disabled={user.id === currentUser?.id}
                                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-border bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/20 dark:border-violet-700 transition-colors disabled:opacity-50"
                            >
                                <RotateCcw size={14} /> Reset Password
                            </button>
                        )}
                        {canManage && (
                            <button
                                onClick={() => setShowAssignCourse(true)}
                                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-border bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/20 dark:border-sky-700 transition-colors"
                            >
                                <Plus size={14} /> Enroll in Course
                            </button>
                        )}
                        {canManage && (
                            <button
                                onClick={() => setDeleteConfirm(true)}
                                disabled={user.id === currentUser?.id}
                                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-border bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-700 transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        )}
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-2 pt-6">
                        <DetailRow icon={Building2} label="Department" value={user.departmentName || '—'} />
                        <DetailRow icon={Hash} label="Roll No" value={user.rollNo || '—'} />
                        <DetailRow icon={Phone} label="Phone" value={user.phone || '—'} />
                        <DetailRow icon={Calendar} label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                        <DetailRow icon={Target} label="Current Streak" value={`${user.currentStreak || 0} days`} />
                        <DetailRow icon={Trophy} label="Longest Streak" value={`${user.longestStreak || 0} days`} />
                    </div>
                </div>
            </div>

            {/* ── Stats Grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={BookOpen} label="Enrolled Courses" value={user.enrollments?.length || 0} color="indigo" />
                <StatCard icon={Award} label="Certificates" value={user.certificates?.length || 0} color="emerald" />
                <StatCard icon={Star} label="Reviews Given" value={user.reviews?.length || 0} color="amber" />
                <StatCard icon={Swords} label="Quiz Attempts" value={user.quizStats?.totalAttempts || 0}
                    sub={user.quizStats?.totalAttempts > 0 ? `Passed: ${user.quizStats?.passedAttempts || 0} · Avg: ${Number(user.quizStats?.avgScore || 0).toFixed(0)}%` : 'No attempts'}
                    color="violet" />
                {user.role === 'INSTRUCTOR' && (
                    <>
                        <StatCard icon={Users} label="Followers" value={user.followerCount || 0} color="sky" />
                        <StatCard icon={Layers} label="Courses Created" value={user.coursesCreated || 0} color="rose" />
                    </>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-border gap-6">
                {['overview', 'courses', 'certificates', 'reviews'].filter(tab => {
                    if (tab === 'courses' && user.role !== 'STUDENT') return false;
                    if (tab === 'certificates' && user.role !== 'STUDENT') return false;
                    if (tab === 'reviews' && user.role === 'SUPER_ADMIN') return false;
                    return true;
                }).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`pb-4 text-sm font-bold border-b-2 capitalize transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        {tab === 'overview' ? 'Activity' : tab}
                    </button>
                ))}
            </div>

            {/* ── Overview / Activity Tab ── */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Enrolled courses preview */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <BookOpen size={18} className="text-indigo-600" /> Enrolled Courses
                            </h3>
                            {user.role === 'STUDENT' && (
                                <button onClick={() => setActiveTab('courses')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                    View All
                                </button>
                            )}
                        </div>
                        <div className="divide-y divide-border max-h-80 overflow-y-auto">
                            {(user.enrollments || []).length === 0 ? (
                                <div className="px-6 py-8 text-center text-muted-foreground text-sm font-medium">
                                    <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                                    No courses enrolled yet
                                </div>
                            ) : (
                                (user.enrollments || []).slice(0, 5).map(enrollment => (
                                    <div key={enrollment.id || enrollment.courseId} className="px-6 py-3.5 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-sm font-bold text-foreground truncate mr-2">
                                                {enrollment.course?.title || enrollment.title || 'Untitled'}
                                            </p>
                                            {enrollment.completedAt && (
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex-shrink-0">Completed</span>
                                            )}
                                        </div>
                                        <ProgressBar value={enrollment.progress || 0} size="sm" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Quiz stats */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <Swords size={18} className="text-violet-600" /> Quiz Performance
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-muted/40 rounded-xl border border-border">
                                    <p className="text-2xl font-black text-foreground">{user.quizStats?.totalAttempts || 0}</p>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Total</p>
                                </div>
                                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700">
                                    <p className="text-2xl font-black text-emerald-600">{user.quizStats?.passedAttempts || 0}</p>
                                    <p className="text-xs text-emerald-600 font-medium mt-1">Passed</p>
                                </div>
                                <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                                    <p className={`text-2xl font-black ${Number(user.quizStats?.avgScore || 0) >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {Number(user.quizStats?.avgScore || 0).toFixed(0)}%
                                    </p>
                                    <p className="text-xs text-amber-600 font-medium mt-1">Avg Score</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 rounded-xl border border-border">
                                <Activity size={16} className="text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">
                                    Current streak: <strong className="text-foreground">{user.currentStreak || 0} days</strong>
                                    {user.longestStreak > 0 && ` · Best: ${user.longestStreak} days`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Certificates preview */}
                    {(user.certificates || []).length > 0 && (
                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                                <h3 className="font-bold text-foreground flex items-center gap-2">
                                    <Award size={18} className="text-emerald-600" /> Certificates
                                </h3>
                                {user.role === 'STUDENT' && (
                                    <button onClick={() => setActiveTab('certificates')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                        View All
                                    </button>
                                )}
                            </div>
                            <div className="divide-y divide-border max-h-72 overflow-y-auto">
                                {(user.certificates || []).slice(0, 4).map(cert => (
                                    <div key={cert.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{cert.course_title}</p>
                                            <p className="text-xs text-muted-foreground">Issued {new Date(cert.issue_date).toLocaleDateString()}</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Verified</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviews preview */}
                    {(user.reviews || []).length > 0 && (
                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                                <h3 className="font-bold text-foreground flex items-center gap-2">
                                    <Star size={18} className="text-amber-500" /> Recent Reviews
                                </h3>
                                {user.reviews?.length > 4 && (
                                    <button onClick={() => setActiveTab('reviews')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                        View All
                                    </button>
                                )}
                            </div>
                            <div className="divide-y divide-border max-h-72 overflow-y-auto">
                                {(user.reviews || []).slice(0, 4).map(review => (
                                    <div key={review.id} className="px-6 py-3 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-bold text-foreground">{review.course?.title}</p>
                                            <div className="flex items-center gap-0.5">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star key={i} size={12} className={i < review.stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'} />
                                                ))}
                                            </div>
                                        </div>
                                        {review.comment && <p className="text-xs text-muted-foreground line-clamp-2">{review.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Courses Tab (students only) ── */}
            {activeTab === 'courses' && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">                                <h3 className="font-bold text-foreground flex items-center gap-2">
                                    <BookOpen size={18} className="text-indigo-600" /> Enrolled Courses ({user.enrollments?.length || 0})
                                </h3>
                                {canManage && (
                                    <button onClick={() => setShowAssignCourse(true)}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                                        <Plus size={14} /> Assign Course
                                    </button>
                                )}
                    </div>
                    <div className="divide-y divide-border">
                        {(user.enrollments || []).length === 0 ? (
                            <div className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                                <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
                                <p>No courses enrolled yet</p>                                                                            {canManage && (
                                                                                <button onClick={() => setShowAssignCourse(true)}
                                                                                    className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors">
                                                                                    <Plus size={14} /> Assign First Course
                                                                                </button>
                                                                            )}
                            </div>
                        ) : (
                            (user.enrollments || []).map(enrollment => (
                                <div key={enrollment.id || enrollment.courseId} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
{enrollment.course?.thumbnail ? (
                                                 <CourseThumbnail thumbnail={enrollment.course.thumbnail} title={enrollment.course.title} className="w-12 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                             ) : (
                                                 <div className="w-12 h-9 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0">
                                                     <BookOpen size={16} className="text-muted-foreground" />
                                                 </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{enrollment.course?.title || enrollment.title || 'Untitled'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {enrollment.course?.instructorName && `by ${enrollment.course.instructorName}`}
                                                    {enrollment.course?.level && ` · ${enrollment.course.level}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            {enrollment.completedAt ? (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">Completed</span>
                                            ) : (
                                                <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg">In Progress</span>
                                            )}
                                        </div>
                                    </div>
                                    <ProgressBar value={enrollment.progress || 0} size="sm" />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ── Certificates Tab ── */}
            {activeTab === 'certificates' && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Award size={18} className="text-emerald-600" /> Certificates ({user.certificates?.length || 0})
                        </h3>
                    </div>
                    {(user.certificates || []).length === 0 ? (
                        <div className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                            <Award size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No certificates earned yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {(user.certificates || []).map(cert => (
                                <div key={cert.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{cert.course_title}</p>
                                        <p className="text-xs text-muted-foreground">Cert ID: {cert.cert_id} · Issued {new Date(cert.issue_date).toLocaleDateString()}</p>
                                    </div>
                                    <a href={`/verify/${cert.cert_id}`} target="_blank" rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center gap-1">
                                        View <ExternalLink size={12} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Reviews Tab ── */}
            {activeTab === 'reviews' && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Star size={18} className="text-amber-500" /> Reviews Given ({user.reviews?.length || 0})
                        </h3>
                    </div>
                    {(user.reviews || []).length === 0 ? (
                        <div className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                            <Star size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No reviews given yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {(user.reviews || []).map(review => (
                                <div key={review.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-bold text-foreground">{review.course?.title}</p>
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} size={13} className={i < review.stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'} />
                                            ))}
                                        </div>
                                    </div>
                                    {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                                    <p className="text-[11px] text-muted-foreground/50 mt-1">{new Date(review.createdAt).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Password Reset Result Modal ── */}
            {resetResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <RotateCcw size={20} className="text-violet-600" /> Password Reset
                            </h3>
                            <button onClick={() => setResetResult(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <p className="text-sm text-muted-foreground font-medium">
                                New temporary password for <span className="font-bold text-foreground">{resetResult.name}</span>.
                                Share it securely — it won't be shown again.
                            </p>
                            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-2xl px-4 py-3">
                                <code className="flex-1 font-mono text-sm font-bold text-foreground break-all">{resetResult.tempPassword}</code>
                                <button onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); toast.success('Copied'); }}
                                    className="p-2 text-violet-600 hover:bg-violet-50 rounded-xl transition-all flex-shrink-0" title="Copy">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <button onClick={() => setResetResult(null)}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                                <Trash2 size={28} className="text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-foreground mb-1">Delete User?</h3>
                                <p className="text-sm text-muted-foreground">
                                    This will permanently delete <strong className="text-foreground">{user.name}</strong> and all their data. This action cannot be undone.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setDeleteConfirm(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDeleteUser} disabled={deleting}
                                    className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {deleting ? 'Deleting...' : 'Delete Forever'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Assign Course Modal ── */}
            {showAssignCourse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <BookOpen size={20} className="text-sky-600" /> Enroll in Course
                            </h3>
                            <button onClick={() => { setShowAssignCourse(false); setSelectedCourseId(null); setCourseSearch(''); }}
                                className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Enrolling <strong className="text-foreground">{user.name}</strong> in a course
                            </p>
                            <div className="relative">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input type="text" value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                                    placeholder="Search courses by title..."
                                    className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto border border-border rounded-2xl divide-y divide-border">
                                {coursesLoading ? (
                                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                                        <div className="w-6 h-6 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                                        Loading courses...
                                    </div>
                                ) : availableCourses.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                                        {courseSearch ? 'No courses match your search' : 'No available courses to assign'}
                                    </div>
                                ) : (
                                    availableCourses.map(course => (
                                        <label key={course.id}
                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${selectedCourseId === course.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                            <input type="radio" name="course" checked={selectedCourseId === course.id}
                                                onChange={() => setSelectedCourseId(course.id)}
                                                className="accent-indigo-600" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-foreground truncate">{course.title}</p>
                                                <p className="text-xs text-muted-foreground">{course.level || 'All levels'} · {course.instructorName || ''}</p>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => { setShowAssignCourse(false); setSelectedCourseId(null); setCourseSearch(''); }}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleEnrollCourse} disabled={!selectedCourseId || enrolling}
                                    className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {enrolling ? 'Enrolling...' : 'Enroll'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Send Notification Modal ── */}
            {showNotify && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Megaphone size={20} className="text-amber-600" /> Send Notification
                            </h3>
                            <button onClick={() => setShowNotify(false)}
                                className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Sending notification to <strong className="text-foreground">{user.name}</strong>
                            </p>
                            <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)}
                                placeholder="Type your notification message..."
                                rows={4}
                                className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium resize-none"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setShowNotify(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleSendNotification} disabled={!notifyMessage.trim() || sendingNotify}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {sendingNotify ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
