import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Printer, CheckCircle, XCircle, Award, ClipboardList,
    Layers, Gauge, Eye, Trophy
} from 'lucide-react';
import { quizzesAPI } from '../../../services/api';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';

const DIFF_STYLES = {
    EASY: 'bg-emerald-50 text-emerald-600',
    HARD: 'bg-rose-50 text-rose-600',
    MEDIUM: 'bg-amber-50 text-amber-600',
};

const formatDuration = (secs) => {
    if (!secs && secs !== 0) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
};

const formatAnswer = (answer) => {
    if (answer === null || answer === undefined) return '—';
    if (Array.isArray(answer)) return answer.length ? answer.join(', ') : '—';
    return String(answer);
};

const isAnswered = (q) => {
    if (q.givenAnswer === null || q.givenAnswer === undefined) return false;
    if (Array.isArray(q.givenAnswer)) return q.givenAnswer.length > 0;
    return String(q.givenAnswer).trim() !== '';
};

export default function AssessmentReportPage() {
    const { quizId, studentId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attemptIdx, setAttemptIdx] = useState(0);

    useEffect(() => {
        quizzesAPI.getStudentAttempts(quizId, studentId)
            .then(res => { setData(res); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, [quizId, studentId]);

    const attempts = data?.attempts || [];
    const attempt = attempts[Math.min(attemptIdx, Math.max(attempts.length - 1, 0))];
    const correctCount = attempt?.questions?.filter(q => q.correct).length || 0;
    const student = data?.student;
    const quiz = data?.quiz;

    return (
        <div className="report-page max-w-4xl mx-auto">
            {/* Print CSS: hide dashboard chrome when printing.
                NOTE: React mounts into #root, so the Navbar <nav> and Sidebar
                <aside> live inside body > div#root > div. Match them at any
                depth with `body nav, body aside` — the report page itself has
                no <nav>/<aside>, so this is safe. */}
            <style>{`
                @media print {
                    body nav, body aside { display: none !important; }
                    .report-page { max-width: 100% !important; margin: 0 !important; }
                    .report-page .no-print { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; }
                    .report-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; break-inside: avoid; }
                    .report-question { break-inside: avoid; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>

            {/* ── Toolbar (hidden on print) ─────────────────────────────── */}
            <div className="no-print flex items-center justify-between gap-3 mb-5 flex-wrap">
                <Link
                    to="/instructor/assessments"
                    className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Assessments
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                    <Printer size={16} /> Print Report
                </button>
            </div>

            {loading ? (
                <LoadingContainer height="h-64" />
            ) : error ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-sm text-rose-700 font-medium">
                    Failed to load report: {error}
                </div>
            ) : !data || !attempt ? (
                <EmptyState icon={Eye} message="No attempt data found for this student." />
            ) : (
                <div className="space-y-5">
                    {/* ── Report masthead ─────────────────────────────────── */}
                    <div className="report-card bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden print:text-black">
                        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl print:hidden" />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="bg-white/20 backdrop-blur px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                                    <Trophy size={12} /> Answer Review Report
                                </span>
                                <span className="text-white/80 text-xs font-medium">{new Date(attempt.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">{quiz?.title}</h1>
                            <p className="text-indigo-100 text-sm font-medium mb-5">
                                {attempt.questions?.length || 0} questions · {formatDuration(attempt.timeTaken)} · Pass mark {quiz?.passingScore}%
                            </p>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 bg-white/15 backdrop-blur rounded-xl p-4">
                                    <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-lg font-black flex-shrink-0">
                                        {student?.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-[15px] truncate">{student?.name}</p>
                                        <p className="text-indigo-100 text-xs font-medium">{student?.rollNo ? `Roll: ${student.rollNo}` : student?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 bg-white/15 backdrop-blur rounded-xl p-4">
                                    <div>
                                        <p className="text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Score</p>
                                        <p className="text-3xl font-black">{attempt.score}%</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${attempt.passed ? 'bg-emerald-400/90 text-emerald-950' : 'bg-rose-400/90 text-rose-950'}`}>
                                            {attempt.passed ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                            {attempt.passed ? 'PASSED' : 'FAILED'}
                                        </span>
                                        <p className="text-[11px] font-bold text-indigo-100 uppercase tracking-wider mt-2">
                                            {correctCount}/{attempt.questions?.length || 0} correct
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {attempts.length > 1 && (
                                <div className="mt-4 flex items-center gap-1.5 flex-wrap print:hidden">
                                    <span className="text-xs font-bold text-indigo-100 mr-1">Attempts:</span>
                                    {attempts.map((a, i) => (
                                        <button
                                            key={a.attemptId}
                                            onClick={() => setAttemptIdx(i)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                i === Math.min(attemptIdx, attempts.length - 1)
                                                    ? 'bg-white text-indigo-700 border-white'
                                                    : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                                            }`}
                                            title={`Attempt ${i + 1} — ${a.score}%`}
                                        >
                                            #{i + 1} · {a.score}%
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Quick stats ─────────────────────────────────────── */}
                    <div className="report-card grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                            <p className="text-xl font-black text-emerald-700">{attempt.score}%</p>
                            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Score</p>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                            <p className="text-xl font-black text-indigo-700">{correctCount}/{attempt.questions?.length || 0}</p>
                            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Correct</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                            <p className="text-xl font-black text-amber-700">{attempt.violations || 0}</p>
                            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Violations</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                            <p className="text-xl font-black text-slate-700">{formatDuration(attempt.timeTaken)}</p>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Time</p>
                        </div>
                    </div>

                    {/* ── Per-question breakdown ──────────────────────────── */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <ClipboardList size={20} className="text-indigo-500" /> Question-by-Question Breakdown
                        </h2>
                        {attempt.questions.map((q, i) => (
                            <div
                                key={q.questionId}
                                className={`report-question border rounded-xl overflow-hidden ${q.correct ? 'border-emerald-200' : 'border-rose-200'}`}
                            >
                                <div className={`px-4 py-2.5 flex items-center gap-3 ${q.correct ? 'bg-emerald-100/60' : 'bg-rose-100/60'}`}>
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${q.correct ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                        {q.correct ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    </span>
                                    <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Q{i + 1}</span>
                                    {q.category && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">
                                            <Layers size={10} /> {q.category}
                                        </span>
                                    )}
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${DIFF_STYLES[q.difficulty] || DIFF_STYLES.MEDIUM}`}>
                                        <Gauge size={10} /> {q.difficulty}
                                    </span>
                                    <span className="ml-auto text-xs font-black print:ml-0">{q.correct ? 'Correct' : 'Incorrect'}</span>
                                </div>

                                <div className="px-4 py-4 space-y-3 bg-card">
                                    <p className="text-sm font-bold text-foreground leading-snug">{q.text}</p>

                                    {q.options?.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {q.options.map((opt, oi) => {
                                                const isCorrect = q.correctAnswer === opt
                                                    || (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt));
                                                const isGiven = String(q.givenAnswer) === String(opt)
                                                    || (Array.isArray(q.givenAnswer) && q.givenAnswer.includes(opt));
                                                return (
                                                    <span
                                                        key={oi}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                            isCorrect && isGiven ? 'bg-emerald-500 text-white border-emerald-600' :
                                                            isCorrect ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                                            isGiven ? 'bg-rose-100 text-rose-800 border-rose-300 line-through' :
                                                            'bg-muted/40 text-muted-foreground border-border'
                                                        }`}
                                                    >
                                                        {opt}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-x-8 gap-y-1.5 text-xs font-medium">
                                        <span className="text-muted-foreground">
                                            <span className="font-bold text-foreground">Student answer:</span>{' '}
                                            {isAnswered(q) ? formatAnswer(q.givenAnswer) : <span className="text-amber-600 font-bold">Not answered</span>}
                                        </span>
                                        <span className="text-muted-foreground">
                                            <span className="font-bold text-emerald-700">Correct answer:</span> {formatAnswer(q.correctAnswer)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Footer ──────────────────────────────────────────── */}
                    <div className="pt-4 pb-10 text-center">
                        <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                            <Award size={12} /> Generated by EduNexus LMS · {new Date().toLocaleString('en-IN')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
