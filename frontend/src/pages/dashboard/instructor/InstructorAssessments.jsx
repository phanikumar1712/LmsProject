import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ClipboardList, PlusCircle, Users, Target, Trophy, BarChart3, Clock,
    ChevronRight, ArrowLeft, CheckCircle, XCircle, Timer, FilePlus2, Sparkles, RotateCcw,
    Download, Eye, X, Award, Layers, Gauge, Bell, Send
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell
} from 'recharts';
import { useAuth } from '../../../contexts/AuthContext';
import { quizzesAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatCard, StatCardGrid, StatCardSkeleton } from '../../../components/ui/StatCard';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { CHART_COLORS } from '../../../lib/constants';
import InstructorQuizBuilder from './InstructorQuizBuilder';

const DIFF_COLORS = { EASY: '#10b981', MEDIUM: '#f59e0b', HARD: '#f43f5e' };

// Custom tooltip for the breakdown charts — shows correct/total + accuracy
const BreakdownTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    const name = p.payload?.difficulty || p.payload?.category || label;
    const total = p.payload?.total || 0;
    const correct = p.payload?.correct || 0;
    return (
        <div className="bg-card border border-border shadow-xl rounded-xl px-4 py-3 text-sm">
            <p className="text-muted-foreground font-medium mb-1">{name}</p>
            <p className="font-bold text-foreground">{correct}/{total} correct</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{p.value}% accuracy</p>
        </div>
    );
};

const TABS = [
    { key: 'list', label: 'My Assessments', icon: ClipboardList },
    { key: 'create', label: 'Create Assessment', icon: FilePlus2 },
];

const RANK_STYLES = {
    1: { ring: 'ring-amber-300 bg-amber-50 text-amber-700 border-amber-200', medal: 'text-amber-500', label: '🥇' },
    2: { ring: 'ring-slate-300 bg-slate-50 text-slate-600 border-slate-200', medal: 'text-slate-400', label: '🥈' },
    3: { ring: 'ring-orange-300 bg-orange-50 text-orange-700 border-orange-200', medal: 'text-orange-500', label: '🥉' },
};

// ── CSV export for the student ranking table ────────────────────────────────
// Neutralize CSV formula injection: cells starting with =, +, -, @ would be
// evaluated as formulas by Excel/Sheets. Prefix them with a single quote so
// they're treated as plain text.
const csvEscape = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const formatDuration = (secs) => {
    if (!secs && secs !== 0) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
};

