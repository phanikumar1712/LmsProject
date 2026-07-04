import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    GraduationCap, Menu, X, Search, LogOut, User,
    LayoutDashboard, BookOpen, ChevronDown, Bell, Flame, Moon, Sun
} from 'lucide-react';

// ── Dark mode hook ────────────────────────────────────────────────────────────
function useDarkMode() {
    const [dark, setDark] = useState(() => {
        try {
            const saved = localStorage.getItem('lms_dark_mode');
            if (saved !== null) return saved === 'true';
        } catch { }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        try { localStorage.setItem('lms_dark_mode', String(dark)); } catch { }
    }, [dark]);

    return [dark, () => setDark(d => !d)];
}
import { useAuth } from '../../contexts/AuthContext';
import { notificationsAPI, statsAPI } from '../../services/api';

const ROLE_DASHBOARDS = {
    STUDENT: '/student',
    INSTRUCTOR: '/instructor',
    ADMIN: '/admin',
    SUPER_ADMIN: '/super-admin',
};

export function Navbar({ onMobileMenuClick }) {
    const { user, logout, isAuthenticated } = useAuth();
    const [isDark, toggleDark] = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [streak, setStreak] = useState(0);

    const profileRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated && user) {
            notificationsAPI.getByUser(user.id).then(notifs => {
                setNotifications(notifs || []);
            }).catch(() => { });

            if (user.role === 'STUDENT') {
                statsAPI.getStudentStreak().then(res => {
                    setStreak(res.currentStreak || 0);
                }).catch(() => setStreak(0));
            } else {
                setStreak(0);
            }
        }
    }, [isAuthenticated, user]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Close mobile menu on route change
    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) navigate(`/courses?search=${encodeURIComponent(searchQuery)}`);
    };

    const handleMarkRead = async (notif) => {
        try {
            await notificationsAPI.markRead(user.id, notif.id);
            setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
            if (notif.link) {
                navigate(notif.link);
                setNotifOpen(false);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsAPI.markAllRead(user.id);
            setNotifications([]);
            setNotifOpen(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleLogout = () => { logout(); navigate('/'); setProfileOpen(false); };

    const dashboardPath = user ? ROLE_DASHBOARDS[user.role] : '/';
    const unreadCount = notifications.filter(n => !n.read).length;

    const formatDate = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        if (isNaN(d)) return '';
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-sm h-16 flex items-center transition-all">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between">
                    {/* Left: Logo & Explore */}
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                                <GraduationCap size={18} className="text-white" />
                            </div>
                            <span className="font-extrabold text-foreground text-xl tracking-tight font-['Satoshi']">
                                EduNexus
                            </span>
                        </Link>

                        <div className="relative group hidden md:block">
                            <button
                                className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-indigo-600 transition-colors py-4"
                            >
                                Explore <ChevronDown size={14} className="opacity-50 group-hover:rotate-180 transition-transform" />
                            </button>

                            {/* Dropdown Menu */}
                            <div className="absolute top-full left-0 w-64 bg-popover border border-border rounded-2xl shadow-2xl py-3 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                                <div className="px-4 py-2 border-b border-border/50 mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Browse Categories</span>
                                </div>
                                <Link to="/courses" className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-foreground/80 hover:bg-muted hover:text-indigo-600 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">📚</div>
                                    All Courses
                                </Link>
                                <Link to="/courses?category=development" className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-foreground/80 hover:bg-muted hover:text-indigo-600 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">💻</div>
                                    Development
                                </Link>
                                <Link to="/courses?category=design" className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-foreground/80 hover:bg-muted hover:text-indigo-600 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">🎨</div>
                                    Design
                                </Link>
                                <Link to="/courses?category=business" className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-foreground/80 hover:bg-muted hover:text-indigo-600 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">💼</div>
                                    Business
                                </Link>
                                <div className="mt-2 pt-2 border-t border-border/50">
                                    <Link to="/become-instructor" className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">🌟</div>
                                        Become an Instructor
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Search bar (Glassmorphism) */}
                    <div className="hidden md:flex flex-1 max-w-md mx-8">
                        <form onSubmit={handleSearch} className="w-full relative group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search courses, skills, or mentors..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-muted/50 backdrop-blur-md border border-border/60 rounded-full pl-10 pr-4 py-2 text-sm font-medium outline-none hover:bg-muted focus:bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner text-foreground"
                            />
                        </form>
                    </div>

                    {/* Right: Actions */}
                    <div className="hidden md:flex items-center gap-4">

                        {!isAuthenticated ? (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleDark}
                                    className="p-2 text-muted-foreground hover:text-foreground transition-colors hidden lg:block"
                                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                >
                                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                </button>
                                <Link to="/login" className="text-sm font-bold text-muted-foreground hover:text-indigo-600 transition-colors px-2">Log in</Link>
                                <Link to="/register" className="bg-foreground text-background text-sm font-bold px-5 py-2.5 rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] active:scale-95">Sign up</Link>
                            </div>
                        ) : (
                            <div className="flex items-center gap-5">

                                {user.role === 'STUDENT' && (
                                    <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-100/50 dark:border-orange-500/20 text-orange-600 dark:text-orange-400" title="Learning streak">
                                        <Flame size={14} className="fill-orange-500" />
                                        <span className="text-xs font-bold tracking-wide">{streak}</span>
                                    </div>
                                )}

                                <button
                                    onClick={toggleDark}
                                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors hidden lg:block"
                                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                >
                                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                </button>

                                {/* Notifications */}
                                <div className="relative" ref={notifRef}>
                                    <button
                                        onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                                        className="text-muted-foreground hover:text-foreground transition-colors relative p-1.5"
                                    >
                                        <Bell size={18} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-background"></span>
                                        )}
                                    </button>

                                    {notifOpen && (
                                        <div className="absolute right-0 top-10 w-80 bg-popover border border-border rounded-2xl shadow-2xl py-2 z-50 overflow-hidden transform origin-top-right transition-all">
                                            <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-popover/50">
                                                <h3 className="text-sm font-extrabold text-popover-foreground">Notifications</h3>
                                                {unreadCount > 0 && (
                                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{unreadCount} new</span>
                                                )}
                                            </div>
                                            <div className="max-h-72 overflow-y-auto">
                                                {notifications.length === 0 ? (
                                                    <div className="px-4 py-8 text-center text-muted-foreground/50">
                                                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                                                        <p className="text-sm font-medium">You're all caught up!</p>
                                                    </div>
                                                ) : (
                                                    notifications.map(notif => (
                                                        <div
                                                            key={notif.id}
                                                            onClick={() => handleMarkRead(notif)}
                                                            className={`px-4 py-3 cursor-pointer relative transition-colors ${notif.read ? 'bg-transparent hover:bg-muted/50' : 'bg-indigo-50/10 dark:bg-indigo-900/10 hover:bg-indigo-50/30'}`}
                                                        >
                                                            {!notif.read && <div className="absolute left-2.5 top-4 w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                                                            <p className={`text-sm ${notif.read ? 'font-medium text-muted-foreground' : 'font-bold text-foreground pl-3'} mb-0.5 leading-snug`}>{notif.message}</p>
                                                            <p className={`text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1 ${!notif.read && 'pl-3'}`}>{formatDate(notif.createdAt || notif.timestamp)}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            {notifications.length > 0 && (
                                                <div className="border-t border-border pt-2 pb-1 bg-muted/30">
                                                    <button onClick={handleMarkAllRead} className="w-full text-center text-indigo-600 dark:text-indigo-400 text-xs font-bold py-1 hover:text-indigo-800 transition-colors">Clear all notifications</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Profile dropdown */}
                                <div className="relative pl-2 border-l border-border" ref={profileRef}>
                                    <button
                                        onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                                        className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-indigo-700 font-bold hover:scale-105 transition-all overflow-hidden"
                                    >
                                        {user?.avatar ? (
                                            <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={18} className="text-indigo-600" />
                                        )}
                                    </button>

                                    {profileOpen && (
                                        <div className="absolute right-0 top-12 w-64 bg-popover border border-border rounded-2xl shadow-xl py-2 z-50 transform origin-top-right transition-all">
                                            <div className="px-5 py-4 border-b border-border bg-popover/50 flex flex-col gap-1">
                                                <p className="text-popover-foreground text-sm font-extrabold truncate">{user?.name}</p>
                                                <p className="text-muted-foreground text-xs font-medium truncate">{user?.email}</p>
                                                <div className="mt-2 inline-flex items-center w-fit">
                                                    <span className="text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">{user?.role?.replace('_', ' ')}</span>
                                                </div>
                                            </div>

                                            <div className="py-2 px-2">
                                                <button onClick={() => { navigate(dashboardPath); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors">
                                                    <LayoutDashboard size={16} /> Dashboard
                                                </button>
                                                <button onClick={() => { navigate('/profile'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors">
                                                    <User size={16} /> Profile
                                                </button>
                                                <button onClick={() => { navigate('/courses'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors">
                                                    <BookOpen size={16} /> My Learning
                                                </button>
                                            </div>

                                            <div className="border-t border-border mt-1 pt-2 px-2">
                                                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                                    <LogOut size={16} /> Sign out
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <button onClick={() => onMobileMenuClick ? onMobileMenuClick() : setMenuOpen(!menuOpen)} className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-2">
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile menu dropdown */}
                {menuOpen && (
                    <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b border-border shadow-2xl py-4 px-4 flex flex-col gap-4 z-50">
                        <form onSubmit={handleSearch} className="w-full relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="text" placeholder="Search exactly what you want..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-muted border border-border rounded-full py-2.5 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100 text-foreground" />
                        </form>

                        {isAuthenticated && (
                            <div className="flex items-center gap-3 pb-4 pt-2 border-b border-border">
                                <div className="w-12 h-12 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <User size={24} className="text-muted-foreground" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-base font-bold text-foreground leading-tight">{user?.name}</p>
                                    <p className="text-xs font-medium text-muted-foreground mt-0.5">{user?.email}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <Link to="/courses" className="text-base font-bold text-foreground/80 px-2 py-3 rounded-xl hover:bg-muted/40">Explore Catalog</Link>
                            {isAuthenticated ? (
                                <>
                                    <button onClick={() => { navigate(dashboardPath); setMenuOpen(false); }} className="text-left text-base font-bold text-foreground/80 px-2 py-3 rounded-xl hover:bg-muted/40">Dashboard</button>
                                    <button onClick={() => { navigate('/profile'); setMenuOpen(false); }} className="text-left text-base font-bold text-foreground/80 px-2 py-3 rounded-xl hover:bg-muted/40">Profile Settings</button>
                                    <button onClick={handleLogout} className="text-left text-base font-bold text-rose-600 px-2 py-3 rounded-xl hover:bg-rose-50 mt-2">Sign out</button>
                                </>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <Link to="/login" className="text-center font-bold text-foreground bg-muted py-3 rounded-xl hover:bg-muted/70 transition-colors">Log in</Link>
                                    <Link to="/register" className="text-center font-bold text-white bg-slate-900 py-3 rounded-xl hover:bg-slate-800 transition-colors">Sign up</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
