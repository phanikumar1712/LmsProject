import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    BookOpen, Clock, Users, Star, Award, Play, CheckCircle, ChevronDown,
    ChevronRight, ArrowLeft, FileText, ShoppingCart, Heart, HelpCircle, Sparkles,
    BadgeCheck, MessageCircle, Target, Layers, Globe, BarChart3
} from 'lucide-react';
import { coursesAPI, enrollmentsAPI, ratingsAPI, wishlistAPI, quizzesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { RatingDisplay, RatingStars } from '../components/ui/RatingStars';
import { ProgressBar } from '../components/ui/ProgressBar';
import { CourseThumbnail } from '../components/ui/CourseThumbnail';
import DiscussionSection from '../components/ui/DiscussionSection';
import toast from 'react-hot-toast';

function StatBadge({ icon: Icon, label, value, color = 'indigo' }) {
    const colors = {
        indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-600 border-indigo-200/50',
        emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 border-emerald-200/50',
        amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 border-amber-200/50',
        violet: 'from-violet-500/10 to-violet-500/5 text-violet-600 border-violet-200/50',
        rose: 'from-rose-500/10 to-rose-500/5 text-rose-600 border-rose-200/50',
        sky: 'from-sky-500/10 to-sky-500/5 text-sky-600 border-sky-200/50',
    };
    return (
        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-br ${colors[color]} border shadow-sm`}>
            <Icon size={16} className="opacity-70" />
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
                <p className="text-sm font-black">{value}</p>
            </div>
        </div>
    );
}

function SectionCard({ section, lessons, isExpanded, onToggle, index, canFullPreview, onPlay }) {
    const sectionLessons = lessons.filter(l => l.sectionId === section.id);
    return (
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 flex items-center justify-center">
                        <Layers size={16} className="text-indigo-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-foreground text-sm">
                            Section {index + 1}: {section.title}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                            {sectionLessons.length} lesson{sectionLessons.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className={`p-1.5 rounded-lg transition-all duration-300 ${isExpanded ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    <ChevronDown size={18} />
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-border divide-y divide-border/50 animate-in slide-in-from-top-1 duration-200">
                    {sectionLessons.map((lesson, lIdx) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/20 transition-colors group">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.type === 'video' ? 'bg-rose-50 text-rose-500 border border-rose-200/50' : lesson.type === 'quiz' ? 'bg-amber-50 text-amber-500 border border-amber-200/50' : 'bg-sky-50 text-sky-500 border border-sky-200/50'}`}>
                                {lesson.type === 'video' ? <Play size={14} /> : lesson.type === 'quiz' ? <HelpCircle size={14} /> : <FileText size={14} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                                    {lesson.title}
                                    {lesson.preview && (
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">Preview</span>
                                    )}
                                </p>
                                {lesson.duration && (
                                    <p className="text-xs text-muted-foreground/60 font-medium flex items-center gap-1 mt-0.5">
                                        <Clock size={11} />
                                        {lesson.duration}
                                    </p>
                                )}
                            </div>
                            {lesson.preview && canFullPreview && (
                                <button onClick={() => onPlay?.(lesson)}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all border border-indigo-200/50 flex items-center gap-1.5">
                                    <Play size={12} /> Preview
                                </button>
                            )}
                        </div>
                    ))}
                    {sectionLessons.length === 0 && (
                        <div className="px-6 py-4 text-sm text-muted-foreground/60 font-medium italic">No lessons in this section yet</div>
                    )}
                </div>
            )}
        </div>
    );
}

