import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, Award, BarChart2, Users, Settings,
    ShieldCheck, Layers, GraduationCap, PlusCircle, Star, Activity, Database,
    ChevronLeft, LogOut, ClipboardList, MessageSquare, BarChart3, Heart, User,
    Building2, Zap, Megaphone, UserPlus, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// ── Nav sections: each group has a label + items ─────────────────────────────
const STUDENT_NAV = [
    {
        label: 'Overview',
        items: [
            { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
            { to: '/student/courses', icon: BookOpen, label: 'My Courses' },
            { to: '/student/wishlist', icon: Heart, label: 'Wishlist' },
        ],
    },
    {
        label: 'Learning',
        items: [
            { to: '/student/exams', icon: ClipboardList, label: 'Write Exam' },
            { to: '/student/quizzes', icon: BarChart3, label: 'My Results' },
            { to: '/student/certificates', icon: Award, label: 'Certificates' },
        ],
    },
    {
        label: 'Explore',
        items: [
            { to: '/announcements', icon: Megaphone, label: 'Announcements' },
            { to: '/courses', icon: GraduationCap, label: 'Browse Courses' },
            { to: '/become-instructor', icon: Star, label: 'Become Instructor' },
        ],
    },
];

const INSTRUCTOR_NAV = [
    {
        label: 'Overview',
        items: [
            { to: '/instructor', icon: LayoutDashboard, label: 'Dashboard', end: true },
            { to: '/instructor/courses', icon: BookOpen, label: 'My Courses' },
            { to: '/instructor/create-course', icon: PlusCircle, label: 'Create Course' },
        ],
    },
    {
        label: 'Manage',
        items: [
            { to: '/instructor/students', icon: Users, label: 'Students' },
            { to: '/instructor/reviews', icon: Star, label: 'Reviews' },
            { to: '/instructor/assessments', icon: ClipboardList, label: 'Assessments' },
        ],
    },
    {
        label: 'Insights',
        items: [
            { to: '/instructor/analytics', icon: BarChart2, label: 'Analytics' },
            { to: '/announcements', icon: Megaphone, label: 'Announcements' },
        ],
    },
];

const ADMIN_NAV = [
    {
        label: 'Overview',
        items: [
            { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
            { to: '/admin/users', icon: Users, label: 'Manage Users' },
            { to: '/admin/courses', icon: BookOpen, label: 'Manage Courses' },
        ],
    },
    {
        label: 'Content',
        items: [
            { to: '/courses', icon: GraduationCap, label: 'Browse & Preview' },
            { to: '/admin/categories', icon: Layers, label: 'Categories' },
            { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
        ],
    },
    {
        label: 'Operations',
        items: [
            { to: '/admin/bulk-enroll', icon: UserPlus, label: 'Bulk Enrollment' },
            { to: '/admin/student-progress', icon: BarChart3, label: 'Student Progress' },
            { to: '/admin/reviews', icon: MessageSquare, label: 'Moderate Reviews' },
            { to: '/admin/reports', icon: TrendingUp, label: 'Reports' },
        ],
    },
];

const SUPER_ADMIN_NAV = [
    {
        label: 'Overview',
        items: [
            { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
            { to: '/super-admin/analytics', icon: BarChart2, label: 'Analytics' },
        ],
    },
    {
        label: 'Platform',
        items: [
            { to: '/super-admin/departments', icon: Building2, label: 'Departments' },
            { to: '/super-admin/admins', icon: ShieldCheck, label: 'Manage Admins' },
            { to: '/super-admin/admins/create', icon: PlusCircle, label: 'Create Admin' },
            { to: '/super-admin/categories', icon: Layers, label: 'Categories' },
        ],
    },
    {
        label: 'Admin Tools',
        items: [
            { to: '/admin/users', icon: Users, label: 'Manage Users' },
            { to: '/admin/courses', icon: BookOpen, label: 'Manage Courses' },
            { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
            { to: '/admin/categories', icon: Layers, label: 'Categories' },
            { to: '/admin/bulk-enroll', icon: UserPlus, label: 'Bulk Enrollment' },
            { to: '/admin/reports', icon: TrendingUp, label: 'Reports' },
        ],
    },
    {
        label: 'System',
        items: [
            { to: '/super-admin/settings', icon: Settings, label: 'Platform Settings' },
            { to: '/super-admin/audit-logs', icon: Database, label: 'Audit Logs' },
            { to: '/super-admin/ai-analytics', icon: Zap, label: 'AI Reports' },
            { to: '/super-admin/system', icon: Activity, label: 'System Health' },
        ],
    },
];

const ROLE_NAVS = {
    STUDENT: STUDENT_NAV,
    INSTRUCTOR: INSTRUCTOR_NAV,
    ADMIN: ADMIN_NAV,
    SUPER_ADMIN: SUPER_ADMIN_NAV,
};

const ROLE_COLORS = {
    STUDENT: 'text-indigo-600 bg-indigo-50',
    INSTRUCTOR: 'text-emerald-600 bg-emerald-50',
    ADMIN: 'text-amber-600 bg-amber-50',
    SUPER_ADMIN: 'text-rose-600 bg-rose-50',
};

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const navSections = ROLE_NAVS[user?.role] || STUDENT_NAV;

    const handleLogout = () => { logout(); navigate('/'); };

    return (
        <aside
            className={`fixed top-16 bottom-0 bg-background border-r border-border flex flex-col transition-all duration-300 ease-out z-40 ${collapsed ? 'w-16' : 'w-64'} ${mobileOpen ? 'left-0 translate-x-0' : '-left-64 md:left-0'} shadow-2xl md:shadow-none`}
        >
            {/* User info */}
            <div className={`flex items-center gap-3 p-4 border-b border-border ${collapsed ? 'justify-center' : ''} min-h-[4rem]`}>
                {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover border-2 border-border" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-muted-foreground" />
                    </div>
                )}
                {!collapsed && (
                    <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-bold truncate">{user?.name}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5 ${ROLE_COLORS[user?.role] || ROLE_COLORS.STUDENT}`}>
                            {user?.role?.replace('_', ' ')}
                        </span>
                    </div>
                )}
            </div>

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5 scrollbar-thin">
                {navSections.map(section => (
                    <div key={section.label} className="space-y-0.5">
                        {!collapsed && (
                            <p className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 select-none">
                                {section.label}
                            </p>
                        )}
                        {section.items.map(({ to, icon: Icon, label, end }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                onClick={() => onMobileClose && onMobileClose()}
                                className={({ isActive }) =>
                                    `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                        isActive
                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 shadow-sm font-semibold'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    } ${collapsed ? 'justify-center px-0' : ''} min-h-[2.75rem] group`
                                }
                                title={collapsed ? label : ''}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && !collapsed && (
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                                        )}
                                        <Icon
                                            size={18}
                                            className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : ''} ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                                        />
                                        {!collapsed && <span className="truncate">{label}</span>}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Bottom actions */}
            <div className="p-3 border-t border-border space-y-1">
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? 'Logout' : ''}
                >
                    <LogOut size={18} className="flex-shrink-0" />
                    {!collapsed && 'Sign Out'}
                </button>
                <button
                    onClick={onToggle}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
                >
                    <ChevronLeft size={18} className={`flex-shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                    {!collapsed && 'Collapse'}
                </button>
            </div>
        </aside>
    );
}
