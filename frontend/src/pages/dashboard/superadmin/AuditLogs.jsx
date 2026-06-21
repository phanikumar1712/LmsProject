import { useState, useEffect } from 'react';
import { Database, Search, Shield, UserX, BookOpen, CreditCard, MessageSquare, Filter } from 'lucide-react';
import { statsAPI } from '../../../services/api';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

const ACTION_META = {
    COURSE_APPROVED: { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: BookOpen, label: 'Course Approved' },
    USER_DEACTIVATED: { color: 'text-rose-600 bg-rose-50 border-rose-200', icon: UserX, label: 'User Deactivated' },
    REVIEW_DELETED: { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: MessageSquare, label: 'Review Deleted' },
    PLAN_UPDATED: { color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CreditCard, label: 'Plan Updated' },
    USER_ROLE_CHANGED: { color: 'text-purple-600 bg-purple-50 border-purple-200', icon: Shield, label: 'Role Changed' },
};

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');

    useEffect(() => {
        statsAPI.getAuditLogs().then(setLogs).finally(() => setLoading(false));
    }, []);

    const actions = ['ALL', ...Object.keys(ACTION_META)];
    const filtered = logs.filter(log => {
        const matchSearch = log.userName.toLowerCase().includes(search.toLowerCase()) ||
            log.target.toLowerCase().includes(search.toLowerCase()) ||
            log.action.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filterAction === 'ALL' || log.action === filterAction;
        return matchSearch && matchFilter;
    });

    return (
        <div className="space-y-6 max-w-7xl">
            <PageHeader
                title="Audit Logs"
                subtitle="Complete record of all admin and super-admin actions on the platform"
            />

            <div className="bg-card border border-border rounded-2xl shadow-sm">
                {/* Filters */}
                <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by user, action, or target..."
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border text-foreground rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter size={16} className="text-muted-foreground/60 flex-shrink-0" />
                        {actions.map(a => (
                            <button
                                key={a}
                                onClick={() => setFilterAction(a)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${filterAction === a
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                {a === 'ALL' ? 'All Actions' : ACTION_META[a]?.label || a}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Log entries */}
                {loading ? (
                    <LoadingContainer height="h-48" />
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground font-medium">No logs match your filters.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {filtered.map(log => {
                            const meta = ACTION_META[log.action] || { color: 'text-muted-foreground bg-muted/40 border-border', icon: Database, label: log.action };
                            const Icon = meta.icon;
                            return (
                                <div key={log.id} className="flex items-start gap-4 px-6 py-5 hover:bg-muted/40 transition-colors">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${meta.color}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-foreground font-bold text-sm">
                                                    <span className="text-indigo-600">{log.userName}</span>{' '}
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${meta.color}`}>
                                                        {meta.label}
                                                    </span>
                                                </p>
                                                <p className="text-muted-foreground text-sm font-medium mt-0.5">Target: <span className="text-foreground/80 font-bold">{log.target}</span></p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-muted-foreground text-[12px] font-medium">
                                                    {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <p className="text-muted-foreground/60 text-[11px] font-medium">
                                                    {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-muted-foreground/30 text-[11px] font-mono mt-0.5">{log.ip}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="px-6 py-4 border-t border-border bg-muted/40 rounded-b-2xl">
                    <p className="text-muted-foreground text-xs font-medium">Showing {filtered.length} of {logs.length} total log entries</p>
                </div>
            </div>
        </div>
    );
}
