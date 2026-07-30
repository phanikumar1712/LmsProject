import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
    BookOpen, Clock, Users, Star, Award, Play, CheckCircle, Lock, ChevronDown,
    ChevronUp, ArrowLeft, FileText, ShoppingCart, Heart, Unlock, HelpCircle
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { coursesAPI, enrollmentsAPI, ratingsAPI, wishlistAPI, quizzesAPI } from '../services/api';
import { getYouTubeEmbedUrl } from '../lib/video';
import DiscussionSection from '../components/ui/DiscussionSection';
import { useAuth } from '../contexts/AuthContext';
import { RatingDisplay, RatingStars } from '../components/ui/RatingStars';
import { ProgressBar } from '../components/ui/ProgressBar';
import toast from 'react-hot-toast';


export default function CourseDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [searchParams] = useSearchParams();

    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [sections, setSections] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [enrollment, setEnrollment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ 0: true });
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
    const [quizzes, setQuizzes] = useState([]);
    const [quizzesLoading, setQuizzesLoading] = useState(false);
    const [expandedQuiz, setExpandedQuiz] = useState(null);
    const [myRating, setMyRating] = useState({ stars: 0, comment: '' });
    const [submittingRating, setSubmittingRating] = useState(false);
    const [editingRating, setEditingRating] = useState(false);
    const [wishlisted, setWishlisted] = useState(false);
    const [previewVideo, setPreviewVideo] = useState(null);

    useEffect(() => {
        Promise.all([
            coursesAPI.getById(id),
            coursesAPI.getLessons(id),
            ratingsAPI.getByCourse(id),
        ]).then(([c, { lessons: ls, sections: ss }, rs]) => {
            setCourse(c);
            setLessons(ls || []);
            setSections(ss || []);
            setRatings(rs || []);
            if (user) setWishlisted(user.wishlist?.includes(id) || false);

            // Find first preview lesson
            const firstPreview = (ls || []).find(l => l.preview && l.type === 'video');
            if (firstPreview) setPreviewVideo(firstPreview);
        }).catch(err => {
            toast.error('Failed to load course details');
            console.error(err);
        }).finally(() => setLoading(false));

        if (user?.role === 'STUDENT') {
            enrollmentsAPI.getByStudent(user.id).then(enrolls => {
                const e = enrolls.find(e => e.courseId === id);
                if (e) setEnrollment(e);
            });
            // Load existing rating for this student
            ratingsAPI.getMyRating(id)
                .then(existing => {
                    if (existing) {
                        setMyRating({ stars: existing.stars, comment: existing.comment || '' });
                    }
                })
                .catch(() => { });
        }
    }, [id, user]);

    const isAdminPreview = user?.role === 'SUPER_ADMIN' || (
        user?.role === 'ADMIN' && (!user.departmentId || course?.departmentId === user.departmentId)
    );
    // The course's own instructor gets the same full-preview treatment as admins
    const isOwnerInstructor = user?.role === 'INSTRUCTOR' && course?.instructorId === user?.id;
    const canFullPreview = isAdminPreview || isOwnerInstructor;

    // Admins reviewing a course can inspect its quizzes (questions + answers)
    useEffect(() => {
        if (!isAdminPreview) return;
        setQuizzesLoading(true);
        quizzesAPI.getByCourse(id)
            .then(qs => setQuizzes(qs || []))
            .catch(() => setQuizzes([]))
            .finally(() => setQuizzesLoading(false));
    }, [id, isAdminPreview]);

    const isEnrolled = user?.role === 'STUDENT' && !!enrollment;
    const existingRating = Array.isArray(ratings) ? ratings.find(r => r.studentId === user?.id) : null;
    const hasRated = !!existingRating;

    const handleEnroll = async () => {
        if (!user) { navigate('/login'); return; }
        setEnrolling(true);
        try {
            const e = await enrollmentsAPI.enroll(user.id, id);
            setEnrollment(e);
            toast.success('Successfully enrolled! 🎉');
        } catch (err) {
            toast.error(err.message);
        } finally { setEnrolling(false); }
    };

    const handleWishlist = async () => {
        if (isAdminPreview) { toast('Wishlist is available for student accounts'); return; }
        if (!user) { navigate('/login'); return; }
        const newWishlist = await wishlistAPI.toggle(user.id, id);
        setWishlisted(newWishlist.includes(id));
        updateUser({ wishlist: newWishlist });
        toast.success(wishlisted ? 'Removed from wishlist' : 'Saved to wishlist ❤️');
    };

    const handleSubmitRating = async () => {
        if (!myRating.stars) { toast.error('Please select a star rating'); return; }
        setSubmittingRating(true);
        try {
            const r = await ratingsAPI.create(id, user.id, myRating.stars, myRating.comment);
            // Update ratings list: replace if existing, prepend if new
            setRatings(prev => {
                const filtered = prev.filter(x => x.studentId !== user.id);
                return [r, ...filtered];
            });
            setEditingRating(false);
            toast.success(hasRated ? 'Review updated! ⭐' : 'Review submitted! ⭐');
        } catch (err) {
            toast.error(err.message);
        } finally { setSubmittingRating(false); }
    };

    const getLessonsForSection = (sectionId) => lessons.filter(l => l.sectionId === sectionId);

    const ratingDist = [5, 4, 3, 2, 1].map(s => {
        const items = Array.isArray(ratings) ? ratings.filter(r => r.stars === s) : [];
        return {
            stars: s,
            count: items.length,
            pct: (Array.isArray(ratings) && ratings.length > 0) ? Math.round(items.length / ratings.length * 100) : 0,
        };
    });

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
                        <div className="h-8 w-3/4 bg-muted rounded-lg animate-pulse" />
                        <div className="h-4 w-full bg-muted rounded-lg animate-pulse" />
                    </div>
                    <div className="h-80 bg-muted rounded-2xl animate-pulse" />
                </div>
            </div>
        );
    }

    if (!course) return <div className="text-center py-20 text-muted-foreground font-medium">Course not found</div>;

    const LEVEL_COLORS = {
        Beginner: 'bg-emerald-100 text-emerald-800',
        Intermediate: 'bg-amber-100 text-amber-800',
        Advanced: 'bg-rose-100 text-rose-800',
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 bg-background min-h-screen">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm font-medium transition-colors">
                <ArrowLeft size={16} /> Back to courses
            </button>

            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
                {/* Left - Course info */}
                <div className="lg:col-span-2">
                    {/* Hero image */}
                    <div className="relative rounded-2xl overflow-hidden mb-8 h-[300px] md:h-[400px] shadow-sm border border-border">
                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent" />
                        <div className="absolute bottom-6 left-6">
                            <div className="flex gap-2 flex-wrap mb-3">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide shadow-sm ${LEVEL_COLORS[course.level] || 'bg-indigo-100 text-indigo-800'}`}>{course.level}</span>
                                {course.departmentName && (
                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide shadow-sm">
                                        {course.departmentName}
                                    </span>
                                )}
                                {course.certificate && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide shadow-sm">🏆 Certificate</span>}
                            </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <button
                                onClick={() => {
                                    if (previewVideo) {
                                        setActiveTab('preview');
                                        document.getElementById('tabs-section')?.scrollIntoView({ behavior: 'smooth' });
                                    } else {
                                        toast.info('No preview video available for this course');
                                    }
                                }}
                                className="w-16 h-16 rounded-full bg-card/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:scale-105 transition-transform group"
                            >
                                <Play size={28} className="text-indigo-600 ml-1 group-hover:scale-110 transition-transform" fill="currentColor" />
                            </button>
                        </div>
                    </div>

                    {/* Title & meta */}
                    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4 leading-tight tracking-tight">{course.title}</h1>
                    <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted-foreground font-medium pb-6 border-b border-border">
                        <RatingDisplay rating={course.rating} count={course.reviewCount} />
                        <span className="flex items-center gap-1.5"><Users size={16} className="text-muted-foreground/60" /> {course.enrollmentCount?.toLocaleString()} students</span>
                        <span className="flex items-center gap-1.5"><Clock size={16} className="text-muted-foreground/60" /> {course.duration}</span>
                        <span className="flex items-center gap-1.5"><BookOpen size={16} className="text-muted-foreground/60" /> {course.lessonsCount} lessons</span>
                    </div>

                    {/* Instructor */}
                    <div className="flex items-center gap-4 mb-8">
                        <Link to={`/instructor/${course.instructorId}`} className="flex items-center gap-4 group">
                            <img src={course.instructorAvatar} alt={course.instructorName} className="w-14 h-14 rounded-full shadow-sm border border-border object-cover group-hover:scale-105 transition-transform" />
                            <div>
                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-0.5 group-hover:text-indigo-600">Instructor</p>
                                <p className="text-foreground font-bold text-lg group-hover:text-indigo-600 transition-colors">{course.instructorName}</p>
                            </div>
                        </Link>
                    </div>

                    {/* Tabs */}
                    <div id="tabs-section" className="flex gap-2 mb-8 border-b border-border overflow-x-auto no-scrollbar">
                        {['overview', 'curriculum', 'preview', 'reviews', 'discuss', ...(isAdminPreview ? ['quizzes'] : [])].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-5 py-3 text-sm font-semibold capitalize whitespace-nowrap transition-all border-b-2 -mb-[1px] ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="min-h-[300px]">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-4">About this course</h3>
                                    <p className="text-muted-foreground leading-relaxed text-[15px]">{course.description}</p>
                                </div>
                                <div className="bg-card p-6 rounded-xl border border-border">
                                    <h3 className="text-lg font-bold text-foreground mb-4">What you'll learn</h3>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {course.learningOutcomes?.map((item, i) => (
                                            <div key={i} className="flex items-start gap-3 text-[15px] text-muted-foreground font-medium">
                                                <CheckCircle size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {course.prerequisites?.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground mb-4">Prerequisites</h3>
                                        <ul className="space-y-2">
                                            {course.prerequisites.map((p, i) => (
                                                <li key={i} className="text-muted-foreground text-[15px] flex items-center gap-3">
                                                    <span className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full" /> {p}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {course.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {course.tags.map(tag => (
                                            <span key={tag} className="bg-muted text-foreground/80 px-3 py-1 rounded-full text-xs font-semibold">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'curriculum' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {sections.length === 0 && lessons.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8 font-medium">Curriculum details not available for preview</p>
                                ) : (
                                    sections.map((section, idx) => {
                                        const sectionLessons = getLessonsForSection(section.id);
                                        const isExpanded = expandedSections[section.id] ?? (idx === 0);
                                        return (
                                            <div key={section.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                                                <button
                                                    onClick={() => setExpandedSections(e => ({ ...e, [section.id]: !isExpanded }))}
                                                    className="w-full flex items-center justify-between p-5 bg-muted/20 hover:bg-muted/40 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-foreground font-bold text-[15px]">{section.title}</span>
                                                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">{sectionLessons.length} lessons</span>
                                                    </div>
                                                    {isExpanded ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                                                </button>
                                                {isExpanded && (
                                                    <div className="border-t border-border divide-y divide-border">
                                                        {sectionLessons.map(lesson => (
                                                            <div
                                                                key={lesson.id}
                                                                onClick={() => {
                                                                    if (isEnrolled) {
                                                                        navigate(`/courses/${id}/learn`, { state: { lessonId: lesson.id } });
                                                                    } else if (canFullPreview) {
                                                                        if (lesson.type === 'video' && lesson.contentUrl) {
                                                                            setActiveTab('preview');
                                                                            setPreviewVideo(lesson);
                                                                        } else {
                                                                            toast('Only video lessons can be previewed here');
                                                                        }
                                                                    } else if (lesson.preview) {
                                                                        setActiveTab('preview');
                                                                        setPreviewVideo(lesson);
                                                                    } else {
                                                                        toast.error('Enroll to access this lesson');
                                                                    }
                                                                }}
                                                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                                                            >
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${lesson.type === 'video' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100'}`}>
                                                                    {lesson.type === 'video'
                                                                        ? <Play size={14} className="ml-0.5" fill="currentColor" />
                                                                        : <FileText size={14} />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[14px] font-medium text-muted-foreground group-hover:text-indigo-600 transition-colors truncate">{lesson.title}</p>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {lesson.preview && !isEnrolled && !isAdminPreview && (
                                                                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Preview</span>
                                                                    )}
                                                                    {isAdminPreview && (
                                                                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Admin Preview</span>
                                                                    )}
                                                                    <span className="text-xs font-medium text-muted-foreground/60">{lesson.duration}</span>
                                                                    {!isEnrolled && !isAdminPreview && !lesson.preview && <Lock size={14} className="text-muted-foreground/30" />}
                                                                    {enrollment?.completedLessons?.includes(lesson.id) && (
                                                                        <CheckCircle size={16} className="text-emerald-500" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {activeTab === 'preview' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {previewVideo ? (
                                    <div className="space-y-6">
                                        <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
                                            {getYouTubeEmbedUrl(previewVideo.contentUrl) ? (
                                                <iframe
                                                    key={previewVideo.id}
                                                    src={getYouTubeEmbedUrl(previewVideo.contentUrl)}
                                                    className="w-full h-full border-0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    title={previewVideo.title}
                                                />
                                            ) : (
                                                <ReactPlayer
                                                    key={previewVideo.id}
                                                    url={previewVideo.contentUrl}
                                                    width="100%"
                                                    height="100%"
                                                    controls
                                                    playing={false}
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground mb-2">
                                                {isAdminPreview ? 'Admin Preview' : 'Free Preview'}: {previewVideo.title}
                                            </h3>
                                            <p className="text-muted-foreground font-medium">
                                                {isAdminPreview
                                                    ? 'You are reviewing this lesson with admin access.'
                                                    : "Get a glimpse of what's inside this comprehensive course. Enjoy this free lesson!"}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-border border-dashed">
                                        <Play size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                                        <p className="text-muted-foreground font-medium pb-2">No preview video available.</p>
                                        <p className="text-muted-foreground/60 text-sm">Check the curriculum for other preview lessons.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'discuss' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <DiscussionSection courseId={id} />
                            </div>
                        )}

                        {activeTab === 'quizzes' && isAdminPreview && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-center gap-3">
                                    <Unlock size={18} className="text-indigo-600 flex-shrink-0" />
                                    <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                                        Admin review mode — you can see all quiz questions and correct answers.
                                    </p>
                                </div>
                                {quizzesLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : quizzes.length === 0 ? (
                                    <div className="text-center py-16 bg-muted/20 rounded-2xl border border-border border-dashed">
                                        <HelpCircle size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                                        <p className="text-muted-foreground font-medium">No quizzes in this course yet.</p>
                                    </div>
                                ) : (
                                    quizzes.map(quiz => (
                                        <div key={quiz.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                                            <button
                                                onClick={() => setExpandedQuiz(expandedQuiz === quiz.id ? null : quiz.id)}
                                                className="w-full flex items-center justify-between p-5 bg-muted/20 hover:bg-muted/40 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 text-left">
                                                    <HelpCircle size={18} className="text-indigo-600 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-foreground font-bold text-[15px] block">{quiz.title}</span>
                                                        <span className="text-xs text-muted-foreground font-medium">
                                                            {quiz.questionCount} questions • Pass: {quiz.passingScore}% • {quiz.timeLimit ? `${quiz.timeLimit} min` : 'No time limit'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {expandedQuiz === quiz.id ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                                            </button>
                                            {expandedQuiz === quiz.id && (
                                                <div className="border-t border-border divide-y divide-border">
                                                    {(quiz.questions || []).map((qn, qi) => (
                                                        <div key={qn.id || qi} className="p-5">
                                                            <div className="flex items-start gap-3">
                                                                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{qi + 1}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-semibold text-foreground text-sm">{qn.text}</p>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{qn.type} • {qn.difficulty}</p>
                                                                    {(qn.options || []).length > 0 && (
                                                                        <div className="mt-3 space-y-1.5">
                                                                            {qn.options.map((opt, oi) => {
                                                                                const isCorrect = Array.isArray(qn.correctAnswer)
                                                                                    ? qn.correctAnswer.includes(opt)
                                                                                    : qn.correctAnswer === opt;
                                                                                return (
                                                                                    <div key={oi} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-700 dark:text-emerald-400 font-semibold' : 'border-border text-muted-foreground'}`}>
                                                                                        {isCorrect && <CheckCircle size={14} className="flex-shrink-0" />}
                                                                                        <span>{opt}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                    {(qn.options || []).length === 0 && qn.correctAnswer && (
                                                                        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-lg px-3 py-2 inline-block">
                                                                            Answer: {qn.correctAnswer}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {/* Rating summary */}
                                <div className="bg-card border border-border rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8 md:gap-12 shadow-sm">
                                    <div className="text-center md:text-left flex flex-col items-center md:items-start min-w-[120px]">
                                        <p className="text-6xl font-extrabold text-foreground tracking-tighter mb-2">{Number(course.rating || 0).toFixed(1)}</p>
                                        <RatingDisplay rating={course.rating} />
                                        <p className="text-muted-foreground font-medium text-sm mt-2">{course.reviewCount?.toLocaleString()} reviews</p>
                                    </div>
                                    <div className="flex-1 w-full space-y-3">
                                        {ratingDist.map(({ stars, pct }) => (
                                            <div key={stars} className="flex items-center gap-3 text-sm font-medium">
                                                <div className="flex items-center gap-1 w-10 text-muted-foreground">
                                                    <span>{stars}</span>
                                                    <Star size={12} className="text-amber-400 mb-0.5" fill="currentColor" />
                                                </div>
                                                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-muted-foreground/60 w-10 text-right">{pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Write / Edit review */}
                                {isEnrolled && (!hasRated || editingRating) && (
                                    <div className="bg-card border border-border shadow-sm rounded-2xl p-6 mb-8">
                                        <h4 className="text-foreground font-bold text-lg mb-4">
                                            {hasRated ? 'Edit Your Review' : 'Leave a Review'}
                                        </h4>
                                        <div className="mb-4">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Your Rating</p>
                                            <RatingStars rating={myRating.stars} size={32} interactive onRate={s => setMyRating(r => ({ ...r, stars: s }))} />
                                        </div>
                                        <textarea
                                            className="w-full bg-muted/40 border border-border rounded-xl p-4 text-[15px] text-foreground/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-card transition-all resize-none h-28 mb-4 shadow-sm"
                                            placeholder="Share your experience with this course..."
                                            value={myRating.comment}
                                            onChange={e => setMyRating(r => ({ ...r, comment: e.target.value }))}
                                        />
                                        <div className="flex gap-3">
                                            <button onClick={handleSubmitRating} disabled={submittingRating}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg text-[15px] shadow-sm disabled:opacity-60 transition-colors">
                                                {submittingRating ? 'Saving...' : hasRated ? 'Update Review' : 'Submit Review'}
                                            </button>
                                            {hasRated && (
                                                <button onClick={() => setEditingRating(false)}
                                                    className="px-6 py-2.5 rounded-lg text-muted-foreground text-[15px] font-semibold border border-border hover:bg-muted/40 transition-colors">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Prompt to edit existing review */}
                                {isEnrolled && hasRated && !editingRating && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-indigo-800 font-bold text-sm">You've reviewed this course</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <RatingStars rating={existingRating?.stars || myRating.stars} size={14} />
                                                <span className="text-indigo-600 text-xs font-semibold">{existingRating?.stars || myRating.stars}/5</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setEditingRating(true)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-bold border border-indigo-200 bg-card hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                                        >
                                            Edit Review
                                        </button>
                                    </div>
                                )}

                                {/* Reviews list */}
                                <div className="space-y-6">
                                    {ratings.map(r => (
                                        <div key={r.id} className="border-b border-border pb-6 last:border-0">
                                            <div className="flex items-start gap-4 mb-3">
                                                <img src={r.studentAvatar} alt={r.studentName} className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0 bg-muted/40" />
                                                <div>
                                                    <p className="text-foreground font-bold text-[15px]">{r.studentName}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <RatingStars rating={r.stars} size={14} />
                                                        <span className="text-muted-foreground/60 font-medium text-xs">{r.createdAt}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-muted-foreground text-[15px] leading-relaxed mt-2 pl-16">{r.comment}</p>
                                            {r.instructorReply && (
                                                <div className="mt-4 ml-16 bg-muted/30 rounded-xl p-4 border border-border relative">
                                                    <div className="absolute top-4 left-0 w-1 h-full max-h-12 bg-indigo-500 rounded-r-full -mt-2"></div>
                                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-2">Instructor Reply</p>
                                                    <p className="text-muted-foreground text-sm leading-relaxed">{r.instructorReply}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {ratings.length === 0 && (
                                        <div className="text-center py-16 bg-muted/40 rounded-2xl border border-border border-dashed">
                                            <Star size={48} className="text-muted-foreground/30 mx-auto mb-4" />
                                            <p className="text-muted-foreground font-medium pb-2">No reviews yet.</p>
                                            <p className="text-muted-foreground text-sm">Be the first to share your experience!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right - Enroll card */}
                <div className="lg:col-span-1 hidden lg:block">
                    <div className="bg-card border border-border shadow-xl rounded-2xl p-6 sticky top-24">
                        {/* Progress if enrolled */}
                        {isEnrolled && (
                            <div className="mb-6 bg-muted/40 rounded-xl p-4 border border-border">
                                <div className="flex justify-between items-center text-sm font-medium mb-2">
                                    <span className="text-muted-foreground">Your progress</span>
                                    <span className="text-indigo-600 text-base font-bold">{enrollment.progress}%</span>
                                </div>
                                <ProgressBar value={enrollment.progress} />
                            </div>
                        )}

                        {/* CTA */}
                        {isAdminPreview || isOwnerInstructor ? (
                            <button
                                onClick={() => navigate(`/courses/${id}/learn`)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-[15px] font-bold mb-4 shadow-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Play size={18} fill="currentColor" /> View Full Course
                            </button>
                        ) : isEnrolled ? (
                            <button
                                onClick={() => navigate(`/courses/${id}/learn`)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-[15px] font-bold mb-4 shadow-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Play size={18} fill="currentColor" /> {enrollment.progress > 0 ? 'Continue Learning' : 'Start Learning'}
                            </button>
                        ) : (
                            <button
                                onClick={handleEnroll}
                                disabled={enrolling}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-[15px] font-bold mb-4 shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {enrolling
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enrolling...</>
                                    : <><ShoppingCart size={18} /> Enroll Now</>}
                            </button>
                        )}

                        {!(isAdminPreview || isOwnerInstructor) && (
                            <button onClick={handleWishlist} disabled={wishlisted && !user} className="w-full bg-card border border-border hover:bg-muted/50 py-3.5 rounded-xl text-foreground font-bold text-[14px] flex items-center justify-center gap-2 transition-colors">
                                <Heart size={18} className={wishlisted ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground/60'} />
                                {wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
                            </button>
                        )}

                        <hr className="my-6 border-border" />

                        {/* Course details */}
                        <div className="space-y-4">
                            <p className="text-foreground font-bold text-[15px] mb-2">This course includes:</p>
                            {[
                                { icon: BookOpen, label: 'Lessons', value: `${course.lessonsCount} interactive lessons` },
                                { icon: Clock, label: 'Duration', value: `${course.duration} of on-demand video` },
                                { icon: Award, label: 'Certificate', value: course.certificate ? 'Certificate of completion' : 'No certificate' },
                                { icon: Star, label: 'Level', value: `${course.level} difficulty` },
                                { icon: FileText, label: 'Resources', value: 'Downloadable resources' },
                            ].map(({ icon: Icon, label, value }) => {
                                if (!Icon) return null;
                                return (
                                    <div key={label} className="flex items-start gap-3">
                                        <Icon size={18} className="text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                                        <span className="text-muted-foreground text-sm font-medium">{value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {/* Mobile sticky enroll button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border shadow-[0_-10px_20px_rgba(0,0,0,0.05)] lg:hidden z-50 flex items-center justify-between gap-4">
                {(isAdminPreview || isOwnerInstructor) ? (
                    <button onClick={() => navigate(`/courses/${id}/learn`)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex-1 max-w-[200px] ml-auto">View Full Course</button>
                ) : isEnrolled ? (
                    <button onClick={() => navigate(`/courses/${id}/learn`)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex-1 max-w-[200px] ml-auto">Continue</button>
                ) : (
                    <button onClick={handleEnroll} disabled={enrolling} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex-1 max-w-[200px] disabled:opacity-60 ml-auto">
                        Enroll Now
                    </button>
                )}
            </div>
        </div>
    );
}