function ReviewCard({ review }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                    {review.studentAvatar ? (
                        <img src={review.studentAvatar} alt="" className="w-11 h-11 rounded-xl object-cover border-2 border-border" />
                    ) : (
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{review.studentName?.charAt(0)?.toUpperCase()}</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="font-bold text-foreground text-sm">{review.studentName || 'Anonymous'}</p>
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} size={13} className={i < review.stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'} />
                            ))}
                        </div>
                    </div>
                    {review.comment && <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>}
                    <p className="text-[11px] text-muted-foreground/50 font-medium mt-2">{new Date(review.createdAt).toLocaleDateString()}</p>

                    {review.instructorReply && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-indigo-50/50 to-transparent border border-indigo-200/30 rounded-xl">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <BadgeCheck size={12} /> Instructor Response
                            </p>
                            <p className="text-sm text-muted-foreground">{review.instructorReply}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CourseDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();

    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [sections, setSections] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [enrollment, setEnrollment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [expandedSections, setExpandedSections] = useState({});
    const [activeTab, setActiveTab] = useState('overview');
    const [quizzes, setQuizzes] = useState([]);
    const [quizzesLoading, setQuizzesLoading] = useState(false);
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
        ]).then(([c, resp, rs]) => {
            setCourse(c);
            setLessons(resp?.lessons || []);
            setSections(resp?.sections || []);
            setRatings(rs || []);
            if (user) setWishlisted(user.wishlist?.includes(id) || false);
            const firstPreview = (resp?.lessons || []).find(l => l.preview && l.type === 'video');
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
            ratingsAPI.getMyRating(id).then(existing => {
                if (existing) setMyRating({ stars: existing.stars, comment: existing.comment || '' });
            }).catch(() => {});
        }
    }, [id, user]);

    const isAdminPreview = user?.role === 'SUPER_ADMIN' || (
        user?.role === 'ADMIN' && (!user.departmentId || course?.departmentId === user.departmentId)
    );
    const isOwnerInstructor = user?.role === 'INSTRUCTOR' && course?.instructorId === user?.id;
    const canFullPreview = isAdminPreview || isOwnerInstructor;

    useEffect(() => {
        if (!isAdminPreview) return;
        setQuizzesLoading(true);
        quizzesAPI.getByCourse(id).then(qs => setQuizzes(qs || [])).catch(() => setQuizzes([])).finally(() => setQuizzesLoading(false));
    }, [id, isAdminPreview]);

    const isEnrolled = user?.role === 'STUDENT' && !!enrollment;
    const hasRated = Array.isArray(ratings) ? ratings.some(r => r.studentId === user?.id) : false;

    const handleEnroll = async () => {
        if (!user) { navigate('/login'); return; }
        setEnrolling(true);
        try {
            const e = await enrollmentsAPI.enroll(user.id, id);
            setEnrollment(e);
            toast.success('Successfully enrolled! 🎉');
        } catch (err) { toast.error(err.message); }
        finally { setEnrolling(false); }
    };

    const handleWishlist = async () => {
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
            setRatings(prev => {
                const filtered = prev.filter(x => x.studentId !== user.id);
                return [r, ...filtered];
            });
            setEditingRating(false);
            toast.success(hasRated ? 'Review updated! ⭐' : 'Review submitted! ⭐');
        } catch (err) { toast.error(err.message); }
        finally { setSubmittingRating(false); }
    };

    const getLessonsForSection = (sectionId) => lessons.filter(l => l.sectionId === sectionId);

    // Compute aggregated stats
    const stats = useMemo(() => course ? [
        { icon: Clock, label: 'Duration', value: course.duration || 'Self-paced', color: 'sky' },
        { icon: BookOpen, label: 'Lessons', value: `${lessons.length}`, color: 'indigo' },
        { icon: Users, label: 'Enrolled', value: course.enrollmentCount?.toLocaleString() || '0', color: 'emerald' },
        { icon: BarChart3, label: 'Level', value: course.level || 'Beginner', color: 'violet' },
    ] : [], [course, lessons]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-14 h-14 border-[4px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                    <p className="text-muted-foreground font-medium">Loading course details...</p>
                </div>
            </div>
        );
    }

    if (!course) return null;

    const TABS = [
        { key: 'overview', label: 'Overview', icon: BookOpen },
        { key: 'curriculum', label: 'Curriculum', icon: Layers },
        { key: 'reviews', label: 'Reviews', icon: Star },
        { key: 'discuss', label: 'Discussion', icon: MessageCircle },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* ── Hero Section ── */}
            <div className="relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400/10 via-transparent to-transparent" />
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl" />
                
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-white/60 hover:text-white mb-8 text-sm font-medium transition-all group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Courses
                    </button>

                    <div className="grid lg:grid-cols-3 gap-10 items-start">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-white/90 text-xs font-bold uppercase tracking-wider border border-white/10">
                                    {course.level || 'Beginner'}
                                </span>
                                {course.categoryName && (
                                    <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-white/90 text-xs font-bold uppercase tracking-wider border border-white/10">
                                        {course.categoryName}
                                    </span>
                                )}
                                {course.certificate && (
                                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 backdrop-blur-sm text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1.5">
                                        <Award size={12} /> Certificate
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                                {course.title}
                            </h1>

                            {course.shortDesc && (
                                <p className="text-lg text-white/70 leading-relaxed max-w-2xl">{course.shortDesc}</p>
                            )}

                            <div className="flex items-center gap-4 flex-wrap">
                                <RatingDisplay rating={course.rating} count={course.reviewCount} size="lg" />
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-white/50" />
                                    <span className="text-white/80 text-sm font-medium">{course.enrollmentCount?.toLocaleString() || 0} enrolled</span>
                                </div>
                            </div>

                            {/* Instructor brief */}
                            <Link to={`/instructor/${course.instructorId}`}
                                className="inline-flex items-center gap-3 group bg-white/5 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10 hover:bg-white/10 transition-all">
                                {course.instructorAvatar ? (
                                    <img src={course.instructorAvatar} alt={course.instructorName} className="w-11 h-11 rounded-xl object-cover border-2 border-white/20" />
                                ) : (
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center border-2 border-white/20">
                                        <span className="text-white font-bold text-sm">{course.instructorName?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                )}
                                <div>
                                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Instructor</p>
                                    <p className="text-white font-bold text-sm group-hover:text-indigo-300 transition-colors">{course.instructorName}</p>
                                </div>
                                <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 ml-2 transition-all" />
                            </Link>
                        </div>

                        {/* CTA Card */}
                        <div className="lg:col-span-1">
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl space-y-5">
                                <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-800/50 to-violet-800/50 border border-white/10 flex items-center justify-center">
                                    {previewVideo ? (
                                        <button onClick={() => window.open(course.thumbnail || '#', '_blank')}
                                            className="flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors">
                                            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                                                <Play size={28} className="ml-1" />
                                            </div>
                                            <span className="text-xs font-bold">Preview this course</span>
                                        </button>
                                    ) : (
                                        <CourseThumbnail thumbnail={course.thumbnail} title={course.title} className="w-full h-full object-cover" />
                                    )}
                                </div>

                                {isEnrolled ? (
                                    <Link to={`/courses/${id}/learn`}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]">
                                        <Play size={18} /> Continue Learning
                                    </Link>
                                ) : (
                                    <button onClick={handleEnroll} disabled={enrolling}
                                        className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-60 text-white px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98] flex items-center justify-center gap-2">
                                        {enrolling ? (
                                            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enrolling...</>
                                        ) : (
                                            <><ShoppingCart size={18} /> Enroll for Free</>
                                        )}
                                    </button>
                                )}

                                <button onClick={handleWishlist}
                                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all border ${wishlisted ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                                    <Heart size={16} className={wishlisted ? 'fill-rose-400' : ''} />
                                    {wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats bar */}
                    <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {stats.map(s => <StatBadge key={s.label} {...s} />)}
                    </div>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-1 overflow-x-auto">
                        {TABS.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-5 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'}`}>
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'overview' && (
                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {/* Description */}
                            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                                <h2 className="text-xl font-black text-foreground mb-4 flex items-center gap-2">
                                    <BookOpen size={20} className="text-indigo-600" /> About This Course
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">{course.description}</p>
                                {course.whatYouLearn?.length > 0 && (
                                    <>
                                        <h3 className="text-lg font-bold text-foreground mt-8 mb-4 flex items-center gap-2">
                                            <Sparkles size={18} className="text-amber-500" /> What You'll Learn
                                        </h3>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            {course.whatYouLearn.map((item, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-900/10 rounded-xl border border-emerald-200/30">
                                                    <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-foreground/80">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {course.requirements?.length > 0 && (
                                    <>
                                        <h3 className="text-lg font-bold text-foreground mt-8 mb-4 flex items-center gap-2">
                                            <Target size={18} className="text-rose-500" /> Requirements
                                        </h3>
                                        <ul className="space-y-2.5">
                                            {course.requirements.map((req, i) => (
                                                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                                                    {req}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                                <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Award size={16} className="text-indigo-600" /> Course Features
                                </h3>
                                <div className="space-y-3.5">
                                    {[
                                        { icon: Clock, label: 'Duration', value: course.duration || 'Self-paced' },
                                        { icon: Play, label: 'Video Content', value: `${lessons.filter(l => l.type === 'video').length} videos` },
                                        { icon: HelpCircle, label: 'Quizzes', value: `${lessons.filter(l => l.type === 'quiz').length} quizzes` },
                                        { icon: Award, label: 'Certificate', value: course.certificate ? 'Yes' : 'No' },
                                        { icon: Globe, label: 'Language', value: course.language || 'English' },
                                    ].map(({ icon: Icon, label, value }) => (
                                        <div key={label} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                                <Icon size={15} className="text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
                                                <p className="text-sm font-semibold text-foreground">{value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                                <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Users size={16} className="text-indigo-600" /> Instructor
                                </h3>
                                <Link to={`/instructor/${course.instructorId}`} className="flex items-center gap-3 group">
                                    {course.instructorAvatar ? (
                                        <img src={course.instructorAvatar} alt={course.instructorName} className="w-12 h-12 rounded-xl object-cover border-2 border-border" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                                            <span className="text-white font-bold">{course.instructorName?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-foreground text-sm group-hover:text-indigo-600 transition-colors">{course.instructorName}</p>
                                        <p className="text-xs text-muted-foreground/60 font-medium">{course.instructorBio?.slice(0, 60) || 'Instructor'}</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'curriculum' && (
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Course Curriculum</h2>
                                <p className="text-muted-foreground font-medium text-sm mt-1">{sections.length} sections · {lessons.length} lessons</p>
                            </div>
                            <button onClick={() => sections.forEach((_, i) => setExpandedSections(prev => ({ ...prev, [i]: true })))}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-4 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-all">
                                Expand All
                            </button>
                        </div>
                        {sections.map((section, i) => (
                            <SectionCard
                                key={section.id}
                                section={section}
                                lessons={lessons}
                                isExpanded={expandedSections[i] ?? (i === 0)}
                                onToggle={() => setExpandedSections(prev => ({ ...prev, [i]: !prev[i] }))}
                                index={i}
                                canFullPreview={canFullPreview}
                                onPlay={(l) => setPreviewVideo(l)}
                            />
                        ))}
                        {sections.length === 0 && (
                            <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
                                <Layers size={48} className="mx-auto mb-4 text-muted-foreground/20" />
                                <h3 className="text-lg font-bold text-foreground mb-1">Curriculum not available yet</h3>
                                <p className="text-muted-foreground text-sm">The instructor is building this course. Check back later!</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'reviews' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Student Reviews</h2>
                                <p className="text-muted-foreground font-medium text-sm mt-1">{ratings.length} review{ratings.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <RatingDisplay rating={course.rating} count={course.reviewCount} />
                            </div>
                        </div>

                        {/* Rating form */}
                        {user?.role === 'STUDENT' && isEnrolled && !editingRating && (
                            <button onClick={() => setEditingRating(true)}
                                className="w-full bg-card border border-dashed border-border hover:border-indigo-300 hover:bg-indigo-50/30 rounded-3xl p-6 text-center transition-all group">
                                <Star size={24} className="mx-auto mb-2 text-muted-foreground/30 group-hover:text-amber-400 transition-colors" />
                                <p className="font-bold text-foreground group-hover:text-indigo-600 transition-colors">{hasRated ? 'Edit your review' : 'Share your thoughts — leave a review!'}</p>
                            </button>
                        )}

                        {editingRating && (
                            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                                <h3 className="font-bold text-foreground mb-4">{hasRated ? 'Update Your Review' : 'Write a Review'}</h3>
                                <div className="flex items-center gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} onClick={() => setMyRating(prev => ({ ...prev, stars: star }))} className="p-1 transition-all hover:scale-110">
                                            <Star size={28} className={star <= myRating.stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20 hover:text-amber-300'} />
                                        </button>
                                    ))}
                                </div>
                                <textarea value={myRating.comment} onChange={e => setMyRating(prev => ({ ...prev, comment: e.target.value }))}
                                    placeholder="What did you think of this course? Share your experience..."
                                    className="w-full bg-muted/40 border border-border rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                                />
                                <div className="flex gap-3 mt-4">
                                    <button onClick={() => setEditingRating(false)} className="px-6 py-2.5 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                    <button onClick={handleSubmitRating} disabled={submittingRating || !myRating.stars}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 text-white font-bold text-sm transition-all flex items-center gap-2">
                                        {submittingRating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting...</> : <><Star size={16} /> Submit Review</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {ratings.length > 0 ? (
                            <div className="space-y-4">
                                {ratings.map(r => <ReviewCard key={r.id} review={r} />)}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
                                <Star size={48} className="mx-auto mb-4 text-muted-foreground/20" />
                                <h3 className="text-lg font-bold text-foreground mb-1">No reviews yet</h3>
                                <p className="text-muted-foreground text-sm">Be the first to share your experience!</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'discuss' && (
                    <div className="max-w-3xl mx-auto">
                        <DiscussionSection courseId={id} />
                    </div>
                )}
            </div>
        </div>
    );
}