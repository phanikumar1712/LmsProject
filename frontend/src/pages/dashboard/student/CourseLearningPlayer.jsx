import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, CheckCircle, FileText, ChevronLeft, ChevronRight, Menu, X, HelpCircle } from 'lucide-react';
import { coursesAPI, enrollmentsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

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

    useEffect(() => {
        if (!user) return;
        Promise.all([
            coursesAPI.getById(courseId),
            coursesAPI.getLessons(courseId),
            enrollmentsAPI.getByStudent(user.id)
        ]).then(([c, { sections: s, lessons: l }, enrolls]) => {
            setCourse(c);
            setSections(s);
            setLessons(l);
            const e = enrolls.find(en => en.courseId === courseId);
            setEnrollment(e);

            // Set first uncompleted lesson as active, or just first lesson
            if (l.length > 0) {
                const nextUncompleted = l.find(lsn => !e?.completedLessons?.includes(lsn.id));
                setActiveLesson(nextUncompleted || l[0]);
            }
        }).catch(err => {
            toast.error('Failed to load course content');
            navigate('/student/courses');
        }).finally(() => setLoading(false));
    }, [courseId, user, navigate]);

    const handleLessonComplete = async () => {
        if (!activeLesson || !enrollment) return;
        try {
            const updated = await enrollmentsAPI.markLessonComplete(user.id, courseId, activeLesson.id);
            setEnrollment(updated);
            toast.success('Lesson marked as complete! 🎉');

            // Move to next lesson if available
            const currentIndex = lessons.findIndex(l => l.id === activeLesson.id);
            if (currentIndex < lessons.length - 1) {
                setActiveLesson(lessons[currentIndex + 1]);
            } else if (updated.progress === 100) {
                toast.success('Congratulations! You completed the course! 🏆', { duration: 5000 });
            }
        } catch (err) {
            toast.error(err.message || 'Failed to update progress');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading player...</div>;
    if (!course) return <div className="min-h-screen flex items-center justify-center text-slate-500">Course not found</div>;

    const isCompleted = (lessonId) => enrollment?.completedLessons?.includes(lessonId);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-200">
            {/* Header */}
            <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/student/courses')} className="text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="font-bold text-white text-sm md:text-base truncate max-w-xs md:max-w-md">{course.title}</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${enrollment?.progress || 0}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-400">{enrollment?.progress || 0}%</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 flex flex-col relative">
                    {/* Video Player Area */}
                    <div className="w-full bg-black aspect-video flex-shrink-0 flex items-center justify-center relative shadow-xl">
                        {activeLesson?.type === 'video' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Play size={64} className="text-white/20 mb-4" />
                                <p className="text-slate-400 text-sm font-medium">Video Player Placeholder</p>
                                <p className="text-slate-500 text-xs mt-2">{activeLesson.title}</p>
                            </div>
                        ) : activeLesson?.type === 'quiz' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 border-b border-indigo-500/30">
                                <HelpCircle size={48} className="text-indigo-400 mb-4" />
                                <h3 className="text-2xl font-bold text-white mb-2">{activeLesson?.title}</h3>
                                <p className="text-indigo-200 text-sm mb-6">Test your knowledge on this module. Complete the quiz to proceed.</p>
                                <button
                                    onClick={() => navigate(`/courses/${courseId}/quiz/${activeLesson.id}`)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-lg"
                                >
                                    Start Assessment
                                </button>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
                                <FileText size={48} className="text-slate-500 mb-4" />
                                <p className="text-slate-300 font-bold">{activeLesson?.title}</p>
                                <p className="text-slate-400 text-sm mt-2">Read the attached document to complete this lesson.</p>
                            </div>
                        )}
                        <button
                            onClick={() => setSidebarOpen(o => !o)}
                            className="absolute right-4 top-4 bg-slate-900/80 p-2 rounded-lg text-white hover:bg-slate-800 transition-colors lg:hidden z-10"
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    {/* Lesson Details */}
                    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-900">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{activeLesson?.title}</h2>
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <span className="bg-slate-800 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">{activeLesson?.type}</span>
                                        <span>{activeLesson?.duration}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLessonComplete}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors ${isCompleted(activeLesson?.id)
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        }`}
                                >
                                    <CheckCircle size={16} />
                                    {isCompleted(activeLesson?.id) ? 'Completed' : 'Mark as Complete'}
                                </button>
                            </div>

                            <div className="prose prose-invert max-w-none prose-slate">
                                <p className="text-slate-300 leading-relaxed text-[15px]">
                                    {activeLesson?.description || "In this lesson, we will cover the fundamental concepts shown in the video. Make sure to take notes and pay attention to the key takeaways."}
                                </p>
                            </div>

                            {/* Prev / Next navigation */}
                            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
                                <button
                                    onClick={() => {
                                        const idx = lessons.findIndex(l => l.id === activeLesson?.id);
                                        if (idx > 0) setActiveLesson(lessons[idx - 1]);
                                    }}
                                    disabled={lessons.findIndex(l => l.id === activeLesson?.id) === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={16} /> Previous Lesson
                                </button>
                                <button
                                    onClick={() => {
                                        const idx = lessons.findIndex(l => l.id === activeLesson?.id);
                                        if (idx < lessons.length - 1) setActiveLesson(lessons[idx + 1]);
                                    }}
                                    disabled={lessons.findIndex(l => l.id === activeLesson?.id) === lessons.length - 1}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next Lesson <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                {sidebarOpen && (
                    <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col flex-shrink-0 absolute inset-y-0 right-0 lg:relative z-20 transition-transform shadow-2xl lg:shadow-none">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-white">Course Content</h3>
                            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {sections.map((section, idx) => {
                                const sectionLessons = lessons.filter(l => l.sectionId === section.id);
                                return (
                                    <div key={section.id} className="border-b border-slate-800/50">
                                        <div className="p-4 bg-slate-950/50">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Section {idx + 1}</p>
                                            <h4 className="font-bold text-slate-200 text-[14px] leading-tight">{section.title}</h4>
                                        </div>
                                        <div className="divide-y divide-slate-800/50">
                                            {sectionLessons.map((lesson, lIdx) => {
                                                const isActive = activeLesson?.id === lesson.id;
                                                const completed = isCompleted(lesson.id);
                                                return (
                                                    <button
                                                        key={lesson.id}
                                                        onClick={() => setActiveLesson(lesson)}
                                                        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${isActive ? 'bg-indigo-600/10' : 'hover:bg-slate-900'
                                                            }`}
                                                    >
                                                        <div className="mt-0.5">
                                                            {completed ? (
                                                                <CheckCircle size={16} className="text-emerald-500" />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className={`text-[13px] font-medium leading-snug mb-1 ${isActive ? 'text-indigo-400' : 'text-slate-300'}`}>
                                                                {idx + 1}.{lIdx + 1} {lesson.title}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                                                                {lesson.type === 'video' ? <Play size={10} /> : lesson.type === 'quiz' ? <HelpCircle size={10} /> : <FileText size={10} />}
                                                                {lesson.duration}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
