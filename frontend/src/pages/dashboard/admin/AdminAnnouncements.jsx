import { useState } from 'react';
import { Megaphone, Plus, Pin, Trash2, Edit2, X, Users, Bell, Send, AlertTriangle, Info } from 'lucide-react';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

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
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', content: '', priority: 'normal', pinned: false, targetRoles: ['STUDENT', 'INSTRUCTOR'] });
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null);

    const { data: announcements, loading, reload } = useAsyncData(() => http('GET', '/announcements'), []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return; }
        setCreating(true);
        try {
            await http('POST', '/announcements', form);
            toast.success('Announcement published! 📢');
            setShowCreate(false);
            setForm({ title: '', content: '', priority: 'normal', pinned: false, targetRoles: ['STUDENT', 'INSTRUCTOR'] });
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
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
                                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Users size={12} /> {(ann.target_roles || []).join(', ') || 'All'}</span>
                                        <span>by {ann.author_name || 'Unknown'}</span>
                                    </div>
                                </div>
                                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
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
                                            setForm({ title: ann.title, content: ann.content, priority: ann.priority, pinned: ann.pinned, targetRoles: ann.target_roles });
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
                                        onChange={e => setForm(p => ({ ...p, targetRoles: e.target.value.split(',').filter(Boolean) }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    >
                                        <option value="STUDENT,INSTRUCTOR">Students & Instructors</option>
                                        <option value="STUDENT">Students Only</option>
                                        <option value="INSTRUCTOR">Instructors Only</option>
                                    </select>
                                </div>
                            </div>
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
        </div>
    );
}
