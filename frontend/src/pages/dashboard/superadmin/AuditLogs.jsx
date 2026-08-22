import { useState, useEffect, useCallback } from 'react';
import {
    Database, Search, Shield, UserX, UserCheck, BookOpen, MessageSquare, Filter,
    ChevronLeft, ChevronRight, Download, KeyRound, UserPlus, Megaphone,
    Building2, ClipboardList, PenLine, Lock, Globe, MonitorSmartphone, X, RefreshCw, Settings,
} from 'lucide-react';
import { statsAPI } from '../../../services/api';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

// ── Action presentation ───────────────────────────────────────────────────────
// Derived from the action prefix so every action (old and new) renders nicely
// without maintaining a giant map. Explicit overrides win.
const ACTION_OVERRIDES = {
    USER_LOGIN: { label: 'Logged In', icon: KeyRound, color: 'text-sky-600 bg-sky-50 border-sky-200' },
    USER_REGISTERED: { label: 'Registered', icon: UserPlus, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    USER_ROLE_CHANGED: { label: 'Role Changed', icon: Shield, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    USER_ACTIVATED: { label: 'Account Activated', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    USER_SUSPENDED: { label: 'Account Suspended', icon: UserX, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    USER_PASSWORD_RESET: { label: 'Password Reset', icon: Lock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    PASSWORD_CHANGED: { label: 'Password Changed', icon: Lock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    PASSWORD_RESET: { label: 'Password Reset', icon: Lock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    PERMISSIONS_UPDATED: { label: 'Permissions Updated', icon: Shield, color: 'text-violet-600 bg-violet-50 border-violet-200' },
    COURSE_APPROVED: { label: 'Course Approved', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    COURSE_REJECTED: { label: 'Course Rejected', icon: BookOpen, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    COURSE_PUBLISHED: { label: 'Course Published', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    REVIEW_DELETED: { label: 'Review Deleted', icon: MessageSquare, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    PLATFORM_SETTINGS_UPDATED: { label: 'Settings Updated', icon: Settings, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
};

const ACTION_GROUPS = [
    { match: /^USER_|^USERS_|^STUDENT_|^INSTRUCTOR_|^ADMIN_|^PASSWORD_/, label: 'User Action', icon: UserCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { match: /^COURSE_|^SECTION|^LESSON/, label: 'Course Action', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { match: /^QUIZ_/, label: 'Quiz Action', icon: ClipboardList, color: 'text-sky-600 bg-sky-50 border-sky-200' },
    { match: /^ASSIGNMENT_|^SUBMISSION_/, label: 'Assignment Action', icon: ClipboardList, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    { match: /^ANNOUNCEMENT/, label: 'Announcement', icon: Megaphone, color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { match: /^DEPARTMENT/, label: 'Department Action', icon: Building2, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { match: /^CATEGORY/, label: 'Category Action', icon: Database, color: 'text-teal-600 bg-teal-50 border-teal-200' },
    { match: /^ENROLLMENT|^BULK/, label: 'Enrollment', icon: UserPlus, color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200' },
];

const fallbackMeta = (action) => ({
    label: String(action || 'Action').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: Database,
    color: 'text-muted-foreground bg-muted/40 border-border',
});

const actionMeta = (action) => {
    if (ACTION_OVERRIDES[action]) return ACTION_OVERRIDES[action];
    const group = ACTION_GROUPS.find(g => g.match.test(action || ''));
    return group || fallbackMeta(action);
};

// Human-readable summary of the change, e.g. "Active → Inactive".
const changeSummary = (log) => {
    const oldV = log.oldValue;
    const newV = log.newValue;
    const pick = (v, keys) => {
        if (!v || typeof v !== 'object') return v;
        for (const k of keys) {
            if (v[k] !== undefined && v[k] !== null) return v[k];
        }
        return undefined;
    };
    const fmt = (v) => {
        if (typeof v === 'boolean') return v ? 'Active' : 'Inactive';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    };
    const oldPick = pick(oldV, ['active', 'status', 'role', 'overrides']);
    const newPick = pick(newV, ['active', 'status', 'role', 'overrides']);
    if (oldPick !== undefined || newPick !== undefined) {
        return `${oldPick !== undefined ? fmt(oldPick) : '—'} → ${newPick !== undefined ? fmt(newPick) : '—'}`;
    }
    return null;
};

// Which-record label: prefer a human identifier from details (roll_no / studentId
// / name), fall back to the raw resource id.
const recordLabel = (log) => {
    const d = log.details || {};
    return d.studentId || d.rollNo || d.roll_no || d.targetName || d.targetEmail || log.resourceId || '';
};

const deviceText = (log) => {
    const d = log.device || {};
    return [d.browser, d.os].filter(Boolean).join(' · ') || 'Unknown device';
};

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);

    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');
    const [filterResource, setFilterResource] = useState('ALL');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    const loadActions = useCallback(() => {
        statsAPI.getAuditLogActions().then(setActions).catch(() => setActions([]));
    }, []);

    useEffect(() => { loadActions(); }, [loadActions]);

    const loadLogs = useCallback(() => {
        setLoading(true);
        statsAPI.getAuditLogs({
            search: search || undefined,
            action: filterAction === 'ALL' ? undefined : filterAction,
            resource: filterResource === 'ALL' ? undefined : filterResource,
            from: from || undefined,
            to: to || undefined,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
        })
            .then(res => {
                // Backend returns { data, total } — tolerate legacy plain arrays.
                const data = Array.isArray(res) ? res : (res.data || []);
                setLogs(data);
                setTotal(Array.isArray(res) ? data.length : (res.total ?? data.length));
            })
            .catch(() => { setLogs([]); setTotal(0); })
            .finally(() => setLoading(false));
    }, [search, filterAction, filterResource, from, to, page]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    const resources = [...new Set(logs.map(l => l.resource).filter(Boolean))];
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const resetFilters = () => {
        setSearch(''); setFilterAction('ALL'); setFilterResource('ALL'); setFrom(''); setTo(''); setPage(1);
    };

    const exportCsv = () => {
        const rows = [['Time', 'Who', 'Role', 'Action', 'Record', 'Old value', 'New value', 'IP', 'Device']];
        logs.forEach(l => {
            rows.push([
                new Date(l.timestamp).toLocaleString('en-IN'),
                l.userName,
                l.userRole || '',
                l.action,
                `${l.resource || ''}${l.resourceId ? ` (${l.resourceId})` : ''}`,
                l.oldValue ? JSON.stringify(l.oldValue) : '',
                l.newValue ? JSON.stringify(l.newValue) : '',
                l.ip,
                deviceText(l),
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const inputCls = "px-3 py-2 bg-card border border-border text-foreground rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm";

    return (
        <div className="space-y-6 max-w-7xl">
            <PageHeader
                title="Audit Logs"
                subtitle="Who did what, when, to which record — with old/new values and device info"
            />

            <div className="bg-card border border-border rounded-2xl shadow-sm">
                {/* Filters */}
                <div className="p-6 border-b border-border space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Search by user, record id, or details..."
                                className={`${inputCls} w-full pl-10 pr-4`}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Filter size={16} className="text-muted-foreground/60 flex-shrink-0" />
                            <select
                                value={filterAction}
                                onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                                className={inputCls}
                            >
                                <option value="ALL">All actions</option>
                                {actions.map(a => (
                                    <option key={a.action} value={a.action}>
                                        {actionMeta(a.action).label} ({a.count})
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filterResource}
                                onChange={e => { setFilterResource(e.target.value); setPage(1); }}
                                className={inputCls}
                            >
                                <option value="ALL">All records</option>
                                {resources.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            From
                            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className={inputCls} />
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            To
                            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className={inputCls} />
                        </label>
                        {(search || filterAction !== 'ALL' || filterResource !== 'ALL' || from || to) && (
                            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <X size={14} /> Clear filters
                            </button>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                            <button
                                onClick={loadLogs}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw size={14} /> Refresh
                            </button>
                            <button
                                onClick={exportCsv}
                                disabled={!logs.length}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Download size={14} /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Log entries */}
                {loading ? (
                    <LoadingContainer height="h-64" />
                ) : logs.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground font-medium">No audit entries match your filters.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {logs.map(log => {
                            const meta = actionMeta(log.action);
                            const Icon = meta.icon;
                            const change = changeSummary(log);
                            const record = recordLabel(log);
                            const isOpen = expanded === log.id;
                            return (
                                <div key={log.id} className="px-6 py-4 hover:bg-muted/40 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${meta.color}`}>
                                            <Icon size={17} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                                <div className="min-w-0">
                                                    <p className="text-foreground font-bold text-sm">
                                                        <span className="text-indigo-600">{log.userName}</span>
                                                        {log.userRole && (
                                                            <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/50">{log.userRole.replace('_', ' ')}</span>
                                                        )}
                                                        <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                    </p>
                                                    <p className="text-muted-foreground text-sm font-medium mt-1">
                                                        {log.resource && (
                                                            <span className="text-muted-foreground/60">Record: </span>
                                                        )}
                                                        <span className="text-foreground/80 font-bold">
                                                            {log.resource}{record ? ` — ${record}` : ''}
                                                        </span>
                                                    </p>
                                                    {change && (
                                                        <p className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-bold text-foreground/80">
                                                            {change}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-muted-foreground text-[12px] font-medium">
                                                        {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-muted-foreground/70 text-[11px] font-medium">
                                                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <p className="text-muted-foreground/30 text-[11px] font-mono mt-1">{log.ip}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/60 font-medium">
                                                <span className="inline-flex items-center gap-1"><MonitorSmartphone size={12} /> {deviceText(log)}</span>
                                                {log.details && Object.keys(log.details).length > 0 && (
                                                    <button
                                                        onClick={() => setExpanded(isOpen ? null : log.id)}
                                                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
                                                    >
                                                        <PenLine size={12} /> {isOpen ? 'Hide details' : 'View details'}
                                                    </button>
                                                )}
                                            </div>
                                            {isOpen && (
                                                <pre className="mt-3 p-3 rounded-xl bg-muted/60 text-[11px] font-mono text-muted-foreground overflow-x-auto">
                                                    {JSON.stringify({ oldValue: log.oldValue, newValue: log.newValue, details: log.details }, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination + summary */}
                <div className="px-6 py-4 border-t border-border bg-muted/40 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-muted-foreground text-xs font-medium">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} entries
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-card border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeft size={14} /> Prev
                        </button>
                        <span className="text-xs font-bold text-muted-foreground">Page {page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-card border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                <Globe size={12} /> Super Admin sees the full platform trail. Department admins see only entries from their own department.
            </p>
        </div>
    );
}
