import { useState, useEffect } from 'react';
import {
    FileText, BookOpen, Plus, X, Save, Trash2, Eye, CheckCircle, Users, Clock,
    ListChecks, ChevronDown, ChevronUp, Download, ShieldAlert, ArrowRight,
    Calendar, Star, AlertTriangle, MessageSquare, Upload, Send, BarChart3,
    FileCheck, FileQuestion, Trophy, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { coursesAPI, assignmentsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/ui/PageHeader';
import { UserCell } from '../../../components/ui/DataTable';
import RubricGradingPanel, { RubricScoringPanel } from '../../../components/ui/RubricGradingPanel';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    GRADED: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle },
    LATE: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', icon: AlertTriangle },
    SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: Send },
    RESUBMISSION_REQUIRED: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: MessageSquare },
};

function AssignmentCard({ assignment, onView, onDelete, isOverdue }) {
    const a = assignment;
    const subCount = a.submission_count || 0;
    const avgMarks = a.avg_marks || 0;
    const submittedCount = a.submitted_count || subCount;

    return (
        <div className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md ${isOverdue ? 'border-rose-200' : 'border-border'}`}>
            {/* Top accent bar */}
            <div className={`h-1.5 ${isOverdue ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-500'}`} />

            <div className="p-5">
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                            <FileText size={20} className={isOverdue ? 'text-rose-600' : 'text-indigo-600'} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-extrabold text-foreground text-sm truncate">{a.title}</h3>
                            {a.description && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.description}</p>
                            )}
                        </div>
                    </div>
                    {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-tighter flex-shrink-0">
                            <AlertTriangle size={10} /> Overdue
                        </span>
                    )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center p-2 bg-muted/40 rounded-xl">
                        <p className="text-lg font-black text-foreground">{a.max_marks}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Max Marks</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-xl">
                        <p className="text-lg font-black text-blue-600">{subCount}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-blue-600/60">Submissions</p>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded-xl">
                        <p className="text-lg font-black text-emerald-600">{avgMarks ? `${avgMarks}%` : '—'}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/60">Avg Score</p>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded-xl">
                        <p className="text-lg font-black text-amber-600">{a.graded_count || 0}</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600/60">Graded</p>
                    </div>
                </div>

                {/* Due date + tags */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isOverdue ? 'text-rose-600' : 'text-muted-foreground'}`}>
                            <Calendar size={13} /> Due {new Date(a.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {a.allow_late && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-tighter">
                                Late OK
                            </span>
                        )}
                        {a.allow_resubmit && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-700 text-[10px] font-black uppercase tracking-tighter">
                                Resubmit OK
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => onView(a.id)}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                        >
                            <Eye size={13} /> View Submissions
                        </button>
                        <button
                            onClick={() => onDelete(a.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SubmissionsPanel({ assignmentId, onClose, showRubric, setShowRubric, rubricCriteria }) {
    const { data: submissions, loading, reload } = useAsyncData(
        () => assignmentId ? assignmentsAPI.getSubmissions(assignmentId) : Promise.resolve([]),
        [assignmentId]
    );
    const [grading, setGrading] = useState({});
    const [savingGrade, setSavingGrade] = useState(false);

    const handleGrade = async (submissionId) => {
        const grade = grading[submissionId];
        if (grade === undefined || grade === '') { toast.error('Enter marks'); return; }
        setSavingGrade(true);
        try {
            await assignmentsAPI.grade(submissionId, { marks: Number(grade), feedback: grading[`feedback_${submissionId}`] || '' });
            toast.success('Grade saved!');
            reload();
            setGrading({});
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingGrade(false);
        }
    };

    const handleRequestResubmission = async (submissionId) => {
        if (!window.confirm('Send this submission back for revision?')) return;
        setSavingGrade(true);
        try {
            await assignmentsAPI.grade(submissionId, { requestResubmission: true, feedback: grading[`feedback_${submissionId}`] || '' });
            toast.success('Sent back for revision');
            reload();
            setGrading({});
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingGrade(false);
        }
    };

    const totalSubs = (submissions || []).length;
    const gradedSubs = (submissions || []).filter(s => s.status === 'GRADED').length;
    const pendingSubs = totalSubs - gradedSubs;

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-violet-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <Users size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-foreground">Student Submissions</h3>
                            <p className="text-[11px] text-muted-foreground font-medium">
                                {totalSubs} total · {gradedSubs} graded · {pendingSubs} pending
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        Close
                    </button>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 p-4 border-b border-border">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <p className="text-2xl font-black text-blue-600">{totalSubs}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/60">Total Submitted</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                    <p className="text-2xl font-black text-emerald-600">{gradedSubs}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/60">Graded</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                    <p className="text-2xl font-black text-amber-600">{pendingSubs}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/60">Pending Review</p>
                </div>
            </div>

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
                    <RubricGradingPanel assignmentId={assignmentId} />
                </div>
            )}

            {/* Submissions list */}
            {loading ? (
                <div className="p-12 text-center">
                    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                </div>
            ) : totalSubs === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <FileQuestion size={24} className="opacity-40" />
                    </div>
                    <p className="font-medium text-sm">No submissions yet</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Students haven't submitted this assignment yet</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {(submissions || []).map(s => {
                        const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.SUBMITTED;
                        const StatusIcon = statusStyle.icon;
                        return (
                            <div key={s.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Student info */}
                                    <div className="flex-1 min-w-0">
                                        <UserCell name={s.student_name} email={s.student_email} avatar={s.student_avatar} />
                                    </div>

                                    {/* Submission details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                                                <StatusIcon size={10} /> {STATUS_STYLES[s.status] ? s.status.replace('_', ' ') : 'Submitted'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(s.submitted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        {s.file_url && (
                                            <a href={s.file_url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 mb-1">
                                                <Download size={12} /> Download submission
                                            </a>
                                        )}
                                        {s.comments && (
                                            <p className="text-xs text-muted-foreground mt-1 bg-muted/40 rounded-lg px-3 py-1.5">
                                                "{s.comments}"
                                            </p>
                                        )}
                                    </div>

                                    {/* Grading */}
                                    <div className="flex-shrink-0 w-48">
                                        {s.marks !== null && s.status !== 'RESUBMISSION_REQUIRED' ? (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={14} className="text-emerald-600" />
                                                    <span className="text-sm font-black text-emerald-600">{s.marks} marks</span>
                                                </div>
                                                {s.feedback && (
                                                    <p className="text-[10px] text-muted-foreground truncate">{s.feedback}</p>
                                                )}
                                                <button
                                                    onClick={() => handleRequestResubmission(s.id)}
                                                    disabled={savingGrade}
                                                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 underline"
                                                >
                                                    Send back for revision
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        placeholder="Marks"
                                                        value={grading[s.id] ?? ''}
                                                        onChange={e => setGrading(p => ({ ...p, [s.id]: e.target.value }))}
                                                        className="w-16 px-2 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                    <button
                                                        onClick={() => handleGrade(s.id)}
                                                        disabled={savingGrade}
                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
                                                    >
                                                        {savingGrade ? '...' : <><CheckCircle size={10} /> Grade</>}
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Feedback (optional)"
                                                    value={grading[`feedback_${s.id}`] || ''}
                                                    onChange={e => setGrading(p => ({ ...p, [`feedback_${s.id}`]: e.target.value }))}
                                                    className="w-full px-2 py-1.5 bg-muted/40 border border-border rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                                <button
                                                    onClick={() => handleRequestResubmission(s.id)}
                                                    disabled={savingGrade}
                                                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 underline"
                                                >
                                                    Send back for revision
                                                </button>
                                                {showRubric && rubricCriteria.length > 0 && (
                                                    <RubricScoringPanel submissionId={s.id} criteria={rubricCriteria} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function AdminAssignments() {
    const { can } = useAuth();
    const hasAssignmentPerm = can('assignment.create', 'grade.update');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({
        courseId: '', title: '', description: '', maxMarks: 100, dueDate: '',
        allowLate: false, allowResubmit: false, fileRequired: true
    });
    const [creating, setCreating] = useState(false);
    const [viewingSubmissions, setViewingSubmissions] = useState(null);
    const [showRubric, setShowRubric] = useState(false);
    const [rubricCriteria, setRubricCriteria] = useState([]);

    useEffect(() => {
        if (showRubric && viewingSubmissions) {
            assignmentsAPI.getRubric(viewingSubmissions).then(data => {
                if (data && data.length > 0) {
                    setRubricCriteria(data.map(c => ({ id: c.id, name: c.criterion_name, maxScore: c.max_score })));
                }
            }).catch(() => {});
        }
    }, [showRubric, viewingSubmissions]);

    const { data: courses } = useAsyncData(() => coursesAPI.getAll({ admin: true, limit: 200 }), []);
    const { data: assignments, loading, reload } = useAsyncData(
        () => selectedCourse ? assignmentsAPI.getByCourse(selectedCourse) : Promise.resolve([]),
        [selectedCourse]
    );

    const selectedCourseName = (courses || []).find(c => c.id === selectedCourse)?.title || '';

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.title || !createForm.dueDate) { toast.error('Title and due date are required'); return; }
        setCreating(true);
        try {
            await assignmentsAPI.create({ ...createForm, courseId: selectedCourse });
            toast.success('Assignment created!');
            setShowCreate(false);
            setCreateForm({ courseId: '', title: '', description: '', maxMarks: 100, dueDate: '', allowLate: false, allowResubmit: false, fileRequired: true });
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

    const isOverdue = (dueDate) => new Date(dueDate) < new Date();

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <PageHeader
                title="Assignments & Grading"
                subtitle="Create assignments, review student submissions, and grade their work"
                action={
                    selectedCourse && hasAssignmentPerm && (
                        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                            <Plus size={16} /> New Assignment
                        </button>
                    )
                }
            />

            {/* How it works banner */}
            {!selectedCourse && (
                <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200 rounded-2xl p-6">
                    <h3 className="text-base font-extrabold text-foreground flex items-center gap-2 mb-4">
                        <FileCheck size={18} className="text-indigo-600" /> How Assignments Work
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <Plus size={16} className="text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">1. Create</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Create an assignment with title, description, max marks, and due date.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <Upload size={16} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">2. Students Submit</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Students upload their work (files, documents, code) before the deadline.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Trophy size={16} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">3. Grade & Feedback</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Review submissions, assign marks, and provide feedback to students.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Permission warning */}
            {!hasAssignmentPerm && (
                <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                    <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Assignment permissions not enabled</p>
                        <p className="text-sm text-amber-700/80 dark:text-amber-200/70 mt-1 leading-relaxed">
                            Your account doesn't have the <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-xs font-mono">assignment.create</code> or <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-xs font-mono">grade.update</code> permissions. Contact the Super Admin.
                        </p>
                    </div>
                </div>
            )}

            {/* Course Selector */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <BookOpen size={16} className="text-indigo-500" />
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Select Course</label>
                </div>
                <select
                    value={selectedCourse}
                    onChange={e => setSelectedCourse(e.target.value)}
                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                >
                    <option value="">Choose a course to manage assignments...</option>
                    {(courses || []).map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                </select>
            </div>

            {/* Assignments Grid */}
            {selectedCourse && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                            <FileText size={16} className="text-indigo-500" />
                            Assignments for {selectedCourseName}
                            <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {(assignments || []).length}
                            </span>
                        </h3>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                        </div>
                    ) : (assignments || []).length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
                            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                <FileText size={24} className="opacity-40" />
                            </div>
                            <p className="text-muted-foreground font-medium text-sm">No assignments yet for this course</p>
                            {hasAssignmentPerm && (
                                <button onClick={() => setShowCreate(true)} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                    + Create first assignment
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {(assignments || []).map(a => (
                                <AssignmentCard
                                    key={a.id}
                                    assignment={a}
                                    onView={setViewingSubmissions}
                                    onDelete={handleDelete}
                                    isOverdue={isOverdue(a.due_date)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Submissions Panel */}
            {viewingSubmissions && (
                <SubmissionsPanel
                    assignmentId={viewingSubmissions}
                    onClose={() => { setViewingSubmissions(null); setShowRubric(false); }}
                    showRubric={showRubric}
                    setShowRubric={setShowRubric}
                    rubricCriteria={rubricCriteria}
                />
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50">
                            <h3 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <FileText size={20} className="text-indigo-600" /> New Assignment
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 rounded-full transition-colors">
                                <X size={18} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</label>
                                <input required type="text" value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    placeholder="e.g. Week 1 Lab Exercise" />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Description / Instructions</label>
                                <textarea rows={3} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                                    placeholder="Describe what students need to submit (e.g. 'Write a report on...', 'Upload your code...')" />
                                <p className="text-[10px] text-muted-foreground/60 mt-1 ml-1">Tell students exactly what to submit — file type, format, length, etc.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Max Marks</label>
                                    <input type="number" min="1" value={createForm.maxMarks} onChange={e => setCreateForm(p => ({ ...p, maxMarks: Number(e.target.value) }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Due Date *</label>
                                    <input required type="datetime-local" value={createForm.dueDate} onChange={e => setCreateForm(p => ({ ...p, dueDate: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
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
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={createForm.fileRequired} onChange={e => setCreateForm(p => ({ ...p, fileRequired: e.target.checked }))} className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-foreground">Require file upload</span>
                                </label>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                    {creating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</> : <><Save size={15} /> Create Assignment</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
