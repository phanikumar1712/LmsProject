import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, Award, CreditCard, BarChart2, Users, Settings,
    ShieldCheck, FileText, GraduationCap, PlusCircle, Star, Bell, Database,
    ChevronLeft, LogOut, ClipboardList, MessageSquare, Flag, Heart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';

const STUDENT_NAV = [
    { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/student/courses', icon: BookOpen, label: 'My Courses' },
    { to: '/student/wishlist', icon: Heart, label: 'Wishlist' },
    { to: '/student/quizzes', icon: ClipboardList, label: 'My Quizzes' },
    { to: '/student/certificates', icon: Award, label: 'Certificates' },
    { to: '/student/subscription', icon: CreditCard, label: 'Subscription' },
    { to: '/courses', icon: GraduationCap, label: 'Browse Courses' },
    { to: '/become-instructor', icon: Star, label: 'Become Instructor' },
];

const INSTRUCTOR_NAV = [
    { to: '/instructor', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/instructor/courses', icon: BookOpen, label: 'My Courses' },
    { to: '/instructor/create-course', icon: PlusCircle, label: 'Create Course' },
    { to: '/instructor/students', icon: Users, label: 'Students' },
    { to: '/instructor/reviews', icon: Star, label: 'Reviews' },
    { to: '/instructor/analytics', icon: BarChart2, label: 'Analytics' },
];

const ADMIN_NAV = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/users', icon: Users, label: 'Manage Users' },
    { to: '/admin/courses', icon: BookOpen, label: 'Manage Courses' },
    { to: '/admin/categories', icon: FileText, label: 'Categories' },
    { to: '/admin/reviews', icon: MessageSquare, label: 'Moderate Reviews' },
    { to: '/admin/reports', icon: Flag, label: 'Reports' },
    { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
];

const SUPER_ADMIN_NAV = [
    { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/super-admin/admins', icon: ShieldCheck, label: 'Manage Admins' },
    { to: '/super-admin/analytics', icon: BarChart2, label: 'Analytics' },
    { to: '/super-admin/settings', icon: Settings, label: 'Platform Settings' },
    { to: '/super-admin/subscriptions', icon: CreditCard, label: 'Subscription Plans' },
    { to: '/super-admin/audit-logs', icon: Database, label: 'Audit Logs' },
    { to: '/super-admin/system', icon: Bell, label: 'System Health' },
    { to: '/super-admin/users', icon: Users, label: 'Manage Users' },
    { to: '/super-admin/courses', icon: BookOpen, label: 'Manage Courses' },
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
    const navItems = ROLE_NAVS[user?.role] || STUDENT_NAV;

    const handleLogout = () => { logout(); navigate('/'); };

    return (
        <aside
            className={`fixed top-16 bottom-0 bg-background border-r border-border flex flex-col transition-all duration-300 z-40 ${collapsed ? 'w-16' : 'w-64'} ${mobileOpen ? 'left-0' : '-left-64 md:left-0'}`}
        >
            {/* User info */}
            <div className={`flex items-center gap-3 p-4 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
                {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover border border-border" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
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

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {navItems.map(({ to, icon: Icon, label, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={() => onMobileClose && onMobileClose()}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            } ${collapsed ? 'justify-center px-0' : ''}`
                        }
                        title={collapsed ? label : ''}
                    >
                        <Icon size={18} className="flex-shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom actions */}
            <div className="p-3 border-t border-border space-y-1">
                <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? 'Logout' : ''}
                >
                    <LogOut size={18} className="flex-shrink-0" />
                    {!collapsed && 'Sign Out'}
                </button>
                <button
                    onClick={onToggle}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
                >
                    <ChevronLeft size={18} className={`flex-shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
                    {!collapsed && 'Collapse'}
                </button>
            </div>
        </aside>
    );
}
