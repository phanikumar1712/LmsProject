import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Download, Upload, CheckCircle2, Clock, Loader2, ChevronDown,
    Paperclip, Award, MessageSquare, ArrowLeft, ExternalLink
} from 'lucide-react';
import { assignmentsAPI, uploadAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer, EmptyState, Badge } from '../../../components/ui/Feedback';
import toast from 'react-hot-toast';

const STATUS_META = {
    NOT_STARTED: { label: 'Not Started', variant: 'neutral' },
    OVERDUE: { label: 'Overdue', variant: 'danger' },
    SUBMITTED: { label: 'Submitted', variant: 'info' },
    LATE: { label: 'Late', variant: 'warning' },
    RESUBMISSION_REQUIRED: { label: 'Resubmission Required', variant: 'warning' },
    GRADED: { label: 'Graded', variant: 'success' },
};

export default function StudentAssignments() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    // Per-assignment draft state for the upload form
    const [drafts, setDrafts] = useState({}); // { [assignmentId]: { file, comments, submitting } }

    const load = async () => {
        setLoading(true);
        try {
            const data = await assignmentsAPI.getMy();
            setAssignments(data || []);
        } catch (err) {
            toast.error(err.message || 'Failed to load assignments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.id]);

    const setDraft = (id, patch) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const submitAssignment = async (id) => {
        const draft = drafts[id] || {};
        if (draft.submitting) return;
        const assignment = assignments.find(a => a.id === id);
        if (!assignment) return;

        setDraft(id, { submitting: true });
        try {
            let fileUrl = '';
            if (draft.file) {
                const up = await uploadAPI.uploadMedia(draft.file);
                fileUrl = up?.url || '';
            }
            await assignmentsAPI.submit(id, { fileUrl, comments: draft.comments || '' });
            toast.success(draft.file ? 'Assignment submitted! 🎉' : 'Assignment submitted!');
            // Refresh so status + submission reflect the new state
            await load();
        } catch (err) {
            toast.error(err.message || 'Failed to submit');
        } finally {
            setDraft(id, { submitting: false, file: null, comments: '' });
        }
    };

    const grouped = useMemo(() => {
        const todo = [];
        const pending = [];
        const graded = [];
        (assignments || []).forEach(a => {
            if (a.status === 'GRADED') graded.push(a);
            else if (a.status === 'NOT_STARTED' || a.status === 'OVERDUE') todo.push(a);
            else pending.push(a);
        });
        return { todo, pending, graded };
    }, [assignments]);

    const canResubmit = (a) => a.allowResubmit || a.status === 'RESUBMISSION_REQUIRED';

    if (loading) return <LoadingContainer height="h-64" />;

    if (assignments.length === 0) {
        return (
            <EmptyState
                icon={FileText}
                message="No assignments yet. Assignments from your enrolled courses will appear here."
                action={
                    <button onClick={() => navigate('/courses')} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">
                        Explore Courses
                    </button>
                }
            />
        );
    }

    const renderAssignment = (a) => {
        const meta = STATUS_META[a.status] || STATUS_META.NOT_STARTED;
        const expanded = expandedId === a.id;
        const draft = drafts[a.id] || {};
        const sub = a.submission;
        const showSubmitForm = !sub || (sub.status === 'RESUBMISSION_REQUIRED') || (sub.status === 'GRADED' && canResubmit(a)) || (sub.status === 'SUBMITTED' && canResubmit(a)) || (sub.status === 'LATE' && canResubmit(a));

        return (
            <div key={a.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {/* Card header */}
                <button
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                    className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
                >
                    <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 flex items-center justify-center flex-shrink-0">
                        <FileText size={20} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-foreground font-bold text-sm sm:text-base truncate">{a.title}</p>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                            {a.courseTitle} · Due {new Date(a.dueDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {a.status === 'GRADED' && sub && (
                            <span className={`text-sm font-black ${sub.marks >= (a.maxMarks * 0.5) ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {sub.marks}/{a.maxMarks}
                            </span>
                        )}
                        <ChevronDown size={18} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {/* Expanded body */}
                {expanded && (
                    <div className="border-t border-border p-4 sm:p-5 space-y-4">
                        {/* Description */}
                        {a.description && (
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Assignment</p>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{a.description}</p>
                            </div>
                        )}

                        {/* Download resources */}
                        {a.resourceUrl && (
                            <a
                                href={a.resourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 transition-colors"
                            >
                                <Download size={15} /> Download Resources
                            </a>
                        )}

                        {/* Submission status */}
                        {sub && (
                            <div className="rounded-xl bg-muted/40 border border-border p-3.5 space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Your Submission</p>
                                {sub.fileUrl && (
                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700">
                                        <Paperclip size={14} /> View submitted file <ExternalLink size={12} />
                                    </a>
                                )}
                                {sub.comments && <p className="text-sm text-muted-foreground">{sub.comments}</p>}
                                {sub.status === 'RESUBMISSION_REQUIRED' && sub.feedback && (
                                    <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-2.5">
                                        <MessageSquare size={15} className="mt-0.5 flex-shrink-0" />
                                        <span><span className="font-bold">Instructor asked for revision: </span>{sub.feedback}</span>
                                    </div>
                                )}
                                {sub.status === 'GRADED' && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Award size={16} className={sub.marks >= (a.maxMarks * 0.5) ? 'text-emerald-600' : 'text-rose-500'} />
                                        <span className="font-black text-foreground">{sub.marks}/{a.maxMarks} marks</span>
                                        {sub.feedback && (
                                            <span className="text-muted-foreground ml-1">· Feedback: {sub.feedback}</span>
                                        )}
                                    </div>
                                )}
                                {sub.status === 'SUBMITTED' && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Clock size={13} /> Awaiting grading · Submitted {new Date(sub.submittedAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Submit / resubmit form */}
                        {showSubmitForm ? (
                            <div className="rounded-xl bg-muted/30 border border-dashed border-border p-4 space-y-3">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    {sub ? (sub.status === 'RESUBMISSION_REQUIRED' ? 'Resubmit your work' : 'Resubmit (instructor allows it)') : 'Upload your answer'}
                                    {a.fileRequired && <span className="text-rose-500"> · file required</span>}
                                </p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={e => setDraft(a.id, { file: e.target.files?.[0] || null })}
                                    />
                                    <span className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 hover:bg-indigo-100 transition-colors">
                                        <Upload size={15} /> {draft.file ? draft.file.name : 'Choose file'}
                                    </span>
                                </label>
                                <textarea
                                    value={draft.comments || ''}
                                    onChange={e => setDraft(a.id, { comments: e.target.value })}
                                    placeholder="Add a comment for your instructor (optional)"
                                    rows={2}
                                    className="w-full bg-card border border-border rounded-xl p-3 text-sm outline-none focus:border-indigo-500 resize-none"
                                />
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => submitAssignment(a.id)}
                                        disabled={draft.submitting || (a.fileRequired && !draft.file)}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
                                    >
                                        {draft.submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting...</> : <><CheckCircle2 size={15} /> {sub ? 'Submit Revision' : 'Submit'}</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground font-medium">Submitted · resubmission not allowed for this assignment.</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Assignments"
                subtitle="View, submit, and track your assignment grades"
                action={
                    <button
                        onClick={() => navigate('/courses')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-indigo-600 hover:bg-muted transition-colors"
                    >
                        <ArrowLeft size={15} /> Back to Courses
                    </button>
                }
            />

            {grouped.todo.length > 0 && (
                <div>
                    <h3 className="text-sm font-black text-foreground mb-3">To Do ({grouped.todo.length})</h3>
                    <div className="space-y-3">{grouped.todo.map(renderAssignment)}</div>
                </div>
            )}

            {grouped.pending.length > 0 && (
                <div>
                    <h3 className="text-sm font-black text-foreground mb-3">Submitted ({grouped.pending.length})</h3>
                    <div className="space-y-3">{grouped.pending.map(renderAssignment)}</div>
                </div>
            )}

            {grouped.graded.length > 0 && (
                <div>
                    <h3 className="text-sm font-black text-foreground mb-3">Graded ({grouped.graded.length})</h3>
                    <div className="space-y-3">{grouped.graded.map(renderAssignment)}</div>
                </div>
            )}
        </div>
    );
}
