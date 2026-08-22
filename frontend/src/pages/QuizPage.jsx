import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    AlertTriangle, X, Clock, Shield, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Maximize2
} from 'lucide-react';
import { quizzesAPI, enrollmentsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const MAX_VIOLATIONS = 3;

export default function QuizPage() {
    const { courseId, quizId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [attemptsUsed, setAttemptsUsed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [started, setStarted] = useState(false);
    const [finished, setFinished] = useState(false);
    const [result, setResult] = useState(null);
    const [attemptId, setAttemptId] = useState(null);

    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [fillText, setFillText] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [violations, setViolations] = useState(0);
    const [warning, setWarning] = useState(null);
    const [, setIsFullscreen] = useState(false);

    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const containerRef = useRef(null);
    const submittingRef = useRef(false);
    const lastViolationTimeRef = useRef(0);

    useEffect(() => {
        quizzesAPI.getById(quizId).then(q => {
            setQuiz(q);
            // Count how many attempts this student has already used for this quiz
            if (user?.id && q?.maxAttempts > 0) {
                quizzesAPI.getAttempts(user.id).then(attempts => {
                    const used = (attempts || []).filter(a => a.quizId === q.id).length;
                    setAttemptsUsed(used);
                }).catch(() => { });
            }
        }).catch((err) => {
            toast.error(err.message || 'Failed to load quiz. Redirecting back...');
            navigate(`/courses/${courseId}/learn`);
        }).finally(() => setLoading(false));
    }, [quizId, courseId, navigate, user?.id]);

    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const submitQuiz = useCallback(async (finalAnswers, finalViolations, auto = false) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        clearInterval(timerRef.current);

        try {
            const answerPayload = {};
            questions.forEach((question, index) => {
                const ans = finalAnswers[index];
                if (ans !== undefined && ans !== null) {
                    if (question.type === 'MCQ' || question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') {
                        answerPayload[question.id] = question.options[ans];
                    } else if (question.type === 'MCQ_MULTI') {
                        const sortedIndices = [...ans].sort((a, b) => a - b);
                        answerPayload[question.id] = sortedIndices.map(i => question.options[i]);
                    } else {
                        answerPayload[question.id] = ans;
                    }
                }
            });
            const res = await quizzesAPI.submitAttempt(quizId, attemptId, answerPayload, finalViolations);
            setResult(res);
            setFinished(true);
            if (auto) toast.error('Quiz auto-submitted due to violations!');
            // Exit fullscreen
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });

            // Mark the quiz lesson as complete in enrollment progress
            if (res.passed && quiz.lessonId && courseId && user?.id) {
                try {
                    await enrollmentsAPI.markLessonComplete(user.id, courseId, quiz.lessonId);
                } catch { /* non-blocking */ }
            }
        } catch (err) {
            submittingRef.current = false;
            toast.error('Failed to submit: ' + err.message);
        }
    }, [attemptId, courseId, questions, quiz, quizId, user.id]);

    // Timer
    useEffect(() => {
        if (!started || finished) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current);
                    submitQuiz(answers, violations, true);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [started, finished, answers, violations, submitQuiz]);

    // Unified Anti-cheat Handler
    useEffect(() => {
        if (!started || finished) return;

        const VIOLATION_COOLDOWN = 2000; // Prevent multiple events from double-counting

        const triggerViolation = (msg) => {
            const now = Date.now();
            if (now - lastViolationTimeRef.current < VIOLATION_COOLDOWN) return;
            lastViolationTimeRef.current = now;

            setViolations(v => {
                const newV = v + 1;
                if (newV >= MAX_VIOLATIONS) {
                    setWarning(null);
                    submitQuiz(answers, newV, true);
                } else {
                    setWarning(`⚠️ ${msg} ${MAX_VIOLATIONS - newV} warning(s) remaining.`);
                    setTimeout(() => setWarning(null), 4000);
                }
                return newV;
            });
        };

        const handleVisibility = () => {
            if (document.hidden || document.visibilityState === 'hidden') {
                triggerViolation('Tab switch detected!');
            }
        };

        const handleBlur = () => {
            triggerViolation('Window focus lost!');
        };

        const handleFsChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                triggerViolation('Fullscreen exited!');
            } else {
                setIsFullscreen(true);
            }
        };

        const handleKeyDown = (e) => {
            if ((e.key === 'Tab' || e.keyCode === 9) && (e.ctrlKey || e.altKey || e.metaKey)) {
                triggerViolation('Restricted shortcut detected!');
                e.preventDefault();
            }
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
                triggerViolation('Developer tools access restricted!');
                e.preventDefault();
            }
            if (e.altKey && e.key === 'F4') {
                triggerViolation('Exit shortcut detected!');
                e.preventDefault();
            }
        };

        const handlePreventEvent = (e) => {
            e.preventDefault();
            triggerViolation('Copy/Paste/Right-click restricted!');
        };

        const handlePopState = (e) => {
            e.preventDefault();
            window.history.pushState(null, '', window.location.href);
            triggerViolation('Back navigation restricted!');
        };

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = 'You have an active quiz! Changes may not be saved.';
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFsChange);
        window.addEventListener('keydown', handleKeyDown);

        document.addEventListener('contextmenu', handlePreventEvent);
        document.addEventListener('copy', handlePreventEvent);
        document.addEventListener('paste', handlePreventEvent);
        document.addEventListener('cut', handlePreventEvent);
        document.addEventListener('drop', handlePreventEvent);
        document.addEventListener('selectstart', handlePreventEvent);

        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
        window.addEventListener('beforeunload', handleBeforeUnload);

        const integrityInterval = setInterval(() => {
            if (document.hidden || document.visibilityState === 'hidden') {
                triggerViolation('Tab switch detected!');
            }
        }, 1500);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFsChange);
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('contextmenu', handlePreventEvent);
            document.removeEventListener('copy', handlePreventEvent);
            document.removeEventListener('paste', handlePreventEvent);
            document.removeEventListener('cut', handlePreventEvent);
            document.removeEventListener('drop', handlePreventEvent);
            document.removeEventListener('selectstart', handlePreventEvent);
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(integrityInterval);
        };
    }, [started, finished, answers, submitQuiz]);

    // Fullscreen helper
    const enterFullscreen = async () => {
        try {
            await document.documentElement.requestFullscreen?.();
            // Optional lock if available (Screen Wake Lock / Pointer Lock usually not needed for normal quiz)
            setIsFullscreen(true);
        } catch { /* noop */ }
    };

    const handleReattempt = () => {
        window.location.reload();
    };

    const startQuiz = async () => {
        try {
            const startedAttempt = await quizzesAPI.startAttempt(quizId);
            const startedQuiz = startedAttempt.quiz;
            setQuiz(startedQuiz);
            setAttemptId(startedAttempt.attemptId);
            // Randomize question order AND option order per attempt. Answers are
            // submitted as option TEXT, so shuffling display order never breaks
            // grading — each attempt simply sees options in a different order.
            setQuestions([...(startedQuiz.questions || [])]
                .sort(() => Math.random() - 0.5)
                .map(q => {
                    const opts = [...(q.options || [])];
                    for (let i = opts.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [opts[i], opts[j]] = [opts[j], opts[i]];
                    }
                    return { ...q, options: opts };
                }));
            const remainingSeconds = Math.max(0, Math.floor(
                (new Date(startedAttempt.expiresAt).getTime() - Date.now()) / 1000
            ));
            setTimeLeft(remainingSeconds);
            await enterFullscreen();
            startTimeRef.current = Date.now();
            setStarted(true);
        } catch (err) {
            toast.error(err.message || 'Unable to start quiz');
        }
    };

    const handleAnswer = (val) => {
        setAnswers(a => ({ ...a, [currentQ]: val }));
    };

    const handleFillSubmit = () => {
        if (fillText.trim()) {
            setAnswers(a => ({ ...a, [currentQ]: fillText.trim() }));
        }
    };

    const handleNext = () => {
        if (questions[currentQ]?.type === 'FILL_BLANK' || questions[currentQ]?.type === 'SHORT_ANSWER') handleFillSubmit();
        if (currentQ < questions.length - 1) { setCurrentQ(c => c + 1); setFillText(''); }
    };

    const handlePrev = () => {
        if (currentQ > 0) { setCurrentQ(c => c - 1); setFillText(answers[currentQ - 1] || ''); }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // Results screen
    if (finished && result) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-muted/40">
                <div className="bg-card border border-border shadow-xl rounded-2xl p-10 max-w-md w-full text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${result.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {result.passed
                            ? <CheckCircle size={48} />
                            : <XCircle size={48} />}
                    </div>
                    <h2 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">
                        {result.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                    </h2>
                    <p className="text-muted-foreground font-medium mb-2">{quiz?.title}</p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-8 ${result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {result.passed ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        Status: {result.passed ? 'Passed' : 'Failed'}
                    </span>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-muted/40 border border-border rounded-xl p-4">
                            <p className="text-3xl font-black text-indigo-600">{Math.round((result.score / 100) * (quiz?.questionCount || 0))} / {quiz?.questionCount || 0}</p>
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mt-1">Score</p>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-xl p-4">
                            <p className="text-3xl font-black text-cyan-600">{result.score}%</p>
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mt-1">Percentage</p>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-xl p-4">
                            <p className={`text-3xl font-black ${violations > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{violations}</p>
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mt-1">Violations</p>
                        </div>
                    </div>

                    {result.passed && (
                        <div className="bg-amber-50 rounded-xl p-4 mb-8 border border-amber-200 shadow-sm">
                            <p className="text-amber-700 font-bold mb-1">🏆 Certificate Eligible!</p>
                            <p className="text-amber-600 text-xs font-medium">Complete the course to claim your certificate</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={handleReattempt} className="flex-1 bg-amber-500 hover:bg-amber-600 border border-amber-600 py-3 rounded-xl text-white font-bold transition-all shadow-sm">
                            Reattempt
                        </button>
                        <button onClick={() => navigate(-1)} className="flex-1 bg-card border border-border hover:bg-muted/40 hover:border-border py-3 rounded-xl text-foreground/80 font-bold transition-all shadow-sm">
                            Back
                        </button>
                        <button onClick={() => navigate('/student/quizzes')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl text-white font-bold shadow-sm transition-colors">
                            Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Pre-start screen
    if (!started) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-muted/40">
                <div className="bg-card border border-border shadow-xl rounded-2xl p-8 max-w-lg w-full" ref={containerRef}>
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <Shield size={32} className="text-indigo-600" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">{quiz?.title}</h2>
                        <p className="text-muted-foreground font-medium">{quiz?.instructions}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        <div className="bg-muted/40 border border-border rounded-xl p-4 text-center shadow-sm">
                            <p className="text-foreground font-black text-2xl mb-1">{quiz?.questionCount ?? quiz?.questions?.length ?? 0}</p>
                            <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-wider">Questions</p>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-xl p-4 text-center shadow-sm">
                            <p className="text-foreground font-black text-2xl mb-1">{quiz?.timeLimit}m</p>
                            <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-wider">Time Limit</p>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-xl p-4 text-center shadow-sm">
                            <p className="text-foreground font-black text-2xl mb-1">{quiz?.passingScore}%</p>
                            <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-wider">Pass Score</p>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-xl p-4 text-center shadow-sm">
                            <p className={`text-foreground font-black text-2xl mb-1 ${quiz?.maxAttempts > 0 && attemptsUsed >= quiz.maxAttempts ? 'text-rose-500' : ''}`}>
                                {quiz?.maxAttempts > 0
                                    ? `${Math.max(0, quiz.maxAttempts - attemptsUsed)}/${quiz.maxAttempts}`
                                    : '∞'}
                            </p>
                            <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-wider">Attempts Left</p>
                        </div>
                    </div>

                    {quiz?.maxAttempts > 0 && attemptsUsed >= quiz.maxAttempts && (
                        <div className="bg-rose-50 rounded-xl p-5 mb-8 border border-rose-200 shadow-sm">
                            <h4 className="text-rose-700 font-bold text-[15px] mb-2 flex items-center gap-2">
                                <XCircle size={16} /> Attempt Limit Reached
                            </h4>
                            <p className="text-[13px] font-medium text-rose-600/80">
                                You have used all {quiz.maxAttempts} allowed attempt{quiz.maxAttempts > 1 ? 's' : ''} for this assessment.
                                Contact your instructor if you need another attempt.
                            </p>
                        </div>
                    )}

                    {quiz?.negativeMarking > 0 && (
                        <div className="bg-amber-50 rounded-xl p-5 mb-8 border border-amber-200 shadow-sm">
                            <h4 className="text-amber-700 font-bold text-[15px] mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} /> Negative Marking
                            </h4>
                            <p className="text-[13px] font-medium text-amber-700/80">
                                Wrong answers deduct {quiz.negativeMarking * 100}% of a question's marks. Scores never go below 0.
                            </p>
                        </div>
                    )}

                    <div className="bg-rose-50 rounded-xl p-5 mb-8 border border-rose-200 shadow-sm">
                        <h4 className="text-rose-700 font-bold text-[15px] mb-3 flex items-center gap-2">
                            <Shield size={16} /> Anti-Cheating Rules
                        </h4>
                        <ul className="space-y-2.5 text-[13px] font-medium text-rose-600/80">
                            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-400 text-transparent rounded-full flex-shrink-0" />Quiz runs in fullscreen mode</li>
                            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-400 text-transparent rounded-full flex-shrink-0" />Tab switching is monitored</li>
                            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-400 text-transparent rounded-full flex-shrink-0" />Right-click & copy are disabled</li>
                            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-400 text-transparent rounded-full flex-shrink-0" />3 violations = auto-submit</li>
                            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-400 text-transparent rounded-full flex-shrink-0" />Timer auto-submits on expiry</li>
                        </ul>
                    </div>

                    {quiz?.maxAttempts > 0 && attemptsUsed >= quiz.maxAttempts ? (
                        <button disabled className="w-full py-4 rounded-xl bg-muted text-muted-foreground/60 font-bold text-base cursor-not-allowed flex items-center justify-center gap-2 border border-border">
                            <XCircle size={18} /> Attempts Exhausted
                        </button>
                    ) : (
                        <button onClick={startQuiz} className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-sm flex items-center justify-center gap-2 transition-colors">
                            <Maximize2 size={18} /> Start Quiz (Enters Fullscreen)
                        </button>
                    )}
                    <button onClick={() => navigate(-1)} className="w-full mt-4 text-muted-foreground hover:text-foreground font-medium text-sm py-2 transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Active quiz
    const q = questions[currentQ];
    const timerDanger = timeLeft < 60;
    const timerWarning = timeLeft < 180;

    return (
        <div
            ref={containerRef}
            className="min-h-screen flex flex-col select-none bg-muted/40"
            style={{ userSelect: 'none' }}
        >
            {/* Violation warning banner */}
            {warning && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-rose-600 text-white shadow-md px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={20} />
                        <p className="text-sm font-bold tracking-wide">{warning}</p>
                    </div>
                    <button onClick={() => setWarning(null)} className="text-rose-200 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <Shield size={16} className="text-indigo-600" />
                    </div>
                    <span className="text-foreground font-bold text-[15px]">{quiz?.title}</span>
                </div>
                <div className="flex items-center gap-4">
                    {/* Violations */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg border border-border">
                        {Array(MAX_VIOLATIONS).fill(0).map((_, i) => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < violations ? 'bg-rose-500 shadow-sm' : 'bg-muted-foreground/30'}`} />
                        ))}
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide ml-1">{violations}/{MAX_VIOLATIONS} violations</span>
                    </div>
                    {/* Timer */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[15px] font-bold shadow-inner ${timerDanger ? 'bg-rose-50 text-rose-700 border border-rose-200' : timerWarning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-muted/40 text-foreground/80 border border-border'}`}>
                        <Clock size={16} />
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div className="flex gap-1 px-8 mt-6 max-w-5xl mx-auto w-full">
                {questions.map((_, i) => (
                    <div key={i} className="flex-1 h-2 rounded-full overflow-hidden transition-colors"
                        style={{ background: answers[i] !== undefined ? '#4f46e5' : i === currentQ ? '#c7d2fe' : '#e2e8f0' }} />
                ))}
            </div>

            {/* Question */}
            <div className="flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-3xl">
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-8 sm:p-10">
                        <div className="flex items-center justify-between mb-8">
                            <span className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wide shadow-sm flex-shrink-0">Question {currentQ + 1} / {questions.length}</span>
                            <span className="bg-muted/40 border border-border text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest">{q?.type?.replace('_', ' ')}</span>
                        </div>
                        <h3 className="text-foreground text-2xl font-extrabold mb-8 leading-relaxed tracking-tight">
                            {q?.text}
                        </h3>

                        {/* Options */}
                        {(q?.type === 'MCQ' || q?.type === 'MCQ_SINGLE' || q?.type === 'TRUE_FALSE' || q?.type === 'MCQ_MULTI') && (
                            <div className="space-y-4">
                                {q.options.map((opt, i) => {
                                    const isSelected = q?.type === 'MCQ_MULTI'
                                        ? (answers[currentQ] || []).includes(i)
                                        : answers[currentQ] === i;

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (q?.type === 'MCQ_MULTI') {
                                                    const cur = answers[currentQ] || [];
                                                    const next = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i];
                                                    setAnswers(a => ({ ...a, [currentQ]: next }));
                                                } else {
                                                    handleAnswer(i);
                                                }
                                            }}
                                            className={`w-full text-left p-5 rounded-xl border-2 transition-all text-base font-bold group flex items-center ${isSelected
                                                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                                                : 'border-border text-foreground/80 hover:border-indigo-300 hover:bg-muted/40'
                                                }`}
                                        >
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs mr-4 font-black flex-shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-muted text-muted-foreground group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                                }`}>
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Fill in the blank / Short answer */}
                        {(q?.type === 'FILL_BLANK' || q?.type === 'SHORT_ANSWER') && (
                            <div className="mt-4">
                                {q?.type === 'SHORT_ANSWER' ? (
                                    <textarea
                                        value={fillText || answers[currentQ] || ''}
                                        onChange={e => setFillText(e.target.value)}
                                        placeholder="Type your answer here..."
                                        rows={4}
                                        className="w-full bg-muted/40 border-2 border-border outline-none text-foreground placeholder:text-muted-foreground/60 rounded-xl p-5 text-lg font-medium focus:border-indigo-500 focus:bg-card transition-all resize-y"
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={fillText || answers[currentQ] || ''}
                                        onChange={e => setFillText(e.target.value)}
                                        placeholder="Type your answer here..."
                                        className="w-full bg-muted/40 border-2 border-border outline-none text-foreground placeholder:text-muted-foreground/60 rounded-xl p-5 text-lg font-medium focus:border-indigo-500 focus:bg-card transition-all"
                                        autoComplete="off"
                                        spellCheck="false"
                                    />
                                )}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-12 pt-8 border-t border-border">
                            <button
                                onClick={handlePrev}
                                disabled={currentQ === 0}
                                className="bg-card border border-border px-6 py-3 rounded-lg text-[15px] font-bold text-muted-foreground hover:bg-muted/40 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:hover:bg-card disabled:hover:border-border disabled:hover:text-muted-foreground flex items-center gap-2 transition-all shadow-sm"
                            >
                                <ChevronLeft size={18} /> Previous
                            </button>

                            <div className="text-[13px] font-bold text-muted-foreground/60 bg-muted/40 px-4 py-2 rounded-md border border-border">
                                <span className="text-indigo-600">{Object.keys(answers).length}</span> / {questions.length} answered
                            </div>

                            {currentQ === questions.length - 1 ? (
                                <button
                                    onClick={() => {
                                        const finalAnswers = { ...answers };
                                        if ((q?.type === 'FILL_BLANK' || q?.type === 'SHORT_ANSWER') && fillText.trim()) {
                                            finalAnswers[currentQ] = fillText.trim();
                                        }
                                        submitQuiz(finalAnswers, violations);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-lg text-white text-[15px] font-bold shadow-sm transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle size={18} /> Submit Quiz
                                </button>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-lg text-white text-[15px] font-bold shadow-sm transition-colors flex items-center gap-2"
                                >
                                    Next <ChevronRight size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
