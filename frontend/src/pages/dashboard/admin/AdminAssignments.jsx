import { useState, useEffect } from 'react';
import { FileText, BookOpen, Plus, X, Save, Trash2, Eye, CheckCircle, Users, Clock, ListChecks, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { coursesAPI, assignmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardHeader } from '../../../components/ui/Card';
import { UserCell } from '../../../components/ui/DataTable';
import RubricGradingPanel, { RubricScoringPanel } from '../../../components/ui/RubricGradingPanel';
import toast from 'react-hot-toast';

export default function AdminAssignments() {
    const [selectedCourse, setSelectedCourse] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ courseId: '', title: '', description: '', maxMarks: 100, dueDate: '', allowLate: false, allowResubmit: false });
    const [creating, setCreating] = useState(false);
    const [viewingSubmissions, setViewingSubmissions] = useState(null);
    const [grading, setGrading] = useState({});
    const [savingGrade, setSavingGrade] = useState(false);
    const [showRubric, setShowRubric] = useState(false);
    const [rubricCriteria, setRubricCriteria] = useState([]);

    // Load rubric criteria when rubric panel opens
    useEffect(() => {
        if (showRubric && viewingSubmissions) {
            assignmentsAPI.getRubric(viewingSubmissions).then(data => {
                if (data && data.length > 0) {
                    setRubricCriteria(data.map(c => ({
                        id: c.id,
                        name: c.criterion_name,
                        maxScore: c.max_score,
                    })));
                }
            }).catch(() => {});
        }
    }, [showRubric, viewingSubmissions]);

    const { data: courses } = useAsyncData(() => coursesAPI.getAll({ admin: true, limit: 200 }), []);
    const { data: assignments, loading, reload } = useAsyncData(
        () => selectedCourse ? assignmentsAPI.getByCourse(selectedCourse) : Promise.resolve([]),
        [selectedCourse]
    );
    const { data: submissions, loading: subsLoading, reload: reloadSubs } = useAsyncData(
        () => viewingSubmissions ? assignmentsAPI.getSubmissions(viewingSubmissions) : Promise.resolve([]),
        [viewingSubmissions]
    );

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.title || !createForm.dueDate) { toast.error('Title and due date are required'); return; }
        setCreating(true);
        try {
            await assignmentsAPI.create({ ...createForm, courseId: selectedCourse });
            toast.success('Assignment created!');
            setShowCreate(false);
            setCreateForm({ courseId: '', title: '', description: '', maxMarks: 100, dueDate: '', allowLate: false, allowResubmit: false });
            reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this assignment? Submissions will also be removed.')) return;
        try {
            await assignmentsAPI.remove(id);
            toast.success('Assignment deleted');
            reload();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleGrade = async (submissionId) => {
        const grade = grading[submissionId];
        if (grade === undefined || grade === '') { toast.error('Enter marks'); return; }
        setSavingGrade(true);
        try {
            await assignmentsAPI.grade(submissionId, { marks: Number(grade), feedback: grading[`feedback_${submissionId}`] || '' });
            toast.success('Grade saved!');
            reloadSubs();
            setGrading({});
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingGrade(false);
        }
    };

    // Send a submission back for revision — clears the grade and flags it
    // RESUBMISSION_REQUIRED until the student resubmits.
    const handleRequestResubmission = async (submissionId) => {
        if (!window.confirm('Send this submission back for revision? The current grade (if any) will be cleared.')) return;
        setSavingGrade(true);
        try {
            await assignmentsAPI.grade(submissionId, { requestResubmission: true, feedback: grading[`feedback_${submissionId}`] || '' });
            toast.success('Sent back for revision — student notified');
            reloadSubs();
            setGrading({});
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingGrade(false);
        }
    };

    const STATUS_STYLES = {
        GRADED: 'bg-emerald-50 text-emerald-600',
        LATE: 'bg-rose-50 text-rose-600',
        SUBMITTED: 'bg-blue-50 text-blue-600',
        RESUBMISSION_REQUIRED: 'bg-amber-50 text-amber-700',
    };
    const STATUS_LABELS = {
        GRADED: 'Graded',
        LATE: 'Late',
        SUBMITTED: 'Submitted',
        RESUBMISSION_REQUIRED: 'Resubmission Required',
    };

    const isOverdue = (dueDate) => new Date(dueDate) < new Date();

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <PageHeader
                title="Assignments & Grades"
                subtitle="Create, view, and grade course assignments."
                action={
                    selectedCourse && (
                        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                            <Plus size={16} /> New Assignment
                        </button>
                    )
                }
            />

            {/* Course Selector */}
            <Card>
                <CardHeader title="Select Course" icon={<BookOpen size={18} className="text-indigo-500" />} />
                <div className="p-6">
                    <select
                        value={selectedCourse}
                        onChange={e => setSelectedCourse(e.target.value)}
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm"
                    >
                        <option value="">Choose a course...</option>
                        {(courses || []).map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>
            </Card>

            {selectedCourse && (
                <Card>
                    <CardHeader
                        title="Assignments"
                        icon={<FileText size={18} className="text-indigo-500" />}
                        right={
                            <div className="text-xs text-muted-foreground font-medium">
                                {(assignments || []).length} assignment{(assignments || []).length !== 1 ? 's' : ''}
                            </div>
                        }
                    />
                    {loading ? (
                        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" /></div>
                    ) : (assignments || []).length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground font-medium">
                            No assignments yet for this course.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/60 border-y border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 sm:px-6 py-4">Title</th>
                                        <th className="px-3 sm:px-6 py-4">Due Date</th>
                                        <th className="hidden md:table-cell px-3 sm:px-6 py-4">Max Marks</th>
                                        <th className="px-3 sm:px-6 py-4">Submissions</th>
                                        <th className="hidden md:table-cell px-3 sm:px-6 py-4">Avg Score</th>
                                        <th className="px-3 sm:px-6 py-4">Status</th>
                                        <th className="px-3 sm:px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(assignments || []).map(a => (
                                        <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                                            <td className="px-3 sm:px-6 py-4">
                                                <p className="font-bold text-foreground text-sm truncate max-w-[200px]">{a.title}</p>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={14} className={isOverdue(a.due_date) ? 'text-rose-500' : 'text-muted-foreground'} />
                                                    <span className={`text-xs font-medium ${isOverdue(a.due_date) ? 'text-rose-600' : 'text-muted-foreground'}`}>
                                                        {new Date(a.due_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="hidden md:table-cell px-3 sm:px-6 py-4 font-bold">{a.max_marks}</td>
                                            <td className="px-3 sm:px-6 py-4 font-bold">{a.submission_count || 0}</td>
                                            <td className="hidden md:table-cell px-3 sm:px-6 py-4">
                                                <span className={`text-xs font-bold ${(a.avg_marks || 0) >= 70 ? 'text-emerald-600' : (a.avg_marks || 0) >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                    {a.avg_marks ? `${a.avg_marks}%` : '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`w-max text-[10px] font-bold px-2.5 py-1 rounded-full ${a.allow_late ? 'bg-amber-50 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                                                        {a.allow_late ? 'Late OK' : 'Strict'}
                                                    </span>
                                                    {a.allow_resubmit && (
                                                        <span className="w-max text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600">
                                                            Resubmit OK
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => setViewingSubmissions(viewingSubmissions === a.id ? null : a.id)}
                                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <Eye size={13} /> View
                                                    </button>
                                                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Submissions Panel */}
            {viewingSubmissions && (
                <Card>
                    <CardHeader
                        title="Submissions"
                        icon={<Users size={18} className="text-indigo-500" />}
                        right={
                            <button onClick={() => setViewingSubmissions(null)} className="text-xs text-muted-foreground hover:text-foreground font-medium">Close</button>
                        }
                    />
                    {subsLoading ? (
                        <div className="p-12 text-center"><div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" /></div>
                    ) : (submissions || []).length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground font-medium">No submissions yet.</div>
                    ) : (
                        <div>
                            {/* Rubric toggle */}
                            <div className="px-6 py-3 border-b border-border bg-muted/20">
                                <button
                                    onClick={() => setShowRubric(!showRubric)}
                                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    <ListChecks size={15} />
                                    {showRubric ? 'Hide' : 'Show'} Rubric Scoring
                                    {showRubric ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                            </div>

                            {showRubric && (
                                <div className="px-6 py-4 border-b border-border bg-indigo-50/30">
                                    <RubricGradingPanel assignmentId={viewingSubmissions} />
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/60 border-y border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Student</th>
                                            <th className="px-6 py-4">Submitted</th>
                                            <th className="px-6 py-4">Marks</th>
                                            <th className="px-6 py-4">Feedback</th>
                                            <th className="px-6 py-4">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(submissions || []).map(s => (
                                            <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                                                <td className="px-6 py-4">
                                                    <UserCell name={s.student_name} email={s.student_email} avatar={s.student_avatar} />
                                                </td>
                                                <td className="px-6 py-4 text-xs text-muted-foreground">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} />
                                                            {new Date(s.submitted_at).toLocaleDateString()}
                                                        </span>
                                                        {s.file_url && (
                                                            <a href={s.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold flex items-center gap-1 text-[11px]">
                                                                <Download size={12} /> Download
                                                            </a>
                                                        )}
                                                        <span className={`w-max text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status] || 'bg-muted text-muted-foreground'}`}>
                                                            {STATUS_LABELS[s.status] || s.status || 'Submitted'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold">{s.marks !== null ? s.marks : '—'}</td>
                                                <td className="px-6 py-4 text-xs text-muted-foreground max-w-[200px] truncate">{s.feedback || '—'}</td>
                                                <td className="px-6 py-4">
                                                    {s.marks !== null && s.status !== 'RESUBMISSION_REQUIRED' ? (
                                                        <div className="flex flex-col items-start gap-1.5">
                                                            <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                                                                <CheckCircle size={12} /> Graded
                                                            </span>
                                                            <button
                                                                onClick={() => handleRequestResubmission(s.id)}
                                                                disabled={savingGrade}
                                                                className="text-[10px] font-bold text-amber-600 hover:text-amber-700 underline"
                                                            >
                                                                Send back for revision
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    placeholder="Marks"
                                                                    value={grading[s.id] ?? ''}
                                                                    onChange={e => setGrading(p => ({ ...p, [s.id]: e.target.value }))}
                                                                    className="w-16 px-2 py-1 bg-muted/40 border border-border rounded-lg text-xs font-medium outline-none"
                                                                />
                                                                <button
                                                                    onClick={() => handleGrade(s.id)}
                                                                    disabled={savingGrade}
                                                                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                                                                >
                                                                    {savingGrade ? '...' : 'Grade'}
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => handleRequestResubmission(s.id)}
                                                                disabled={savingGrade}
                                                                className="w-max text-[10px] font-bold text-amber-600 hover:text-amber-700 underline"
                                                            >
                                                                Send back for revision
                                                            </button>
                                                            {showRubric && rubricCriteria.length > 0 && (
                                                                <RubricScoringPanel
                                                                    submissionId={s.id}
                                                                    criteria={rubricCriteria}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <FileText size={20} className="text-indigo-600" /> New Assignment
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</label>
                                <input required type="text" value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" placeholder="e.g. Week 1 Assignment" />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</label>
                                <textarea rows={3} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Max Marks</label>
                                    <input type="number" min="1" value={createForm.maxMarks} onChange={e => setCreateForm(p => ({ ...p, maxMarks: Number(e.target.value) }))} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Due Date *</label>
                                    <input required type="datetime-local" value={createForm.dueDate} onChange={e => setCreateForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={createForm.allowLate} onChange={e => setCreateForm(p => ({ ...p, allowLate: e.target.checked }))} className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-foreground">Allow late submissions</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={createForm.allowResubmit} onChange={e => setCreateForm(p => ({ ...p, allowResubmit: e.target.checked }))} className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-foreground">Allow resubmission</span>
                                </label>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                    {creating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</> : <><Save size={15} /> Create</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
