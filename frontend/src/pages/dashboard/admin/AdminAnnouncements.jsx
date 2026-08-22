import { useState } from 'react';
import { Megaphone, Plus, Pin, Trash2, Edit2, X, Users, Bell, Send, AlertTriangle, Info, EyeOff, CheckCircle, User, Clock, Building2 } from 'lucide-react';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getToken = () => localStorage.getItem('lms_token');

const http = async (method, path, body = null) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: body ? JSON.stringify(body) : null
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
};

export default function AdminAnnouncements() {
    const { isSuperAdmin } = useAuth();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', content: '', priority: 'normal', pinned: false, targetRoles: ['STUDENT', 'INSTRUCTOR'], departmentIds: [] });
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null);
    const { data: departments } = useAsyncData(() => (isSuperAdmin() ? http('GET', '/departments/public') : Promise.resolve([])), [isSuperAdmin]);

    // Read receipts modal state
    const [readsModal, setReadsModal] = useState(null); // announcement object
    const [readsData, setReadsData] = useState(null);
    const [readsLoading, setReadsLoading] = useState(false);

    const { data: announcements, loading, reload } = useAsyncData(() => http('GET', '/announcements'), []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return; }
        setCreating(true);
        try {
            if (editing) {
                await http('PUT', `/announcements/${editing.id}`, form);
                toast.success('Announcement updated!');
            } else {
                await http('POST', '/announcements', form);
                toast.success('Announcement published! 📢');
            }
            setShowCreate(false);
            setEditing(null);
            setForm({ title: '', content: '', priority: 'normal', pinned: false, targetRoles: ['STUDENT', 'INSTRUCTOR'], departmentIds: [] });
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleTogglePin = async (ann) => {
        try {
            await http('PUT', `/announcements/${ann.id}`, { pinned: !ann.pinned });
            toast.success(ann.pinned ? 'Unpinned' : 'Pinned!');
            reload();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            await http('DELETE', `/announcements/${id}`);
            toast.success('Announcement deleted');
            reload();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const openReadsModal = async (ann) => {
        setReadsModal(ann);
        setReadsData(null);
        setReadsLoading(true);
        try {
            const data = await http('GET', `/announcements/${ann.id}/reads`);
            setReadsData(data);
        } catch {
            toast.error('Failed to load readers');
        } finally {
            setReadsLoading(false);
        }
    };

    const priorityIcon = (p) => {
        if (p === 'high') return <AlertTriangle size={14} className="text-rose-500" />;
        if (p === 'urgent') return <Bell size={14} className="text-red-500" />;
        return <Info size={14} className="text-blue-500" />;
    };

    const priorityColor = (p) => {
        if (p === 'high') return 'bg-rose-50 text-rose-600 border-rose-200';
        if (p === 'urgent') return 'bg-red-50 text-red-600 border-red-200';
        return 'bg-blue-50 text-blue-600 border-blue-200';
    };

    const roleBadge = (role) => {
        const colors = {
            STUDENT: 'bg-emerald-100 text-emerald-700',
            INSTRUCTOR: 'bg-indigo-100 text-indigo-700',
            ADMIN: 'bg-amber-100 text-amber-700',
            SUPER_ADMIN: 'bg-purple-100 text-purple-700',
        };
        return colors[role] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Department Announcements"
                subtitle="Broadcast messages to all students and instructors in your department."
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> New Announcement
                    </button>
                }
            />

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-4">
                    {(announcements || []).length === 0 ? (
                        <div className="text-center py-16">
                            <Megaphone size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">No announcements yet</p>
                            <button onClick={() => setShowCreate(true)} className="text-indigo-600 hover:text-indigo-700 text-sm font-bold mt-2">
                                Create the first one
                            </button>
                        </div>
                    ) : (announcements || []).map(ann => (
                        <div
                            key={ann.id}
                            className={`bg-card border ${ann.pinned ? 'border-indigo-200 dark:border-indigo-800' : 'border-border'} rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow ${ann.pinned ? 'ring-1 ring-indigo-500/20' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        {ann.pinned && (
                                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                                                <Pin size={10} /> Pinned
                                            </span>
                                        )}
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider border flex items-center gap-1 ${priorityColor(ann.priority)}`}>
                                            {priorityIcon(ann.priority)} {ann.priority}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-medium">
                                            {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-2">{ann.title}</h3>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2">{ann.content}</p>
                                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Users size={12} /> {(ann.target_roles || []).join(', ') || 'All'}</span>
                                        <span className="flex items-center gap-1"><User size={12} /> {ann.author_name || 'Unknown'}</span>
                                        <span className="flex items-center gap-1"><EyeOff size={12} /> {ann.view_count || 0} views</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 sm:gap-2 flex-shrink-0 items-start">
                                    <button
                                        onClick={() => openReadsModal(ann)}
                                        className="p-2 rounded-lg text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                        title="View read receipts"
                                    >
                                        <CheckCircle size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleTogglePin(ann)}
                                        className={`p-2 rounded-lg transition-colors ${ann.pinned ? 'bg-indigo-50 text-indigo-600' : 'text-muted-foreground hover:bg-muted'}`}
                                        title={ann.pinned ? 'Unpin' : 'Pin'}
                                    >
                                        <Pin size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditing(ann);
                                            setForm({ title: ann.title, content: ann.content, priority: ann.priority, pinned: ann.pinned, targetRoles: ann.target_roles || [], departmentIds: [] });
                                            setShowCreate(true);
                                        }}
                                        className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ann.id)}
                                        className="p-2 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Megaphone size={20} className="text-indigo-600" />
                                {editing ? 'Edit Announcement' : 'New Announcement'}
                            </h3>
                            <button onClick={() => { setShowCreate(false); setEditing(null); }} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Exam Schedule Announcement"
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Content *</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={form.content}
                                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                                    placeholder="Write your announcement here..."
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Priority</label>
                                    <select
                                        value={form.priority}
                                        onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Target</label>
                                    <select
                                        value={form.targetRoles.join(',')}
                                        onChange={e => setForm(p => ({ ...p, targetRoles: e.target.value.split(',').filter(Boolean), departmentIds: [] }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    >
                                        <option value="STUDENT,INSTRUCTOR">Students & Instructors</option>
                                        <option value="STUDENT">Students Only</option>
                                        <option value="INSTRUCTOR">Instructors Only</option>
                                        {isSuperAdmin() && (
                                            <>
                                                <option value="ADMIN">Department Admins Only</option>
                                                <option value="ADMIN,SUPER_ADMIN">All Admins (incl. Super Admin)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                            {isSuperAdmin() && form.targetRoles.includes('ADMIN') && (
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                                        <Building2 size={12} /> Target specific department admins
                                    </label>
                                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto bg-muted/30 border border-border rounded-xl p-3">
                                        {(departments || []).map(d => {
                                            const checked = form.departmentIds.includes(d.id);
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    onClick={() => setForm(p => ({
                                                        ...p,
                                                        departmentIds: checked
                                                            ? p.departmentIds.filter(x => x !== d.id)
                                                            : [...p.departmentIds, d.id],
                                                    }))}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${checked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
                                                >
                                                    {d.icon || '🏛️'} {d.name}
                                                </button>
                                            );
                                        })}
                                        {(!departments || departments.length === 0) && (
                                            <span className="text-xs text-muted-foreground">No departments available</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {form.departmentIds.length > 0
                                            ? `Only admins of the ${form.departmentIds.length} selected department(s) will be notified.`
                                            : 'No filter — admins of all departments will be notified.'}
                                    </p>
                                </div>
                            )}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.pinned}
                                    onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))}
                                    className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-foreground">Pin this announcement</span>
                            </label>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreate(false); setEditing(null); }}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                >
                                    {creating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Publishing...</> : <><Send size={15} /> {editing ? 'Update' : 'Publish'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Read Receipts Modal */}
            {readsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setReadsModal(null)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/30">
                            <div>
                                <h3 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                    <CheckCircle size={18} className="text-emerald-600" />
                                    Read Receipts
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{readsModal.title}</p>
                            </div>
                            <button onClick={() => setReadsModal(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto">
                            {readsLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : !readsData || !readsData.readers?.length ? (
                                <div className="text-center py-10">
                                    <EyeOff size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                                    <p className="text-sm text-muted-foreground font-medium">No one has read this announcement yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                                        <span>{readsData.total} reader{readsData.total !== 1 ? 's' : ''}</span>
                                    </div>
                                    {readsData.readers.map(reader => (
                                        <div key={reader.userId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                                {reader.name?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-foreground truncate">{reader.name}</span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${roleBadge(reader.role)}`}>
                                                        {reader.role}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                                    <Clock size={10} />
                                                    {new Date(reader.readAt).toLocaleDateString('en-US', {
                                                        month: 'short', day: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                            <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-border bg-muted/20">
                            <button
                                onClick={() => setReadsModal(null)}
                                className="w-full px-6 py-2.5 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
