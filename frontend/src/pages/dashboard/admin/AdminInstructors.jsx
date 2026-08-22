import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Plus, Pencil, Trash2, Eye, Power, RotateCcw, BookOpen, X, Check, Loader2, Presentation,
} from 'lucide-react';
import { usersAPI, coursesAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DataTable, UserCell } from '../../../components/ui/DataTable';
import DragTransfer from '../../../components/ui/DragTransfer';
import toast from 'react-hot-toast';

const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

const inputCls = 'w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium';
const labelCls = 'text-xs font-black uppercase tracking-wider text-muted-foreground ml-1';

const emptyForm = () => ({ name: '', email: '', phone: '', designation: '', qualification: '', specialization: '' });

export default function AdminInstructors() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const { data: instructors, loading, reload } = useAsyncData(
        () => usersAPI.getAll({ role: 'INSTRUCTOR', search: search || undefined, status: statusFilter || undefined, limit: 500 }),
        [search, statusFilter]
    );
    const { data: courses, reload: reloadCourses } = useAsyncData(
        () => coursesAPI.getAll({ admin: true, limit: 500 }),
        []
    );
    const list = useMemo(() => (Array.isArray(instructors) ? instructors : []), [instructors]);
    const courseList = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);

    // Modals
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(emptyForm());
    const [creating, setCreating] = useState(false);
    const [createResult, setCreateResult] = useState(null);

    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    const [assigning, setAssigning] = useState(null); // instructor object
    const [assignBusy, setAssignBusy] = useState(false);

    const [resetResult, setResetResult] = useState(null);
    const [resetting, setResetting] = useState(false);

    const [deleting, setDeleting] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name.trim() || !createForm.email.trim()) { toast.error('Name and email are required'); return; }
        setCreating(true);
        try {
            const res = await usersAPI.createInstructor({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                phone: createForm.phone.trim(),
                designation: createForm.designation.trim() || undefined,
                qualification: createForm.qualification.trim() || undefined,
                specialization: createForm.specialization.trim() || undefined,
            });
            toast.success(`Instructor "${createForm.name.trim()}" created`);
            setCreateResult(res);
            setCreateForm(emptyForm());
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to create instructor');
        } finally {
            setCreating(false);
        }
    };

    const openEdit = (inst) => {
        setEditForm({
            name: inst.name || '', email: inst.email || '', phone: inst.phone || '',
            designation: inst.designation || '', qualification: inst.qualification || '', specialization: inst.specialization || '',
        });
        setEditing(inst);
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim() || !editForm.email.trim()) { toast.error('Name and email are required'); return; }
        setSaving(true);
        try {
            await usersAPI.updateUser(editing.id, {
                name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim(),
                designation: editForm.designation || null, qualification: editForm.qualification || null, specialization: editForm.specialization || null,
            });
            toast.success(`Instructor "${editForm.name.trim()}" updated`);
            setEditing(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update instructor');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async (inst) => {
        setResetting(true);
        try {
            const res = await usersAPI.resetPassword(inst.id);
            setResetResult({ name: inst.name, tempPassword: res.tempPassword });
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    const handleToggle = async (inst) => {
        setTogglingId(inst.id);
        try {
            await usersAPI.toggleStatus(inst.id);
            toast.success(inst.active ? `${inst.name} suspended` : `${inst.name} activated`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;
        setDeleteBusy(true);
        try {
            await usersAPI.delete(deleting.id);
            toast.success(`Instructor "${deleting.name}" deleted`);
            setDeleting(null);
            reload();
        } catch (err) {
            toast.error(err.message || 'Failed to delete instructor');
        } finally {
            setDeleteBusy(false);
        }
    };

    // ── Drag-and-drop course assignment ─────────────────────────────────────
    const assignedCourses = useMemo(() => {
        if (!assigning) return [];
        return courseList.filter(c => String(c.instructorId) === String(assigning.id));
    }, [assigning, courseList]);
    const availableCourses = useMemo(() => {
        if (!assigning) return [];
        return courseList.filter(c => String(c.instructorId || '') !== String(assigning.id));
    }, [assigning, courseList]);

    const handleCourseTransfer = async (items, direction) => {
        if (!assigning || !items.length) return;
        setAssignBusy(true);
        try {
            for (const c of items) {
                if (direction === 'toRight') {
                    await coursesAPI.assignInstructor(c.id, assigning.id);
                } else {
                    await coursesAPI.assignInstructor(c.id, null); // unassign
                }
            }
            toast.success(direction === 'toRight'
                ? `Assigned ${items.length} course${items.length === 1 ? '' : 's'} to ${assigning.name}`
                : `Removed ${items.length} course${items.length === 1 ? '' : 's'} from ${assigning.name}`);
            await reloadCourses();
            await reload();
        } catch (err) {
            toast.error(err.message || 'Course assignment failed');
        } finally {
            setAssignBusy(false);
        }
    };

    const renderCourse = (c) => (
        <span className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center flex-shrink-0">
                <BookOpen size={12} className="text-muted-foreground" />
            </span>
            <span className="truncate">{c.title}</span>
            <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${c.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : c.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                {c.status}
            </span>
        </span>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        <Presentation size={26} className="text-indigo-600" />
                        Instructor Management
                    </span>
                }
                subtitle="Manage your department's instructors — add, edit, reset passwords, and assign courses with drag-and-drop"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name / email / username…"
                        className="w-64 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm"
                    />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-medium outline-none cursor-pointer">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </div>
                <button onClick={() => { setCreateForm(emptyForm()); setCreateResult(null); setShowCreate(true); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
                    <Plus size={16} /> Add Instructor
                </button>
            </div>

            <DataTable
                loading={loading}
                columns={['Instructor', 'Email', 'Designation', 'Status', 'Created', '']}
                emptyMessage={search || statusFilter ? 'No instructors match the current filters' : 'No instructors yet — add your first instructor'}
            >
                {list.map(inst => (
                    <tr key={inst.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                            <UserCell
                                name={<span className="font-bold text-foreground">{inst.name}</span>}
                                subtitle={`${inst.username ? '@' + inst.username + ' · ' : ''}ID ${shortId(inst.id)}`}
                                avatar={inst.avatar}
                            />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{inst.email}</td>
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{inst.designation || '—'}</td>
                        <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wide ${inst.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${inst.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} /> {inst.active ? 'Active' : 'Suspended'}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{fmtDate(inst.createdAt)}</td>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                                <Link to={`/admin/users/${inst.id}`} title="View profile" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-indigo-600 transition-colors"><Eye size={15} /></Link>
                                <button onClick={() => openEdit(inst)} title="Edit" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-indigo-600 transition-colors"><Pencil size={15} /></button>
                                <button onClick={() => setAssigning(inst)} title="Assign courses (drag & drop)" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-cyan-600 transition-colors"><BookOpen size={15} /></button>
                                <button onClick={() => handleReset(inst)} disabled={resetting} title="Reset password" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-600 transition-colors"><RotateCcw size={15} /></button>
                                <button onClick={() => handleToggle(inst)} disabled={togglingId === inst.id} title={inst.active ? 'Suspend' : 'Activate'} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-colors"><Power size={15} /></button>
                                <button onClick={() => setDeleting(inst)} title="Delete" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-600 transition-colors"><Trash2 size={15} /></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </DataTable>

            {/* ── Create modal ──────────────────────────────────────────────── */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2"><Presentation size={20} className="text-indigo-600" /> Add Instructor</h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        {!createResult ? (
                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Full Name *</label>
                                        <input className={inputCls} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Ravi Kumar" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email *</label>
                                        <input type="email" className={inputCls} value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="ravi@college.edu" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Phone</label>
                                    <input className={inputCls} value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Designation</label>
                                        <input className={inputCls} value={createForm.designation} onChange={e => setCreateForm(f => ({ ...f, designation: e.target.value }))} placeholder="Professor" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Qualification</label>
                                        <input className={inputCls} value={createForm.qualification} onChange={e => setCreateForm(f => ({ ...f, qualification: e.target.value }))} placeholder="Ph.D, M.Tech" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Specialization</label>
                                    <input className={inputCls} value={createForm.specialization} onChange={e => setCreateForm(f => ({ ...f, specialization: e.target.value }))} placeholder="Machine Learning" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">A temporary password is generated automatically and shown once.</p>
                                <button type="submit" disabled={creating} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-colors">
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Instructor
                                </button>
                            </form>
                        ) : (
                            <div className="p-6 text-center space-y-4">
                                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center"><Check size={26} className="text-emerald-600" /></div>
                                <p className="text-sm font-bold text-foreground">{createResult.user.name} created</p>
                                <div className="bg-muted/40 rounded-xl p-4 text-sm">
                                    <p className="font-bold text-foreground mb-1">Login: {createResult.user.email}</p>
                                    <p className="font-bold text-foreground">Temporary password: <span className="text-indigo-600 font-black">{createResult.tempPassword}</span></p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl font-bold text-sm text-foreground transition-colors">Done</button>
                                    <button onClick={() => { setCreateResult(null); setCreateForm(emptyForm()); }} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Add Another</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Edit modal ────────────────────────────────────────────────── */}
            {editing && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2"><Pencil size={18} className="text-indigo-600" /> Edit Instructor</h3>
                            <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Full Name *</label>
                                    <input className={inputCls} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className={labelCls}>Email *</label>
                                    <input type="email" className={inputCls} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input className={inputCls} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Designation</label>
                                    <input className={inputCls} value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} />
                                </div>
                                <div>
                                    <label className={labelCls}>Qualification</label>
                                    <input className={inputCls} value={editForm.qualification} onChange={e => setEditForm(f => ({ ...f, qualification: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Specialization</label>
                                <input className={inputCls} value={editForm.specialization} onChange={e => setEditForm(f => ({ ...f, specialization: e.target.value }))} />
                            </div>
                            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-colors">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Assign Courses modal (drag & drop) ────────────────────────── */}
            {assigning && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-4xl my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <BookOpen size={18} className="text-cyan-600" /> Assign Courses — {assigning.name}
                            </h3>
                            <button onClick={() => setAssigning(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">
                                Drag courses between <b className="text-foreground">Available Courses</b> and <b className="text-foreground">Assigned Courses</b>, or select + use the arrows. Only your department's courses are shown.
                            </p>
                            <DragTransfer
                                leftTitle="Available Courses"
                                leftHint={`${availableCourses.length} unassigned to this instructor`}
                                leftItems={availableCourses}
                                rightTitle="Assigned Courses"
                                rightHint={`${assignedCourses.length} taught by ${assigning.name}`}
                                rightItems={assignedCourses}
                                renderItem={renderCourse}
                                itemKey="id"
                                onTransfer={handleCourseTransfer}
                                busy={assignBusy}
                                emptyText="No courses here"
                            />
                            {assignBusy && <p className="text-xs font-bold text-cyan-600 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Saving…</p>}
                            <div className="flex justify-end">
                                <button onClick={() => setAssigning(null)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Done</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset result ──────────────────────────────────────────────── */}
            {resetResult && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center"><RotateCcw size={24} className="text-amber-600" /></div>
                        <p className="text-sm font-bold text-foreground">Password reset for {resetResult.name}</p>
                        <div className="bg-muted/40 rounded-xl p-4 text-sm">
                            <p className="font-bold text-foreground">Temporary password: <span className="text-amber-600 font-black">{resetResult.tempPassword}</span></p>
                        </div>
                        <button onClick={() => setResetResult(null)} className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Done</button>
                    </div>
                </div>
            )}

            {/* ── Delete confirm ────────────────────────────────────────────── */}
            {deleting && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 flex items-center justify-center"><Trash2 size={24} className="text-rose-600" /></div>
                        <p className="font-bold text-foreground">Delete {deleting.name}?</p>
                        <p className="text-sm font-medium text-muted-foreground">This permanently deletes the instructor account. Their courses are preserved but become unassigned.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleting(null)} className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl font-bold text-sm text-foreground transition-colors">Cancel</button>
                            <button onClick={handleDelete} disabled={deleteBusy} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors">
                                {deleteBusy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
