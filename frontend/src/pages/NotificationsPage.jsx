import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, Megaphone, ClipboardList, Award, GraduationCap, BookOpen, MessageSquare,
    Info, AlertTriangle, CheckCircle, CheckCheck, Trash2, ArrowRight, Loader2, Inbox,
} from 'lucide-react';
import { notificationsAPI } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingContainer } from '../components/ui/Feedback';
import toast from 'react-hot-toast';

// ── Type → icon + color + label ──────────────────────────────────────────────
const TYPE_META = {
    announcement: { icon: Megaphone, cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Announcement' },
    quiz:         { icon: ClipboardList, cls: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', label: 'Quiz' },
    grade:        { icon: Award, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Grade' },
    certificate:  { icon: GraduationCap, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', label: 'Certificate' },
    enrollment:   { icon: BookOpen, cls: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400', label: 'Enrollment' },
    discussion:   { icon: MessageSquare, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', label: 'Discussion' },
    warning:      { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', label: 'Warning' },
    error:        { icon: AlertTriangle, cls: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', label: 'Error' },
    success:      { icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Success' },
    info:         { icon: Info, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', label: 'Info' },
};
const DEFAULT_META = { icon: Bell, cls: 'bg-muted text-muted-foreground', label: 'Notification' };
const typeMeta = (t) => TYPE_META[t] || DEFAULT_META;

const PAGE = 25;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const groupKey = (iso) => {
    const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return 'This Week';
    return 'Earlier';
};
const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier'];

const timeAgo = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationsPage() {
    const navigate = useNavigate();

    const [notifs, setNotifs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // all | unread | read
    const [typeFilter, setTypeFilter] = useState('all');
    const [busyId, setBusyId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [clearing, setClearing] = useState(false);

    const fetchPage = useCallback(async (offset, append) => {
        if (offset === 0) setLoading(true); else setLoadingMore(true);
        try {
            const { data, pagination } = await notificationsAPI.getPage({ limit: PAGE, offset });
            setNotifs(prev => append ? [...prev, ...data] : data);
            setTotal(pagination?.total ?? data.length);
            setHasMore((pagination?.total ?? 0) > offset + data.length);
        } catch (err) {
            toast.error(err.message || 'Failed to load notifications');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => { fetchPage(0, false); }, [fetchPage]);

    const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);
    const types = useMemo(() => {
        const set = new Set(notifs.map(n => n.type || 'info'));
        return ['all', ...set];
    }, [notifs]);

    const filtered = useMemo(() => notifs.filter(n =>
        (statusFilter === 'all' || (statusFilter === 'unread' ? !n.read : n.read)) &&
        (typeFilter === 'all' || (n.type || 'info') === typeFilter)
    ), [notifs, statusFilter, typeFilter]);

    const grouped = useMemo(() => {
        const map = {};
        for (const n of filtered) {
            const k = groupKey(n.createdAt || n.created_at);
            (map[k] = map[k] || []).push(n);
        }
        return GROUP_ORDER.filter(k => map[k]).map(k => ({ label: k, items: map[k] }));
    }, [filtered]);

    const openLink = (link) => {
        if (!link) return;
        if (link.startsWith('http')) { window.open(link, '_blank', 'noopener'); return; }
        navigate(link);
    };

    const handleClick = async (n) => {
        if (!n.read) {
            setBusyId(n.id);
            try {
                await notificationsAPI.markRead(null, n.id);
                setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
            } catch { /* non-fatal — still let them navigate */ }
            finally { setBusyId(null); }
        }
        openLink(n.link);
    };

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        try {
            await notificationsAPI.markAllRead();
            setNotifs(prev => prev.map(n => ({ ...n, read: true })));
            toast.success('All notifications marked as read');
        } catch (err) {
            toast.error(err.message || 'Failed to mark notifications as read');
        } finally {
            setMarkingAll(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
        setClearing(true);
        try {
            await notificationsAPI.clearAll();
            setNotifs([]);
            setTotal(0);
            setHasMore(false);
            toast.success('All notifications cleared');
        } catch (err) {
            toast.error(err.message || 'Failed to clear notifications');
        } finally {
            setClearing(false);
        }
    };

    const statCard = (label, value, accent) => (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <p className={`text-3xl font-extrabold ${accent}`}>{value}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title="Notifications"
                subtitle="Everything the platform wants you to know — announcements, grades, quizzes, and more"
                action={
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleMarkAllRead}
                            disabled={markingAll || unreadCount === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-foreground transition-colors shadow-sm"
                        >
                            {markingAll ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} className="text-emerald-600" />}
                            Mark All Read
                        </button>
                        <button
                            onClick={handleClearAll}
                            disabled={clearing || notifs.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-muted-foreground hover:text-rose-600 transition-colors shadow-sm"
                        >
                            {clearing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            Clear All
                        </button>
                    </div>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCard('Total', total, 'text-foreground')}
                {statCard('Unread', unreadCount, 'text-indigo-600')}
                {statCard('Today', notifs.filter(n => groupKey(n.createdAt || n.created_at) === 'Today').length, 'text-cyan-600')}
                {statCard('Read', notifs.length - unreadCount, 'text-emerald-600')}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex gap-2">
                    {[['all', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => setStatusFilter(val)}
                            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${statusFilter === val ? 'bg-indigo-600 text-white shadow-sm' : 'bg-muted/40 text-muted-foreground hover:text-foreground'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="sm:ml-auto px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold cursor-pointer"
                >
                    <option value="all">All Types</option>
                    {types.filter(t => t !== 'all').map(t => (
                        <option key={t} value={t}>{typeMeta(t).label}</option>
                    ))}
                </select>
            </div>

            {/* List */}
            {loading ? (
                <LoadingContainer height="h-64" />
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-card border border-border rounded-2xl border-dashed">
                    <Inbox size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">
                        {notifs.length === 0 ? 'You\u2019re all caught up — no notifications yet.' : 'No notifications match the current filters.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map(group => (
                        <div key={group.label}>
                            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 px-1 mb-2">
                                {group.label} · {group.items.length}
                            </p>
                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
                                {group.items.map(n => {
                                    const meta = typeMeta(n.type);
                                    const Icon = meta.icon;
                                    return (
                                        <div
                                            key={n.id}
                                            onClick={() => handleClick(n)}
                                            className={`flex items-start gap-4 px-4 sm:px-6 py-4 cursor-pointer transition-colors ${n.read ? 'hover:bg-muted/40' : 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                                                {busyId === n.id ? <Loader2 size={16} className="animate-spin" /> : <Icon size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">{meta.label}</span>
                                                    {!n.read && (
                                                        <span className="w-2 h-2 rounded-full bg-indigo-600" title="Unread" />
                                                    )}
                                                    <span className="ml-auto text-[11px] font-bold text-muted-foreground/70 whitespace-nowrap">{timeAgo(n.createdAt || n.created_at)}</span>
                                                </div>
                                                <p className={`text-sm mt-1 leading-snug ${n.read ? 'text-muted-foreground font-medium' : 'text-foreground font-bold'}`}>
                                                    {n.message}
                                                </p>
                                            </div>
                                            {n.link && (
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 mt-1 flex-shrink-0 transition-colors">
                                                    View <ArrowRight size={12} />
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <button
                            onClick={() => fetchPage(notifs.length, true)}
                            disabled={loadingMore}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-card border border-border hover:bg-muted/60 disabled:opacity-50 rounded-2xl text-sm font-bold text-indigo-600 dark:text-indigo-400 transition-colors shadow-sm"
                        >
                            {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                            Load More
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
