import { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, Server, Database, Globe, Zap, Shield, Cpu } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { statsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const ICON_MAP = { Activity, Server, Database, Globe, Shield, Zap };

const INCIDENTS = [
    { date: '2026-05-15', title: 'DB Performance Optimization', status: 'resolved', severity: 'none', desc: 'Indexes were rebuilt on large tables. Query latency decreased by 40%.' },
    { date: '2026-05-08', title: 'Email delay', status: 'resolved', severity: 'minor', desc: 'Transmitter relay was restarted to resolve SMTP timeouts.' },
];

const STATUS_META = {
    operational: { label: 'Operational', icon: CheckCircle, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    degraded: { label: 'Degraded', icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    outage: { label: 'Outage', icon: XCircle, cls: 'text-rose-600 bg-rose-50 border-rose-200' },
};

const SEVERITY_META = {
    none: 'bg-muted text-muted-foreground',
    minor: 'bg-amber-50 text-amber-700 border border-amber-200',
    major: 'bg-rose-50 text-rose-700 border border-rose-200',
};

export default function SystemHealth() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const data = await statsAPI.getSystemHealth();
            setHealth(data);
        } catch {
            toast.error('Failed to fetch system health');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
    }, []);

    const refresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-muted-foreground/60 font-bold">Diagnosing Systems...</div>;

    if (!health) return (
        <div className="p-20 text-center max-w-sm mx-auto">
            <XCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Diagnosis Failed</h2>
            <p className="text-muted-foreground text-sm mb-6">We couldn't connect to the system health probes. Please check your server connection.</p>
            <button onClick={refresh} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold">Retry Diagnostic</button>
        </div>
    );

    const services = health?.services || [];
    const allOperational = services.every(s => s.status === 'operational');
    const degraded = services.filter(s => s.status === 'degraded').length;

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-12">
            <PageHeader
                title="System Health"
                subtitle="Real-time status of all platform services and infrastructure"
                action={
                    <button
                        onClick={refresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-foreground/80 font-bold text-sm hover:bg-muted/40 transition-colors shadow-sm disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
                    </button>
                }
            />

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Heap Used</p>
                            <h4 className="text-2xl font-black text-foreground">{health?.memory?.heapUsed || 0}MB</h4>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Cpu size={20} />
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Uptime</p>
                            <h4 className="text-2xl font-black text-foreground">{Math.floor((health?.uptime || 0) / 3600)}h {Math.floor(((health?.uptime || 0) % 3600) / 60)}m</h4>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Activity size={20} />
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Environment</p>
                            <h4 className="text-2xl font-black text-foreground">{health?.platform || 'Unknown'} <span className="text-xs font-bold text-muted-foreground/60">Node {health?.nodeVersion?.split('.')[0] || '??'}</span></h4>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-muted/40 text-muted-foreground flex items-center justify-center">
                            <Server size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Overall status banner */}
            <div className={`rounded-2xl p-6 border flex items-center gap-5 ${allOperational ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${allOperational ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {allOperational
                        ? <CheckCircle size={28} className="text-emerald-600" />
                        : <AlertTriangle size={28} className="text-amber-600" />
                    }
                </div>
                <div>
                    <h2 className={`text-xl font-extrabold mb-1 ${allOperational ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {allOperational ? 'All Systems Operational' : `${degraded} Service${degraded > 1 ? 's' : ''} Degraded`}
                    </h2>
                    <p className={`text-sm font-medium ${allOperational ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Last heartbeat: {new Date(health.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                </div>
            </div>

            {/* Services */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-foreground font-bold text-lg">Infrastructure Stack</h3>
                </div>
                <div className="divide-y divide-border">
                    {services.map(svc => {
                        const meta = STATUS_META[svc.status] || STATUS_META.operational;
                        const StatusIcon = meta.icon;
                        const SvcIcon = ICON_MAP[svc.icon] || Server;
                        return (
                            <div key={svc.name} className="flex items-center gap-5 px-6 py-5 hover:bg-muted/40 transition-colors">
                                <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                                    <SvcIcon size={18} className="text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-foreground font-bold text-sm">{svc.name}</p>
                                    <p className="text-muted-foreground text-xs font-medium">{svc.desc}</p>
                                </div>
                                <div className="flex items-center gap-6 flex-shrink-0 text-right">
                                    <div className="hidden sm:block">
                                        <p className="text-foreground font-bold text-sm">{svc.uptime}</p>
                                        <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-tighter">Uptime</p>
                                    </div>
                                    <div>
                                        <p className="text-foreground font-bold text-sm tracking-tight">{svc.latency}</p>
                                        <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-tighter">Latency</p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black border uppercase tracking-wider ${meta.cls}`}>
                                        <StatusIcon size={13} />
                                        {meta.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Incidents */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="text-foreground font-bold text-lg">System Log</h3>
                </div>
                <div className="divide-y divide-border">
                    {INCIDENTS.map((inc, i) => (
                        <div key={i} className="px-6 py-5">
                            <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-foreground font-bold text-sm leading-none">{inc.title}</h4>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${SEVERITY_META[inc.severity]}`}>
                                        {inc.severity === 'none' ? 'info' : inc.severity}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${inc.status === 'ongoing' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {inc.status}
                                    </span>
                                </div>
                                <span className="text-muted-foreground/60 text-xs font-bold">{inc.date}</span>
                            </div>
                            <p className="text-muted-foreground text-sm font-medium leading-relaxed">{inc.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