const downloadRankingCSV = (quiz, ranking, summary = null) => {
    const rows = [
        ['Assessment', quiz.title || ''],
        ['Course', quiz.courseTitle || ''],
        [],
        ['Rank', 'Student Name', 'Roll No', 'Score (%)', 'Result', 'Time Taken', 'Attempts', 'Completed At'],
        ...ranking.map(r => [
            r.rank,
            r.name,
            r.rollNo || '',
            r.score,
            r.passed ? 'Passed' : 'Failed',
            formatDuration(r.timeTaken),
            r.attempts,
            r.completedAt ? new Date(r.completedAt).toLocaleString() : '',
        ]),
    ];
    if (summary) {
        rows.push([], ['SUMMARY', 'Participants', summary.participants], ['', 'Total Attempts', summary.totalAttempts],
            ['', 'Average Score', `${summary.avgScore}%`], ['', 'Highest Score', `${summary.highestScore}%`], ['', 'Pass Rate', `${summary.passRate}%`]);
    }
    const csv = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (quiz.title || 'assessment').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    a.href = url;
    a.download = `${safeName}_ranking.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke slightly so Firefox doesn't cancel the in-flight download.
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

export default function InstructorAssessments() {
    const { user } = useAuth();
    const [tab, setTab] = useState('list');
    const [selected, setSelected] = useState(null);

    const { data: quizzes, loading, reload } = useAsyncData(
        () => quizzesAPI.getByInstructor(user.id),
        [user.id]
    );

    const { data: detail, loading: detailLoading } = useAsyncData(
        () => selected ? quizzesAPI.getPerformance(selected.id) : Promise.resolve(null),
        [selected?.id]
    );

    const openDetail = (quiz) => { setSelected(quiz); setTab('detail'); };
    const goList = () => { setSelected(null); setTab('list'); };

    const summaryCards = (quizzes || []).length ? [
        { label: 'Total Assessments', value: quizzes.length, icon: ClipboardList, color: '#4f46e5', bg: 'bg-indigo-50' },
        { label: 'Total Attempts', value: quizzes.reduce((s, q) => s + q.attemptCount, 0).toLocaleString(), icon: Users, color: '#0891b2', bg: 'bg-cyan-50' },
        { label: 'Students Assessed', value: quizzes.reduce((s, q) => s + q.studentCount, 0).toLocaleString(), icon: Target, color: '#059669', bg: 'bg-emerald-50' },
        { label: 'Avg Score', value: quizzes.length ? `${Math.round(quizzes.reduce((s, q) => s + q.avgScore, 0) / quizzes.length)}%` : '—', icon: BarChart3, color: '#d97706', bg: 'bg-amber-50' },
    ] : [];

    return (
        <div className="space-y-8 max-w-6xl">
            <PageHeader
                title="Assessments"
                subtitle="Create exams, notify your students, and track their performance"
                action={
                    <button
                        onClick={() => setTab(tab === 'create' ? 'list' : 'create')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[15px] font-bold flex items-center gap-2 shadow-sm transition-colors"
                    >
                        {tab === 'create' ? <><ClipboardList size={18} /> View Assessments</> : <><PlusCircle size={18} /> New Assessment</>}
                    </button>
                }
            />

            {/* Tab bar */}
            <div className="flex gap-2 border-b border-border pb-4">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const isActive = tab === t.key || (t.key === 'list' && tab === 'detail');
                    return (
                        <button
                            key={t.key}
                            onClick={() => t.key === 'list' ? goList() : setTab(t.key)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border-2 transition-all ${
                                isActive
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                    : 'border-border bg-card text-muted-foreground hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                        >
                            <Icon size={16} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ── CREATE TAB ─────────────────────────────────────────────────── */}
            {tab === 'create' && (
                <InstructorQuizBuilder
                    redirectTo="/instructor/assessments"
                    onCreated={() => { reload(); goList(); }}
                />
            )}

            {/* ── DETAIL TAB ─────────────────────────────────────────────────── */}
            {tab === 'detail' && selected && (
                <DetailView
                    quiz={selected}
                    detail={detail}
                    loading={detailLoading}
                    onBack={goList}
                />
            )}

            {/* ── LIST TAB ───────────────────────────────────────────────────── */}
            {tab === 'list' && (
                <>
                    {loading ? <StatCardSkeleton count={4} /> : (
                        quizzes?.length > 0 && <StatCardGrid cols={4}>{summaryCards.map(c => <StatCard key={c.label} {...c} />)}</StatCardGrid>
                    )}

                    {loading ? (
                        <LoadingContainer height="h-64" />
                    ) : (quizzes ?? []).length === 0 ? (
                        <EmptyState
                            icon={ClipboardList}
                            message="You haven't created any assessments yet. Build one now and your enrolled students will be notified instantly!"
                            action={
                                <button
                                    onClick={() => setTab('create')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-[15px] font-bold shadow-sm inline-flex items-center gap-2 transition-colors"
                                >
                                    <PlusCircle size={20} /> Create Your First Assessment
                                </button>
                            }
                        />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {quizzes.map(q => (
                                <div
                                    key={q.id}
                                    className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group cursor-pointer"
                                    onClick={() => openDetail(q)}
                                >
                                    <div className="p-5 sm:p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-indigo-100">Assessment</span>
                                                    <span className="text-xs text-muted-foreground font-medium truncate">{new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                                </div>
                                                <h3 className="text-foreground font-bold text-[17px] leading-snug mb-1 group-hover:text-indigo-600 transition-colors">{q.title}</h3>
                                                <p className="text-muted-foreground text-[13px] font-medium truncate">{q.courseTitle}</p>
                                            </div>
                                            <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border">
                                                {q.courseThumbnail ? <CourseThumbnail thumbnail={q.courseThumbnail} alt="" className="w-full h-full object-cover" /> : <ClipboardList size={22} className="m-auto mt-4 text-muted-foreground/40" />}
                                            </div>
                                        </div>

                                        {/* Meta chips */}
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                                <ClipboardList size={13} className="text-indigo-500" /> {q.questionCount} Qs
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                                <Clock size={13} className="text-cyan-500" /> {q.timeLimit}m
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                                <Target size={13} className="text-amber-500" /> Pass {q.passingScore}%
                                            </span>
                                            {q.maxAttempts > 0 && (
                                                <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                                    <RotateCcw size={13} className="text-rose-500" /> {q.maxAttempts} attempts max
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                                <Users size={13} className="text-emerald-500" /> {q.studentCount} students
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stats footer */}
                                    <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-muted/20">
                                        <div className="p-3 text-center">
                                            <p className="text-lg font-black text-foreground">{q.attemptCount}</p>
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Attempts</p>
                                        </div>
                                        <div className="p-3 text-center">
                                            <p className="text-lg font-black text-indigo-600">{q.avgScore}%</p>
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Avg Score</p>
                                        </div>
                                        <div className="p-3 text-center">
                                            <p className={`text-lg font-black ${q.passRate >= 60 ? 'text-emerald-600' : q.passRate > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{q.passRate}%</p>
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Pass Rate</p>
                                        </div>
                                    </div>

                                    <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-card">
                                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">View ranking & performance <ChevronRight size={14} /></span>
                                        <Trophy size={16} className="text-amber-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function DetailView({ quiz, detail, loading, onBack }) {
    const summary = detail?.summary;
    const ranking = detail?.ranking || [];
    const [reviewing, setReviewing] = useState(null); // { studentId, name, rollNo }
    const [reminding, setReminding] = useState(false);
    const [remindMsg, setRemindMsg] = useState('');

    const sendReminder = async (payload = {}) => {
        setReminding(true);
        try {
            const res = await quizzesAPI.remindStudents(quiz.id, payload);
            toast.success(`Reminder sent to ${res.notified} student${res.notified === 1 ? '' : 's'}`);
            if (!payload.studentId) setRemindMsg(''); // clear custom message on bulk send
        } catch (err) {
            toast.error('Failed to send reminder: ' + err.message);
        } finally {
            setReminding(false);
        }
    };

    return (
        <div className="space-y-6">
            {reviewing && (
                <StudentAttemptReview
                    quiz={quiz}
                    student={reviewing}
                    onClose={() => setReviewing(null)}
                    onRemind={sendReminder}
                    reminding={reminding}
                />
            )}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-indigo-600 transition-colors">
                    <ArrowLeft size={16} /> Back to Assessments
                </button>

                {/* Re-take reminder / message */}
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="text"
                        value={remindMsg}
                        onChange={e => setRemindMsg(e.target.value)}
                        placeholder="Optional custom message…"
                        className="w-64 px-3 py-2 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm transition-shadow"
                    />
                    <button
                        onClick={() => sendReminder(remindMsg.trim() ? { message: remindMsg.trim() } : {})}
                        disabled={reminding}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
                        title="Send a re-take reminder to all enrolled students"
                    >
                        <Bell size={16} /> {reminding ? 'Sending…' : 'Remind All'}
                    </button>
                </div>
            </div>

            {/* Header card */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-16 -left-8 w-56 h-56 bg-violet-400/20 rounded-full blur-2xl" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-white/20 backdrop-blur px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider">Assessment Report</span>
                        <span className="text-white/80 text-xs font-medium">{quiz.courseTitle}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-1 tracking-tight">{quiz.title}</h2>
                    <p className="text-indigo-100 text-sm font-medium mb-4">{quiz.questionCount} questions · {quiz.timeLimit} min · {quiz.passingScore}% to pass</p>
                    <div className="flex flex-wrap gap-2">
                        <span className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><Target size={13} /> Pass mark {quiz.passingScore}%</span>
                        <span className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><Timer size={13} /> {quiz.timeLimit} min</span>
                        {quiz.maxAttempts > 0 && (
                            <span className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><RotateCcw size={13} /> {quiz.maxAttempts} attempts max</span>
                        )}
                    </div>
                </div>
            </div>

            {loading ? <LoadingContainer height="h-64" /> : (
                <>
                    {/* Summary stat cards */}
                    {summary && (
                        <StatCardGrid cols={4}>
                            <StatCard label="Students Participated" value={summary.participants} icon={Users} color="#4f46e5" bg="bg-indigo-50" />
                            <StatCard label="Total Attempts" value={summary.totalAttempts} icon={ClipboardList} color="#0891b2" bg="bg-cyan-50" />
                            <StatCard label="Average Score" value={`${summary.avgScore}%`} icon={BarChart3} color="#d97706" bg="bg-amber-50" />
                            <StatCard label="Pass Rate" value={`${summary.passRate}%`} icon={Trophy} color="#059669" bg="bg-emerald-50" />
                        </StatCardGrid>
                    )}

                    {/* Category & difficulty score breakdown charts */}
                    {detail?.breakdown && (detail.breakdown.byDifficulty.some(d => d.total > 0) || detail.breakdown.byCategory.some(c => c.total > 0)) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Difficulty-wise chart */}
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                                        <BarChart3 size={20} className="text-indigo-500" /> Score by Difficulty
                                    </h3>
                                    <span className="text-[11px] font-bold text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg uppercase tracking-wider">Accuracy</span>
                                </div>
                                <div className="h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={detail.breakdown.byDifficulty} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                            <XAxis dataKey="difficulty" tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                                            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} width={44} />
                                            <RechartsTooltip content={<BreakdownTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                            <Bar dataKey="accuracy" radius={[8, 8, 0, 0]} maxBarSize={48}>
                                                {detail.breakdown.byDifficulty.map(entry => (
                                                    <Cell key={entry.difficulty} fill={DIFF_COLORS[entry.difficulty] || '#f59e0b'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend + mini stats */}
                                <div className="grid grid-cols-3 gap-2 mt-5">
                                    {detail.breakdown.byDifficulty.map(d => (
                                        <div key={d.difficulty} className="rounded-xl p-3 text-center" style={{ backgroundColor: (DIFF_COLORS[d.difficulty] || '#f59e0b') + '14' }}>
                                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: DIFF_COLORS[d.difficulty] || '#f59e0b' }}>{d.difficulty}</p>
                                            <p className="text-lg font-black text-foreground">{d.accuracy}%</p>
                                            <p className="text-[11px] font-medium text-muted-foreground">{d.correct}/{d.total}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Category-wise chart */}
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                                        <Layers size={20} className="text-cyan-500" /> Score by Category
                                    </h3>
                                    <span className="text-[11px] font-bold text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg uppercase tracking-wider">Accuracy</span>
                                </div>
                                <div className="h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={detail.breakdown.byCategory.slice(0, 6)}
                                            layout="vertical"
                                            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
                                            <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 11, fontWeight: 600 }} />
                                            <RechartsTooltip content={<BreakdownTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                            <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} maxBarSize={20}>
                                                {detail.breakdown.byCategory.slice(0, 6).map((entry, i) => (
                                                    <Cell key={entry.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend chips */}
                                <div className="flex flex-wrap gap-2 mt-5">
                                    {detail.breakdown.byCategory.slice(0, 6).map((c, i) => (
                                        <span key={c.category} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            {c.category} · {c.accuracy}% ({c.correct}/{c.total})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {ranking.length === 0 ? (
                        <EmptyState
                            icon={Trophy}
                            message="No students have attempted this assessment yet. Share it with your students and check back for the leaderboard!"
                        />
                    ) : (
                        <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Trophy size={20} className="text-amber-500" /> Student Ranking
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-3 py-1 rounded-lg">{ranking.length} ranked</span>
                                    <button
                                        onClick={() => downloadRankingCSV(quiz, ranking, summary)}
                                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors"
                                        title="Download rankings as CSV"
                                    >
                                        <Download size={14} /> Download CSV
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-left">
                                    <thead className="bg-muted/40 border-b border-border">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Rank</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Student</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Roll No</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Score</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Result</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Time Taken</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Attempts</th>
                                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {ranking.map((r) => {
                                            const style = RANK_STYLES[r.rank] || {};
                                            const top3 = r.rank <= 3;
                                            return (
                                                <tr key={r.studentId} className={`hover:bg-muted/40 transition-colors ${top3 ? 'bg-amber-50/40' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        {top3 ? (
                                                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border-2 ring-2 ${style.ring || ''} text-base`}>
                                                                {style.label}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-muted border border-border text-sm font-black text-muted-foreground">
                                                                {r.rank}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {r.avatar ? (
                                                                <img src={r.avatar} alt={r.name} className="w-9 h-9 rounded-full object-cover border border-border" />
                                                            ) : (
                                                                <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600">
                                                                    {r.name?.charAt(0)?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            <span className="font-bold text-foreground">{r.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">{r.rollNo || '—'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-base font-black text-foreground">{r.score}%</span>
                                                        {top3 && <Sparkles size={14} className="inline ml-1 text-amber-500" />}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {r.passed ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                                                                <CheckCircle size={12} /> Passed
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800">
                                                                <XCircle size={12} /> Failed
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground">
                                                        {r.timeTaken ? `${Math.floor(r.timeTaken / 60)}m ${r.timeTaken % 60}s` : '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-foreground">{r.attempts}</span>
                                                        <span className="text-xs text-muted-foreground/60 ml-1">×</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setReviewing({ studentId: r.studentId, name: r.name, rollNo: r.rollNo })}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 transition-colors"
                                                            title="Review this student's answers"
                                                        >
                                                            <Eye size={14} /> Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Per-question answer review modal for a single student ────────────────────
function StudentAttemptReview({ quiz, student, onClose, onRemind, reminding }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attemptIdx, setAttemptIdx] = useState(0);

    useEffect(() => {
        quizzesAPI.getStudentAttempts(quiz.id, student.studentId)
            .then(res => { setData(res); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, [quiz.id, student.studentId]);

    // Close on Escape + lock body scroll while the modal is open
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

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

    const attempts = data?.attempts || [];
    const attempt = attempts[Math.min(attemptIdx, Math.max(attempts.length - 1, 0))];
    const correctCount = attempt?.questions?.filter(q => q.correct).length || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center gap-4 bg-muted/30">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-lg font-black text-indigo-700 flex-shrink-0">
                        {student.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-extrabold text-foreground truncate">{student.name}</h3>
                        <p className="text-sm text-muted-foreground font-medium flex items-center gap-2 flex-wrap">
                            {student.rollNo && <span className="inline-flex items-center gap-1"><Award size={12} /> Roll: {student.rollNo}</span>}
                            <span className="text-xs">·</span>
                            <span className="inline-flex items-center gap-1"><ClipboardList size={12} /> {quiz.title}</span>
                        </p>
                    </div>
                    {attempts.length > 1 && (
                        <div className="flex items-center gap-1">
                            {attempts.map((a, i) => (
                                <button
                                    key={a.attemptId}
                                    onClick={() => setAttemptIdx(i)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        i === Math.min(attemptIdx, attempts.length - 1)
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-card text-muted-foreground border-border hover:border-indigo-300'
                                    }`}
                                    title={`Attempt ${i + 1} — ${a.score}%`}
                                >
                                    #{i + 1}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onRemind({ studentId: student.studentId })}
                            disabled={reminding}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 disabled:opacity-60 disabled:cursor-not-allowed text-amber-800 border border-amber-200 shadow-sm transition-colors"
                            title="Send this student a re-take reminder"
                        >
                            <Send size={14} /> {reminding ? 'Sending…' : 'Remind'}
                        </button>
                        <Link
                            to={`/instructor/assessments/${quiz.id}/student/${student.studentId}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                            title="Open printable full report"
                        >
                            <Award size={14} /> Full Report
                        </Link>
                        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" title="Close">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {loading && <LoadingContainer height="h-48" />}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 font-medium">
                            Failed to load attempts: {error}
                        </div>
                    )}
                    {!loading && !error && attempt && (
                        <>
                            {/* Attempt summary strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                                    <p className="text-xl font-black text-emerald-700">{attempt.score}%</p>
                                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Score</p>
                                </div>
                                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                                    <p className="text-xl font-black text-indigo-700">{correctCount}/{attempt.questions?.length || 0}</p>
                                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Correct</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                    <p className="text-xl font-black text-amber-700">{attempt.violations || 0}</p>
                                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Violations</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                    <p className="text-xl font-black text-slate-700">{formatDuration(attempt.timeTaken)}</p>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Time</p>
                                </div>
                            </div>

                            {/* Per-question breakdown */}
                            <div className="space-y-3">
                                {attempt.questions.map((q, i) => {
                                    const answered = isAnswered(q);
                                    return (
                                        <div key={q.questionId} className={`border rounded-xl overflow-hidden ${q.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
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
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                                    q.difficulty === 'EASY' ? 'bg-emerald-50 text-emerald-600' :
                                                    q.difficulty === 'HARD' ? 'bg-rose-50 text-rose-600' :
                                                    'bg-amber-50 text-amber-600'
                                                }`}>
                                                    <Gauge size={10} /> {q.difficulty}
                                                </span>
                                                <span className="ml-auto text-xs font-black">{q.correct ? 'Correct' : 'Incorrect'}</span>
                                            </div>
                                            <div className="px-4 py-3 space-y-2.5">
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
                                                                        'bg-card text-muted-foreground border-border'
                                                                    }`}
                                                                >
                                                                    {opt}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-medium">
                                                    <span className="text-muted-foreground">
                                                        <span className="font-bold text-foreground">Student answer:</span>{' '}
                                                        {answered ? formatAnswer(q.givenAnswer) : <span className="text-amber-600 font-bold">Not answered</span>}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        <span className="font-bold text-emerald-700">Correct answer:</span> {formatAnswer(q.correctAnswer)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {!loading && !error && attempts.length === 0 && (
                        <EmptyState icon={Eye} message="No attempt data found for this student." />
                    )}
                </div>
            </div>
        </div>
    );
}
