import { useState } from 'react';
import { Calendar, Plus, X, Save, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { departmentsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getToken = () => localStorage.getItem('lms_token');

const http = async (method, path, body = null) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: body ? JSON.stringify(body) : null
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
};

export default function AdminTimetable() {
    const { isSuperAdmin } = useAuth();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', departmentId: '', startDate: '', endDate: '', enrollmentOpen: true });
    const [creating, setCreating] = useState(false);

    const { data: departments } = useAsyncData(() => isSuperAdmin() ? departmentsAPI.list() : Promise.resolve([]), [isSuperAdmin]);
    const { data: sessions, loading, reload } = useAsyncData(() => http('GET', '/stats/academic-sessions').catch(() => []), []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.startDate || !form.endDate) { toast.error('Name, start date and end date are required'); return; }
        setCreating(true);
        try {
            await http('POST', '/stats/academic-sessions', form);
            toast.success('Academic session created! 📅');
            setShowCreate(false);
            setForm({ name: '', departmentId: '', startDate: '', endDate: '', enrollmentOpen: true });
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (id, field, value) => {
        try {
            await http('PUT', `/stats/academic-sessions/${id}`, { [field]: value });
            reload();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this academic session?')) return;
        try {
            await http('DELETE', `/stats/academic-sessions/${id}`);
            toast.success('Session deleted');
            reload();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const now = new Date();

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Academic Calendar"
                subtitle="Manage academic sessions, semesters, and enrollment windows."
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> New Session
                    </button>
                }
            />

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {(sessions || []).length === 0 ? (
                        <div className="text-center py-16">
                            <Calendar size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">No academic sessions created yet</p>
                            <button onClick={() => setShowCreate(true)} className="text-indigo-600 text-sm font-bold mt-2">
                                Create your first session
                            </button>
                        </div>
                    ) : (sessions || []).map(session => {
                        const start = new Date(session.start_date);
                        const end = new Date(session.end_date);
                        const active = now >= start && now <= end;
                        const upcoming = now < start;
                        const finished = now > end;

                        return (
                            <div key={session.id} className={`bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all ${active ? 'border-emerald-200 ring-1 ring-emerald-500/20' : finished ? 'border-border opacity-70' : 'border-indigo-200 ring-1 ring-indigo-500/20'}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : upcoming ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-muted text-muted-foreground border border-border'}`}>
                                                {active ? '● Active' : upcoming ? '○ Upcoming' : '✓ Finished'}
                                            </span>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {session.department_name ? `${session.department_name} • ` : ''}
                                                {start.toLocaleDateString()} – {end.toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">{session.name}</h3>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Calendar size={14} />
                                                <span>{Math.ceil((end - start) / (1000 * 60 * 60 * 24))} days</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs">
                                                {session.enrollment_open ? (
                                                    <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={12} /> Enrollments Open</span>
                                                ) : (
                                                    <span className="text-rose-600 font-bold flex items-center gap-1"><XCircle size={12} /> Enrollments Closed</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleToggle(session.id, 'enrollmentOpen', !session.enrollment_open)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${session.enrollment_open ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}
                                        >
                                            {session.enrollment_open ? 'Close' : 'Open'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(session.id)}
                                            className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Calendar size={20} className="text-indigo-600" /> New Session
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Session Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Fall Semester 2026"
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            {isSuperAdmin() && (
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Department</label>
                                    <select
                                        value={form.departmentId}
                                        onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    >
                                        <option value="">All Departments</option>
                                        {(departments || []).map(d => (
                                            <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Start Date *</label>
                                    <input
                                        required
                                        type="date"
                                        value={form.startDate}
                                        onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">End Date *</label>
                                    <input
                                        required
                                        type="date"
                                        value={form.endDate}
                                        onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.enrollmentOpen}
                                    onChange={e => setForm(p => ({ ...p, enrollmentOpen: e.target.checked }))}
                                    className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-foreground">Allow enrollments</span>
                            </label>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                    {creating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</> : <><Save size={15} /> Create Session</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
