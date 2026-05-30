import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BookOpen, Clock, Users, Star, Award, Play, CheckCircle, Lock, ChevronDown,
    ChevronUp, ArrowLeft, FileText, ShoppingCart, Heart, Unlock
} from 'lucide-react';
import { coursesAPI, enrollmentsAPI, ratingsAPI, wishlistAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { RatingDisplay, RatingStars } from '../components/ui/RatingStars';
import { ProgressBar } from '../components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { PLAN_ORDER } from '../lib/constants';

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
    const [expandedSections, setExpandedSections] = useState({ 0: true });
    const [activeTab, setActiveTab] = useState('overview');
    const [myRating, setMyRating] = useState({ stars: 0, comment: '' });
    const [submittingRating, setSubmittingRating] = useState(false);
    const [editingRating, setEditingRating] = useState(false);
    const [wishlisted, setWishlisted] = useState(false);

    useEffect(() => {
        Promise.all([
            coursesAPI.getById(id),
            coursesAPI.getLessons(id),
            ratingsAPI.getByCourse(id),
        ]).then(([c, { lessons: ls, sections: ss }, rs]) => {
            setCourse(c);
            setLessons(ls || []);
            setSections(ss || []);
            setRatings(rs);
            if (user) setWishlisted(user.wishlist?.includes(id) || false);
        }).finally(() => setLoading(false));

        if (user) {
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

    const requiredPlan = course?.requiredPlan || 'FREE';
    const canAccess = user && (PLAN_ORDER[user.subscriptionPlan || 'FREE'] >= PLAN_ORDER[requiredPlan]);
    const isEnrolled = !!enrollment;
    const existingRating = ratings.find(r => r.studentId === user?.id);
    const hasRated = !!existingRating;

    const handleEnroll = async () => {
        if (!user) { navigate('/login'); return; }
        if (!canAccess) { navigate('/student/subscription'); toast.error(`Upgrade to ${course.requiredPlan} plan to access this course`); return; }
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

    const ratingDist = [5, 4, 3, 2, 1].map(s => ({
        stars: s,
        count: ratings.filter(r => r.stars === s).length,
        pct: ratings.length > 0 ? Math.round(ratings.filter(r => r.stars === s).length / ratings.length * 100) : 0,
    }));

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
                        <div className="h-8 w-3/4 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-4 w-full bg-slate-100 rounded-lg animate-pulse" />
                    </div>
                    <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
            </div>
        );
    }

    if (!course) return <div className="text-center py-20 text-slate-500 font-medium">Course not found</div>;

    const LEVEL_COLORS = {
        Beginner: 'bg-emerald-100 text-emerald-800',
        Intermediate: 'bg-amber-100 text-amber-800',
        Advanced: 'bg-rose-100 text-rose-800',
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 bg-white min-h-screen">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 text-sm font-medium transition-colors">
                <ArrowLeft size={16} /> Back to courses
            </button>

            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
                {/* Left - Course info */}
                <div className="lg:col-span-2">
                    {/* Hero image */}
                    <div className="relative rounded-2xl overflow-hidden mb-8 h-[300px] md:h-[400px] shadow-sm border border-slate-200">
                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent" />
                        <div className="absolute bottom-6 left-6">
                            <div className="flex gap-2 flex-wrap mb-3">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide shadow-sm ${LEVEL_COLORS[course.level] || 'bg-indigo-100 text-indigo-800'}`}>{course.level}</span>
                                {course.certificate && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide shadow-sm">🏆 Certificate</span>}
                            </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <button className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
                                <Play size={28} className="text-indigo-600 ml-1" fill="currentColor" />
                            </button>
                        </div>
                    </div>

                    {/* Title & meta */}
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">{course.title}</h1>
                    <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-slate-600 font-medium pb-6 border-b border-slate-200">
                        <RatingDisplay rating={course.rating} count={course.reviewCount} />
                        <span className="flex items-center gap-1.5"><Users size={16} className="text-slate-400" /> {course.enrollmentCount?.toLocaleString()} students</span>
                        <span className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400" /> {course.duration}</span>
                        <span className="flex items-center gap-1.5"><BookOpen size={16} className="text-slate-400" /> {course.lessonsCount} lessons</span>
                    </div>

                    {/* Instructor */}
                    <div className="flex items-center gap-4 mb-8">
                        <img src={course.instructorAvatar} alt={course.instructorName} className="w-14 h-14 rounded-full shadow-sm border border-slate-200 object-cover" />
                        <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Instructor</p>
                            <p className="text-slate-900 font-bold text-lg">{course.instructorName}</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-8 border-b border-slate-200">
                        {['overview', 'curriculum', 'reviews'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-5 py-3 text-sm font-semibold capitalize transition-all border-b-2 -mb-[1px] ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">About this course</h3>
                                <p className="text-slate-600 leading-relaxed text-[15px]">{course.description}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">What you'll learn</h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {course.learningOutcomes?.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 text-[15px] text-slate-700 font-medium">
                                            <CheckCircle size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {course.prerequisites?.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-4">Prerequisites</h3>
                                    <ul className="space-y-2">
                                        {course.prerequisites.map((p, i) => (
                                            <li key={i} className="text-slate-600 text-[15px] flex items-center gap-3">
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> {p}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {course.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {course.tags.map(tag => (
                                        <span key={tag} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'curriculum' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {sections.length === 0 && lessons.length === 0 ? (
                                <p className="text-slate-500 text-center py-8 font-medium">Curriculum details not available for preview</p>
                            ) : (
                                sections.map((section, idx) => {
                                    const sectionLessons = getLessonsForSection(section.id);
                                    const isExpanded = expandedSections[idx];
                                    return (
                                        <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                            <button
                                                onClick={() => setExpandedSections(e => ({ ...e, [idx]: !e[idx] }))}
                                                className="w-full flex items-center justify-between p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-slate-900 font-bold text-[15px]">{section.title}</span>
                                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">{sectionLessons.length} lessons</span>
                                                </div>
                                                {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                                            </button>
                                            {isExpanded && (
                                                <div className="border-t border-slate-200 divide-y divide-slate-100">
                                                    {sectionLessons.map(lesson => (
                                                        <div key={lesson.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${lesson.type === 'video' ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'}`}>
                                                                {lesson.type === 'video'
                                                                    ? <Play size={14} className="ml-0.5" fill="currentColor" />
                                                                    : <FileText size={14} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[14px] font-medium text-slate-700 group-hover:text-indigo-600 transition-colors truncate">{lesson.title}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {lesson.preview && !isEnrolled && (
                                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Preview</span>
                                                                )}
                                                                <span className="text-xs font-medium text-slate-500">{lesson.duration}</span>
                                                                {!isEnrolled && !lesson.preview && <Lock size={14} className="text-slate-300" />}
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

                    {activeTab === 'reviews' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Rating summary */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                                <div className="text-center md:text-left flex flex-col items-center md:items-start min-w-[120px]">
                                    <p className="text-6xl font-extrabold text-slate-900 tracking-tighter mb-2">{course.rating?.toFixed(1)}</p>
                                    <RatingDisplay rating={course.rating} />
                                    <p className="text-slate-500 font-medium text-sm mt-2">{course.reviewCount?.toLocaleString()} reviews</p>
                                </div>
                                <div className="flex-1 w-full space-y-3">
                                    {ratingDist.map(({ stars, count, pct }) => (
                                        <div key={stars} className="flex items-center gap-3 text-sm font-medium">
                                            <div className="flex items-center gap-1 w-10 text-slate-600">
                                                <span>{stars}</span>
                                                <Star size={12} className="text-amber-400 mb-0.5" fill="currentColor" />
                                            </div>
                                            <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-slate-500 w-10 text-right">{pct}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Write / Edit review */}
                            {isEnrolled && (!hasRated || editingRating) && (
                                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 mb-8">
                                    <h4 className="text-slate-900 font-bold text-lg mb-4">
                                        {hasRated ? 'Edit Your Review' : 'Leave a Review'}
                                    </h4>
                                    <div className="mb-4">
                                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Your Rating</p>
                                        <RatingStars rating={myRating.stars} size={32} interactive onRate={s => setMyRating(r => ({ ...r, stars: s }))} />
                                    </div>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-[15px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none h-28 mb-4 shadow-sm"
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
                                                className="px-6 py-2.5 rounded-lg text-slate-600 text-[15px] font-semibold border border-slate-200 hover:bg-slate-50 transition-colors">
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
                                        className="text-indigo-600 hover:text-indigo-800 text-sm font-bold border border-indigo-200 bg-white hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Edit Review
                                    </button>
                                </div>
                            )}

                            {/* Reviews list */}
                            <div className="space-y-6">
                                {ratings.map(r => (
                                    <div key={r.id} className="border-b border-slate-100 pb-6 last:border-0">
                                        <div className="flex items-start gap-4 mb-3">
                                            <img src={r.studentAvatar} alt={r.studentName} className="w-12 h-12 rounded-full object-cover border border-slate-200 flex-shrink-0 bg-slate-50" />
                                            <div>
                                                <p className="text-slate-900 font-bold text-[15px]">{r.studentName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <RatingStars rating={r.stars} size={14} />
                                                    <span className="text-slate-400 font-medium text-xs">{r.createdAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-slate-700 text-[15px] leading-relaxed mt-2 pl-16">{r.comment}</p>
                                        {r.instructorReply && (
                                            <div className="mt-4 ml-16 bg-slate-50 rounded-xl p-4 border border-slate-100 relative">
                                                <div className="absolute top-4 left-0 w-1 h-full max-h-12 bg-indigo-500 rounded-r-full -mt-2"></div>
                                                <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-2">Instructor Reply</p>
                                                <p className="text-slate-600 text-sm leading-relaxed">{r.instructorReply}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {ratings.length === 0 && (
                                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                                        <Star size={48} className="text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-600 font-medium pb-2">No reviews yet.</p>
                                        <p className="text-slate-500 text-sm">Be the first to share your experience!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right - Enroll card */}
                <div className="lg:col-span-1 hidden lg:block">
                    <div className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-6 sticky top-24">
                        {/* Price */}
                        <div className="mb-6">
                            {course.price === 0 ? (
                                <p className="text-4xl font-extrabold text-emerald-600 tracking-tight">Free</p>
                            ) : (
                                <div className="flex items-end gap-3">
                                    <p className="text-4xl font-extrabold text-slate-900 tracking-tight">₹{course.discountPrice?.toLocaleString()}</p>
                                    {course.discountPrice < course.price && (
                                        <p className="text-slate-400 font-medium text-lg line-through mb-1">₹{course.price?.toLocaleString()}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Plan requirement */}
                        {requiredPlan !== 'FREE' && (
                            <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
                                <p className="text-amber-800 text-sm font-bold flex items-center gap-2">
                                    <Unlock size={16} /> Requires {requiredPlan} plan
                                </p>
                            </div>
                        )}

                        {/* Progress if enrolled */}
                        {isEnrolled && (
                            <div className="mb-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="flex justify-between items-center text-sm font-medium mb-2">
                                    <span className="text-slate-600">Your progress</span>
                                    <span className="text-indigo-600 text-base font-bold">{enrollment.progress}%</span>
                                </div>
                                <ProgressBar value={enrollment.progress} />
                            </div>
                        )}

                        {/* CTA */}
                        {isEnrolled ? (
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
                                    : canAccess ? <><ShoppingCart size={18} /> Enroll Now</> : <><Lock size={18} /> Upgrade to Enroll</>}
                            </button>
                        )}

                        <button onClick={handleWishlist} disabled={wishlisted && !user} className="w-full bg-white border border-slate-200 hover:bg-slate-50 py-3.5 rounded-xl text-slate-700 font-bold text-[14px] flex items-center justify-center gap-2 transition-colors">
                            <Heart size={18} className={wishlisted ? 'text-rose-500 fill-rose-500' : 'text-slate-400'} />
                            {wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
                        </button>

                        <hr className="my-6 border-slate-200" />

                        {/* Course details */}
                        <div className="space-y-4">
                            <p className="text-slate-900 font-bold text-[15px] mb-2">This course includes:</p>
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
                                        <Icon size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-slate-600 text-sm font-medium">{value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {/* Mobile sticky enroll button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] lg:hidden z-50 flex items-center justify-between gap-4">
                <div>
                    {course.price === 0 ? <p className="font-bold text-lg text-emerald-600">Free</p> : <p className="font-bold text-lg text-slate-900">₹{course.discountPrice?.toLocaleString()}</p>}
                </div>
                {isEnrolled ? (
                    <button onClick={() => navigate(`/courses/${id}/learn`)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex-1 max-w-[200px]">Continue</button>
                ) : (
                    <button onClick={handleEnroll} disabled={enrolling} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex-1 max-w-[200px] disabled:opacity-60">
                        {canAccess ? 'Enroll Now' : 'Upgrade'}
                    </button>
                )}
            </div>
        </div>
    );
}
