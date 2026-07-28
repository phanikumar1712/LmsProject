import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Play, CheckCircle, FileText, ChevronLeft, ChevronRight, Menu, X,
    HelpCircle, BookOpen, Trophy, Clock, Loader2, Lock, GitBranch, Sparkles
} from 'lucide-react';
import { coursesAPI, enrollmentsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { RatingStars } from '../../../components/ui/RatingStars';
import { ratingsAPI } from '../../../services/api';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ReactPlayer = lazy(() => import('react-player'));

// ── YouTube URL parser ─────────────────────────────────────────────────────────
function getYouTubeEmbedUrl(url) {
    if (!url) return null;
    if (url.includes('/embed/')) return url;
    let videoId = '';
    try {
        if (url.includes('youtube.com/watch?v=')) {
            videoId = new URL(url).searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/shorts/')) {
            videoId = url.split('shorts/')[1].split('?')[0];
        } else if (/^[a-zA-Z0-9_-]{11}$/.test(url.split('?')[0])) {
            videoId = url.split('?')[0];
        }
    } catch { /* noop */ }
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0` : null;
}

// ── Progress Ring component ────────────────────────────────────────────────────
function ProgressRing({ progress, size = 36, stroke = 3 }) {
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (progress / 100) * circ;
    return (
        <svg width={size} height={size} className="rotate-[-90deg]">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#334155" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={progress === 100 ? '#22c55e' : '#6366f1'}
                strokeWidth={stroke}
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
            />
        </svg>
    );
}

export default function CourseLearningPlayer() {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [course, setCourse] = useState(null);
    const [sections, setSections] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [enrollment, setEnrollment] = useState(null);
    const [activeLesson, setActiveLesson] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [myRating, setMyRating] = useState({ stars: 0, comment: '' });
    const [submittingRating, setSubmittingRating] = useState(false);
    const [dripStatus, setDripStatus] = useState([]);
    const [dripMode, setDripMode] = useState('none');
    const [versions, setVersions] = useState([]);
    const [showChangelog, setShowChangelog] = useState(false);

    // Build a map of lessonId -> drip info
    const dripMap = {};
    dripStatus.forEach(d => { dripMap[d.lessonId] = d; });

    const isLessonUnlocked = useCallback((lessonId) => {
        const drip = dripMap[lessonId];
        return !drip || drip.unlocked !== false;
    }, [dripMap]);

    const getDripReason = useCallback((lessonId) => {
        const drip = dripMap[lessonId];
        return drip?.reason || null;
    }, [dripMap]);

    // Compute whether a newer version exists
    const latestVersion = versions.length > 0 ? versions[0] : null;
    const enrolledVersionId = enrollment?.versionId || null;
    const hasNewerVersion = latestVersion && enrolledVersionId && latestVersion.id !== enrolledVersionId;

    useEffect(() => {
        if (!user) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        Promise.all([
            coursesAPI.getById(courseId),
            coursesAPI.getLessons(courseId),
            enrollmentsAPI.getByStudent(user.id)
        ]).then(([c, { sections: s, lessons: l }, enrolls]) => {
            setCourse(c);
            setSections(s || []);
            setLessons(l || []);
            const e = enrolls.find(en => en.courseId === courseId);
            setEnrollment(e || null);

            // Fetch version history if enrolled
            if (e) {
                Promise.all([
                    coursesAPI.getVersions(courseId),
                    coursesAPI.getDripStatus(courseId),
                ]).then(([versionData, dripData]) => {
                    setVersions(versionData || []);
                    setDripStatus(dripData.dripStatus || []);
                    setDripMode(dripData.dripMode || 'none');
                }).catch(() => {});
            }

            if (l.length > 0) {
                // Resume: find first lesson not yet completed AND unlocked
                const completedSet = new Set(e?.completedLessons || []);
                const next = l.find(lsn => !completedSet.has(lsn.id));
                setActiveLesson(next || l[0]);
            }
        }).catch(() => {
            toast.error('Failed to load course content');
            navigate('/student/courses');
        }).finally(() => setLoading(false));
    }, [courseId, user, navigate]);

    useEffect(() => {
        if (user && courseId) {
            ratingsAPI.getMyRating(courseId).then(r => {
                if (r) setMyRating({ stars: r.stars, comment: r.comment || '' });
            }).catch(() => { });
        }
    }, [courseId, user]);

    const handleSubmitRating = async () => {
        if (!myRating.stars) { toast.error('Please select a star rating'); return; }
        setSubmittingRating(true);
        try {
            await ratingsAPI.create(courseId, user.id, myRating.stars, myRating.comment);
            toast.success('Thank you for your feedback! ⭐');
            setShowReviewModal(false);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmittingRating(false);
        }
    };

    const isCompleted = useCallback((lessonId) => {
        return enrollment?.completedLessons?.includes(lessonId) ?? false;
    }, [enrollment]);

    const handleLessonSelect = (lesson) => {
        if (!isLessonUnlocked(lesson.id)) {
            toast.error(dripMap[lesson.id]?.reason || 'This lesson is not yet available');
            return;
        }
        setActiveLesson(lesson);
    };

    const handleMarkComplete = async () => {
        if (!activeLesson || !enrollment || marking) return;
        if (!isLessonUnlocked(activeLesson.id)) {
            toast.error('This lesson is locked by the release schedule');
            return;
        }
        if (isCompleted(activeLesson.id)) {
            goToNext();
            return;
        }
        setMarking(true);
        try {
            const updated = await enrollmentsAPI.markLessonComplete(user.id, courseId, activeLesson.id);
            setEnrollment(updated);
            toast.success('Lesson completed! 🎉');

            if (updated.progress >= 100) {
                toast.success('🏆 Course 100% complete! Congratulations!', { duration: 5000 });
            } else {
                goToNext(updated);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to save progress');
        } finally {
            setMarking(false);
        }
    };

    const goToNext = () => {
        const currentIndex = lessons.findIndex(l => l.id === activeLesson.id);
        if (currentIndex < lessons.length - 1) {
            setActiveLesson(lessons[currentIndex + 1]);
        }
    };

    const goToPrev = () => {
        const currentIndex = lessons.findIndex(l => l.id === activeLesson.id);
        if (currentIndex > 0) setActiveLesson(lessons[currentIndex - 1]);
    };

    const progress = enrollment?.progress ?? 0;
    const completedCount = enrollment?.completedLessons?.length ?? 0;
    const embedUrl = activeLesson?.type === 'video' ? getYouTubeEmbedUrl(activeLesson.contentUrl) : null;
    const currentIndex = lessons.findIndex(l => l.id === activeLesson?.id);
    const alreadyCompleted = isCompleted(activeLesson?.id);

    if (loading) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground/60 text-sm font-medium">Loading your course...</p>
            </div>
        </div>
    );

    // Check if active lesson is locked
    const activeLocked = activeLesson && !isLessonUnlocked(activeLesson.id);
    if (!course) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
            <p className="text-muted-foreground">Course not found</p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-200 font-['Inter',sans-serif]">

            {/* ── Header bar ───────────────────────────────────────── */}
            <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => navigate('/student/courses')}
                        className="text-muted-foreground/60 hover:text-white transition-colors flex-shrink-0"
                        title="Back to my courses"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-sm font-semibold text-white truncate hidden sm:block">{course.title}</h1>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs text-muted-foreground/60 font-medium leading-tight">
                            {completedCount}/{lessons.length} lessons
                        </span>
                        <span className={`text-xs font-bold leading-tight ${progress === 100 ? 'text-green-400' : 'text-indigo-400'}`}>
                            {progress}% complete
                        </span>
                    </div>
                    <div className="relative flex items-center justify-center">
                        <ProgressRing progress={progress} size={38} stroke={3} />
                        <span className="absolute text-[9px] font-bold text-white">{progress}%</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="text-muted-foreground/60 hover:text-white transition-colors lg:hidden flex-shrink-0"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    {/* "What's New" badge */}
                    {hasNewerVersion && latestVersion && (
                        <button
                            onClick={() => setShowChangelog(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 transition-colors border border-emerald-500/20 animate-pulse"
                            title="A new version of this course is available"
                        >
                            <Sparkles size={14} />
                            <span className="hidden xs:inline">What's New?</span>
                        </button>
                    )}

                    <button
                        onClick={() => setShowReviewModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 transition-colors border border-amber-400/20"
                    >
                        <Star size={14} fill="currentColor" />
                        <span className="hidden xs:block">Rate Course</span>
                    </button>
                </div>
            </header>

            {/* ── Main content ─────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* ── Video / Content Area ───────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                    {/* Media pane */}
                    <div className="relative flex-1 bg-black overflow-hidden">
                        {!activeLesson ? (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                <BookOpen size={48} />
                            </div>
                        ) : activeLocked ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                                <div className="bg-slate-800/60 backdrop-blur-xl p-10 rounded-3xl border border-amber-500/20 shadow-2xl max-w-md w-full">
                                    <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                        <Lock size={40} className="text-amber-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Lesson Locked 🔒</h3>
                                    <p className="text-muted-foreground/60 text-sm mb-4">
                                        {getDripReason(activeLesson.id)}
                                    </p>
                                    {dripMode === 'relative' && (
                                        <p className="text-xs text-amber-400/80">Content is released on a schedule. Check back later!</p>
                                    )}
                                    {dripMode === 'absolute' && (
                                        <p className="text-xs text-amber-400/80">Lessons unlock on their scheduled release dates.</p>
                                    )}
                                </div>
                            </div>
                        ) : activeLesson.type === 'video' ? (
                            <div className="absolute inset-0">
                                {embedUrl ? (
                                    <iframe
                                        key={embedUrl}
                                        src={embedUrl}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={activeLesson.title}
                                    />
                                ) : (
                                    <Suspense fallback={
                                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                            <Loader2 size={40} className="text-indigo-400 animate-spin" />
                                        </div>
                                    }>
                                        <ReactPlayer
                                            url={activeLesson.contentUrl}
                                            width="100%" height="100%"
                                            controls playing={false} playsinline
                                            onError={() => toast.error('Error loading video')}
                                        />
                                    </Suspense>
                                )}
                            </div>
                        ) : activeLesson.type === 'quiz' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                                <div className="bg-slate-800/60 backdrop-blur-xl p-10 rounded-3xl border border-indigo-500/20 shadow-2xl max-w-md w-full">
                                    <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                        <HelpCircle size={40} className="text-indigo-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">{activeLesson.title}</h3>
                                    <p className="text-muted-foreground/60 text-sm mb-8">Test your knowledge. Complete the quiz to mark this lesson as done.</p>
                                    <button
                                        onClick={() => navigate(`/courses/${courseId}/quiz/${activeLesson.id}`)}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg"
                                    >
                                        Start Assessment →
                                    </button>
                                    {alreadyCompleted && (
                                        <p className="mt-4 text-green-400 text-sm font-semibold flex items-center justify-center gap-2">
                                            <CheckCircle size={16} /> Quiz already completed
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Document lesson */
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                                <div className="bg-slate-800/60 backdrop-blur-xl p-10 rounded-3xl border border-emerald-500/20 shadow-2xl max-w-md w-full">
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                        <FileText size={40} className="text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">{activeLesson.title}</h3>
                                    <p className="text-muted-foreground/60 text-xs uppercase tracking-widest font-bold mb-8">Document Resource</p>
                                    {activeLesson.contentUrl ? (
                                        <a
                                            href={activeLesson.contentUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg mb-4"
                                        >
                                            View Resource <ChevronRight size={18} />
                                        </a>
                                    ) : (
                                        <p className="text-muted-foreground text-sm mb-4 bg-slate-800 py-3 rounded-xl border border-slate-700">No link provided.</p>
                                    )}
                                    <p className="text-muted-foreground text-xs">After viewing, click "Mark as Complete" below.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Bottom action bar ──────────────────────────── */}
                    <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
                        <button
                            onClick={goToPrev}
                            disabled={currentIndex <= 0}
                            className="flex items-center gap-2 text-muted-foreground/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>

                        <div className="flex-1 flex flex-col items-center gap-1">
                            {activeLesson && activeLesson.type !== 'quiz' && (
                                <button
                                    onClick={handleMarkComplete}
                                    disabled={marking}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-lg
                                        ${alreadyCompleted
                                            ? 'bg-green-600/20 text-green-400 border border-green-500/30 cursor-default'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95'
                                        }
                                    `}
                                >
                                    {marking ? (
                                        <Loader2 size={15} className="animate-spin" />
                                    ) : alreadyCompleted ? (
                                        <CheckCircle size={15} />
                                    ) : (
                                        <CheckCircle size={15} />
                                    )}
                                    {marking ? 'Saving...' : alreadyCompleted ? 'Completed ✓' : 'Mark as Complete'}
                                </button>
                            )}
                            <span className="text-xs text-muted-foreground hidden sm:block">
                                Lesson {currentIndex + 1} of {lessons.length}
                            </span>
                        </div>

                        <button
                            onClick={() => goToNext()}
                            disabled={currentIndex >= lessons.length - 1}
                            className="flex items-center gap-2 text-muted-foreground/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* ── Sidebar (Curriculum) ────────────────────────── */}
                <div className={`
                    flex-shrink-0 flex flex-col bg-slate-950 border-l border-slate-800 overflow-hidden transition-all duration-300
                    ${sidebarOpen ? 'w-80' : 'w-0'}
                    lg:w-80 absolute lg:relative inset-y-0 right-0 z-20 lg:z-auto
                `}>
                    {/* Sidebar header */}
                    <div className="p-4 border-b border-slate-800 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-white">Course Content</h2>
                            <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-white lg:hidden">
                                <X size={16} />
                            </button>
                        </div>
                        {/* Progress bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground/60">
                                <span>{completedCount}/{lessons.length} completed</span>
                                <span className={progress === 100 ? 'text-green-400 font-bold' : 'text-indigo-400 font-bold'}>{progress}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Lesson list */}
                    <div className="flex-1 overflow-y-auto py-2">
                        {sections.map((section) => {
                            const sectionLessons = lessons.filter(l => l.section_id === section.id);
                            const sectionCompleted = sectionLessons.filter(l => isCompleted(l.id)).length;
                            return (
                                <div key={section.id} className="mb-1">
                                    {/* Section header */}
                                    <div className="px-4 py-2 flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider truncate">{section.title}</h3>
                                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{sectionCompleted}/{sectionLessons.length}</span>
                                    </div>
                                    {/* Lessons */}
                                    {sectionLessons.map((lesson) => {
                                        const done = isCompleted(lesson.id);
                                        const active = lesson.id === activeLesson?.id;
                                        const unlocked = isLessonUnlocked(lesson.id);
                                        const dripReason = getDripReason(lesson.id);
                                        return (
                                            <button
                                                key={lesson.id}
                                                onClick={() => unlocked ? handleLessonSelect(lesson) : toast.error(dripReason || 'This lesson is not yet available')}
                                                disabled={!unlocked}
                                                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-l-2
                                                    ${active && unlocked
                                                        ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                                        : unlocked
                                                            ? 'border-transparent hover:bg-slate-800/50 text-muted-foreground/60 hover:text-slate-200'
                                                            : 'border-transparent text-muted-foreground/30 opacity-60 cursor-not-allowed'
                                                    }
                                                `}
                                            >
                                                {/* Status icon */}
                                                <span className="flex-shrink-0 mt-0.5">
                                                    {!unlocked ? (
                                                        <Lock size={16} className="text-amber-500/60" />
                                                    ) : done ? (
                                                        <CheckCircle size={16} className="text-green-500" />
                                                    ) : lesson.type === 'quiz' ? (
                                                        <HelpCircle size={16} className={active ? 'text-indigo-400' : 'text-muted-foreground'} />
                                                    ) : lesson.type === 'document' ? (
                                                        <FileText size={16} className={active ? 'text-indigo-400' : 'text-muted-foreground'} />
                                                    ) : (
                                                        <Play size={16} className={active ? 'text-indigo-400' : 'text-muted-foreground'} />
                                                    )}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-semibold leading-tight truncate ${active && unlocked ? 'text-white' : ''}`}>
                                                        {lesson.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {!unlocked && dripReason ? (
                                                            <span className="text-[10px] text-amber-500/70 font-medium">{dripReason}</span>
                                                        ) : (
                                                            <>
                                                                <span className="text-[10px] text-muted-foreground capitalize">{lesson.type}</span>
                                                                {lesson.duration && (
                                                                    <>
                                                                        <span className="text-foreground/80">·</span>
                                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                            <Clock size={9} /> {lesson.duration}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                {done && <span className="text-[10px] text-green-500 font-bold">Done</span>}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* Trophy on 100% */}
                    {progress === 100 && (
                        <div className="border-t border-slate-800 p-4 bg-green-500/5 text-center">
                            <Trophy size={24} className="text-yellow-400 mx-auto mb-1" />
                            <p className="text-xs font-bold text-green-400">Course Complete!</p>
                        </div>
                    )}
                </div>
            </div>
            {/* ── What's New / Changelog Modal ──────────────────── */}
            <AnimatePresence>
                {showChangelog && latestVersion && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowChangelog(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 max-w-lg w-full relative z-10 max-h-[80vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                                        <Sparkles size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">What's New</h3>
                                        <p className="text-xs text-muted-foreground/60">
                                            {latestVersion.version_label || `Version ${latestVersion.version_number}`} — {new Date(latestVersion.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowChangelog(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                                    <X size={18} className="text-muted-foreground/60" />
                                </button>
                            </div>

                            {/* Version history list */}
                            <div className="space-y-4">
                                {versions.map((v, idx) => (
                                    <div key={v.id} className={`p-4 rounded-2xl border ${idx === 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/30 border-slate-700/50'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <GitBranch size={14} className={idx === 0 ? 'text-emerald-400' : 'text-muted-foreground/60'} />
                                            <span className={`text-xs font-bold ${idx === 0 ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                                                {v.version_label || `v${v.version_number}`}
                                            </span>
                                            {idx === 0 && (
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Latest</span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground/40 ml-auto">
                                                {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        {v.changelog ? (
                                            <div className="text-sm text-muted-foreground/80 whitespace-pre-wrap leading-relaxed pl-6">
                                                {v.changelog}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground/40 italic pl-6">No release notes</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-800">
                                <p className="text-xs text-muted-foreground/60">
                                    You are viewing content from your enrolled version. The latest version has updates you haven't seen yet.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Review Modal ─────────────────────────────────────── */}
            <AnimatePresence>
                {showReviewModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowReviewModal(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full relative z-10"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">How's the course?</h3>
                            <p className="text-muted-foreground/60 text-sm mb-6">Your feedback helps us and other students.</p>

                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 block">Your Rating</label>
                                <RatingStars
                                    rating={myRating.stars}
                                    size={32}
                                    interactive
                                    onRate={s => setMyRating(r => ({ ...r, stars: s }))}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 block">Your Review</label>
                                <textarea
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-32 transition-all"
                                    placeholder="What did you like or dislike?"
                                    value={myRating.comment}
                                    onChange={e => setMyRating(r => ({ ...r, comment: e.target.value }))}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleSubmitRating}
                                    disabled={submittingRating || !myRating.stars}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all"
                                >
                                    {submittingRating ? 'Submitting...' : 'Submit Review'}
                                </button>
                                <button
                                    onClick={() => setShowReviewModal(false)}
                                    className="px-6 py-3 text-muted-foreground/60 font-bold hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
