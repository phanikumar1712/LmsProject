import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    AlertTriangle, X, Clock, Shield, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, Maximize2, Eye, EyeOff
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
    const [loading, setLoading] = useState(true);
    const [started, setStarted] = useState(false);
    const [finished, setFinished] = useState(false);
    const [result, setResult] = useState(null);

    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [fillText, setFillText] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [violations, setViolations] = useState(0);
    const [warning, setWarning] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const containerRef = useRef(null);
    const submittingRef = useRef(false);

    useEffect(() => {
        quizzesAPI.getById(quizId).then(q => {
            setQuiz(q);
            // Randomize questions
            const shuffled = [...(q.questions || [])].sort(() => Math.random() - 0.5);
            setQuestions(shuffled);
            setTimeLeft((q.timeLimit || 10) * 60);
        }).catch((err) => {
            toast.error(err.message || 'Failed to load quiz. Redirecting back...');
            navigate(`/courses/${courseId}/learn`);
        }).finally(() => setLoading(false));
    }, [quizId, courseId, navigate]);

    const submitQuiz = useCallback(async (finalAnswers, finalViolations, auto = false) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        clearInterval(timerRef.current);

        const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000 / 60);
        try {
            const answerArr = quiz.questions.map(origQ => {
                const idx = questions.findIndex(sq => sq.id === origQ.id);
                if (idx === -1) return null;
                const ans = finalAnswers[idx];
                if (ans !== undefined && ans !== null) {
                    if (origQ.type === 'MCQ' || origQ.type === 'MCQ_SINGLE' || origQ.type === 'TRUE_FALSE') {
                        return origQ.options[ans];
                    } else if (origQ.type === 'MCQ_MULTI') {
                        const sortedIndices = [...ans].sort((a, b) => a - b);
                        return sortedIndices.map(i => origQ.options[i]);
                    }
                }
                return ans ?? null;
            });
            const res = await quizzesAPI.submitAttempt(quizId, user.id, answerArr, finalViolations, timeTaken);
            setResult(res);
            setFinished(true);
            if (auto) toast.error('Quiz auto-submitted due to violations!');
            // Exit fullscreen
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });

            // Mark the quiz lesson as complete in enrollment progress
            if (quiz.lessonId && courseId && user?.id) {
                try {
                    await enrollmentsAPI.markLessonComplete(user.id, courseId, quiz.lessonId);
                } catch { /* non-blocking */ }
            }
        } catch (err) {
            toast.error('Failed to submit: ' + err.message);
        }
    }, [questions, quizId, user.id]);

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

        let lastViolationTime = 0;
        const VIOLATION_COOLDOWN = 2000; // Prevent multiple events from double-counting

        const triggerViolation = (msg) => {
            const now = Date.now();
            if (now - lastViolationTime < VIOLATION_COOLDOWN) return;
            lastViolationTime = now;

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
            // Detect Tab with modifiers (Ctrl+Tab, Alt+Tab, Cmd+Tab)
            if ((e.key === 'Tab' || e.keyCode === 9) && (e.ctrlKey || e.altKey || e.metaKey)) {
                triggerViolation('Restricted shortcut detected!');
            }
            // Detect DevTools shortcuts
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
                triggerViolation('Developer tools access restricted!');
                e.preventDefault();
            }
            // Detect Alt+F4 or other common exit shortcuts if possible
            if (e.altKey && e.key === 'F4') {
                triggerViolation('Exit shortcut detected!');
            }
        };

        const handleMouseLeave = () => {
            // Optional: detect when mouse leaves the document (useful for multi-monitor cheating)
            // triggerViolation('Mouse left the quiz area!'); 
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFsChange);
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mouseleave', handleMouseLeave);

        // Backup integrity check (every 1.5s) to catch switches missed by events
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
            document.removeEventListener('mouseleave', handleMouseLeave);
            clearInterval(integrityInterval);
        };
    }, [started, finished, answers, submitQuiz]);

    // Anti-cheat: disable right-click, copy, paste, select
    useEffect(() => {
        if (!started || finished) return;
        const prevent = (e) => {
            e.preventDefault();
            setWarning('⚠️ Right-click, Copy, and Paste are disabled for security.');
            setTimeout(() => setWarning(null), 2000);
        };
        document.addEventListener('contextmenu', prevent);
        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('cut', prevent);
        document.addEventListener('drop', prevent);
        document.addEventListener('selectstart', prevent);
        return () => {
            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('cut', prevent);
            document.removeEventListener('drop', prevent);
            document.removeEventListener('selectstart', prevent);
        };
    }, [started, finished]);

    // Anti-cheat: prevent back button
    useEffect(() => {
        if (!started || finished) return;
        const handlePopState = (e) => {
            e.preventDefault();
            window.history.pushState(null, '', window.location.href);
            setWarning('⚠️ Back navigation is disabled during quiz.');
            setTimeout(() => setWarning(null), 3000);
        };
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [started, finished]);

    // Fullscreen helper
    const enterFullscreen = async () => {
        try {
            await containerRef.current?.requestFullscreen?.();
            setIsFullscreen(true);
        } catch { }
    };

    const startQuiz = async () => {
        await enterFullscreen();
        startTimeRef.current = Date.now();
        setStarted(true);
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
        if (questions[currentQ]?.type === 'FILL_BLANK') handleFillSubmit();
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
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // Results screen
    if (finished && result) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-10 max-w-md w-full text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${result.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {result.passed
                            ? <CheckCircle size={48} />
                            : <XCircle size={48} />}
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                        {result.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                    </h2>
                    <p className="text-slate-500 font-medium mb-8">{quiz?.title}</p>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                            <p className="text-3xl font-black text-indigo-600">{result.score}%</p>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Score</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                            <p className="text-3xl font-black text-cyan-600">{quiz?.passingScore}%</p>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Required</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                            <p className={`text-3xl font-black ${violations > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{violations}</p>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Violations</p>
                        </div>
                    </div>

                    {result.passed && (
                        <div className="bg-amber-50 rounded-xl p-4 mb-8 border border-amber-200 shadow-sm">
                            <p className="text-amber-700 font-bold mb-1">🏆 Certificate Eligible!</p>
                            <p className="text-amber-600 text-xs font-medium">Complete the course to claim your certificate</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => navigate(-1)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-3 rounded-xl text-slate-700 font-bold transition-all shadow-sm">
                            Back to Course
                        </button>
                        <button onClick={() => navigate('/student/quizzes')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl text-white font-bold shadow-sm transition-colors">
                            My Quizzes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Pre-start screen
    if (!started) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-lg w-full" ref={containerRef}>
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <Shield size={32} className="text-indigo-600" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">{quiz?.title}</h2>
                        <p className="text-slate-500 font-medium">{quiz?.instructions}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                            <p className="text-slate-900 font-black text-2xl mb-1">{quiz?.questions?.length}</p>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Questions</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                            <p className="text-slate-900 font-black text-2xl mb-1">{quiz?.timeLimit}m</p>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Time Limit</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                            <p className="text-slate-900 font-black text-2xl mb-1">{quiz?.passingScore}%</p>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pass Score</p>
                        </div>
                    </div>

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

                    <button onClick={startQuiz} className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-sm flex items-center justify-center gap-2 transition-colors">
                        <Maximize2 size={18} /> Start Quiz (Enters Fullscreen)
                    </button>
                    <button onClick={() => navigate(-1)} className="w-full mt-4 text-slate-500 hover:text-slate-800 font-medium text-sm py-2 transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Active quiz
    const q = questions[currentQ];
    const answered = answers[currentQ] !== undefined && answers[currentQ] !== null;
    const timerDanger = timeLeft < 60;
    const timerWarning = timeLeft < 180;

    return (
        <div
            ref={containerRef}
            className="min-h-screen flex flex-col select-none bg-slate-50"
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
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <Shield size={16} className="text-indigo-600" />
                    </div>
                    <span className="text-slate-900 font-bold text-[15px]">{quiz?.title}</span>
                </div>
                <div className="flex items-center gap-4">
                    {/* Violations */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                        {Array(MAX_VIOLATIONS).fill(0).map((_, i) => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < violations ? 'bg-rose-500 shadow-sm' : 'bg-slate-300'}`} />
                        ))}
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1">{violations}/{MAX_VIOLATIONS} violations</span>
                    </div>
                    {/* Timer */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[15px] font-bold shadow-inner ${timerDanger ? 'bg-rose-50 text-rose-700 border border-rose-200' : timerWarning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
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
                    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 sm:p-10">
                        <div className="flex items-center justify-between mb-8">
                            <span className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wide shadow-sm flex-shrink-0">Question {currentQ + 1} / {questions.length}</span>
                            <span className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest">{q?.type?.replace('_', ' ')}</span>
                        </div>
                        <h3 className="text-slate-900 text-2xl font-extrabold mb-8 leading-relaxed tracking-tight">
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
                                                : 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs mr-4 font-black flex-shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                                }`}>
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Fill in the blank */}
                        {q?.type === 'FILL_BLANK' && (
                            <div className="mt-4">
                                <input
                                    type="text"
                                    value={fillText || answers[currentQ] || ''}
                                    onChange={e => setFillText(e.target.value)}
                                    placeholder="Type your answer here..."
                                    className="w-full bg-slate-50 border-2 border-slate-200 outline-none text-slate-900 placeholder:text-slate-400 rounded-xl p-5 text-lg font-medium focus:border-indigo-500 focus:bg-white transition-all"
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100">
                            <button
                                onClick={handlePrev}
                                disabled={currentQ === 0}
                                className="bg-white border border-slate-200 px-6 py-3 rounded-lg text-[15px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600 flex items-center gap-2 transition-all shadow-sm"
                            >
                                <ChevronLeft size={18} /> Previous
                            </button>

                            <div className="text-[13px] font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-md border border-slate-100">
                                <span className="text-indigo-600">{Object.keys(answers).length}</span> / {questions.length} answered
                            </div>

                            {currentQ === questions.length - 1 ? (
                                <button
                                    onClick={() => submitQuiz(answers, violations)}
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
