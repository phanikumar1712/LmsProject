import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Clock, Target, Play, CheckCircle, XCircle, RotateCcw, FileText, Trophy
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { quizzesAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatCard, StatCardGrid, StatCardSkeleton } from '../../../components/ui/StatCard';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import { useAsyncData } from '../../../hooks/useAsyncData';
import toast from 'react-hot-toast';

export default function StudentExams() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { data: exams, loading, reload } = useAsyncData(
        () => quizzesAPI.getAvailableExams(),
        [user?.id]
    );

    const { data: attempts } = useAsyncData(
        () => quizzesAPI.getAttempts(user?.id),
        [user?.id]
    );

    const attemptMap = {};
    (attempts || []).forEach(a => {
        if (!attemptMap[a.quizId]) attemptMap[a.quizId] = { count: 0, bestScore: 0, passed: false };
        attemptMap[a.quizId].count += 1;
        attemptMap[a.quizId].bestScore = Math.max(attemptMap[a.quizId].bestScore, a.score || 0);
        if (a.passed) attemptMap[a.quizId].passed = true;
    });

    const safeExams = exams ?? [];
    const attemptedExams = safeExams.filter(e => e.attempted);
    const attemptedCount = attemptedExams.length;
    const pendingCount = safeExams.length - attemptedCount;
    const avgBest = attemptedExams.length
        ? Math.round(attemptedExams.reduce((s, e) => s + (attemptMap[e.id]?.bestScore || 0), 0) / attemptedExams.length)
        : null;

    const statCards = [
        { label: 'Available Exams', value: safeExams.length, icon: FileText, color: '#4f46e5', bg: 'bg-indigo-50' },
        { label: 'Pending', value: pendingCount, icon: ClipboardList, color: '#d97706', bg: 'bg-amber-50' },
        { label: 'Attempted', value: attemptedCount, icon: CheckCircle, color: '#059669', bg: 'bg-emerald-50' },
        { label: 'Avg Best Score', value: avgBest === null ? '—' : `${avgBest}%`, icon: Trophy, color: '#0891b2', bg: 'bg-cyan-50' },
    ];

    const startExam = (exam) => {
        if (exam.maxAttempts > 0 && exam.attemptsLeft === 0) {
            toast.error(`You've used all ${exam.maxAttempts} allowed attempts for this assessment.`);
            return;
        }
        toast.success(`Starting "${exam.title}" — good luck! 🍀`);
        navigate(`/courses/${exam.courseId}/quiz/${exam.id}`);
    };

    const attemptsExhausted = (exam) => exam.maxAttempts > 0 && exam.attemptsLeft === 0;

    return (
        <div className="space-y-8 max-w-6xl">
            <PageHeader
                title="Write Exam"
                subtitle="Your assessments from enrolled courses — pick one and start!"
                action={
                    <button
                        onClick={() => reload()}
                        className="bg-card border border-border hover:bg-muted/40 px-5 py-2.5 rounded-xl text-[15px] font-bold text-foreground/80 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <RotateCcw size={18} /> Refresh
                    </button>
                }
            />

            {loading ? <StatCardSkeleton count={4} /> : (
                safeExams.length > 0 && <StatCardGrid cols={4}>{statCards.map(c => <StatCard key={c.label} {...c} />)}</StatCardGrid>
            )}

            {loading ? (
                <LoadingContainer height="h-64" />
            ) : safeExams.length === 0 ? (
                <EmptyState
                    icon={ClipboardList}
                    message="No assessments available right now. When your instructor creates an exam for one of your courses, you'll see it here and get a notification!"
                    action={
                        <button
                            onClick={() => navigate('/courses')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-[15px] font-bold shadow-sm inline-flex items-center gap-2 transition-colors"
                        >
                            Browse Courses
                        </button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {safeExams.map(exam => {
                        const mine = attemptMap[exam.id];
                        const hasAttempted = !!mine && mine.count > 0;
                        const passed = mine?.passed;
                        return (
                            <div
                                key={exam.id}
                                className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group"
                            >
                                <div className="p-5 sm:p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-rose-100">Exam</span>
                                                <span className="text-xs text-muted-foreground font-medium truncate">{exam.courseTitle}</span>
                                            </div>
                                            <h3 className="text-foreground font-bold text-[17px] leading-snug mb-2 group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                                            <p className="text-muted-foreground text-[13px] font-medium line-clamp-2">{exam.description}</p>
                                        </div>
                                        <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border">
                                            {exam.courseThumbnail ? <CourseThumbnail thumbnail={exam.courseThumbnail} alt="" className="w-full h-full object-cover" /> : <FileText size={22} className="m-auto mt-4 text-muted-foreground/40" />}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                            <FileText size={13} className="text-indigo-500" /> {exam.questionCount} Qs
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                            <Clock size={13} className="text-cyan-500" /> {exam.timeLimit} min
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-lg text-xs font-bold text-foreground/70">
                                            <Target size={13} className="text-amber-500" /> Pass {exam.passingScore}%
                                        </span>
                                        {exam.maxAttempts > 0 && (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                attemptsExhausted(exam)
                                                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                                                    : 'bg-muted/50 border-border text-foreground/70'
                                            }`}>
                                                <RotateCcw size={13} className={attemptsExhausted(exam) ? 'text-rose-500' : 'text-violet-500'} />
                                                {attemptsExhausted(exam)
                                                    ? `${exam.maxAttempts}/${exam.maxAttempts} used`
                                                    : `${exam.attemptsLeft} of ${exam.maxAttempts} left`}
                                            </span>
                                        )}
                                    </div>

                                    {/* Attempt status */}
                                    {hasAttempted && (
                                        <div className="mt-4 flex items-center gap-3">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                {passed ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                                {passed ? 'Passed' : 'Failed'}
                                            </span>
                                            <span className="text-xs font-bold text-muted-foreground">
                                                Best: <span className="text-foreground">{mine.bestScore}%</span> · {mine.count} attempt{mine.count > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="px-5 py-3 border-t border-border bg-muted/20">
                                    {attemptsExhausted(exam) ? (
                                        <button
                                            disabled
                                            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-muted text-muted-foreground/60 cursor-not-allowed border border-border"
                                        >
                                            <XCircle size={16} /> Attempts Exhausted
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => startExam(exam)}
                                            className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                                                hasAttempted
                                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                            }`}
                                        >
                                            {hasAttempted ? <><RotateCcw size={16} /> Reattempt Exam</> : <><Play size={16} /> Start Exam</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
