import { BookOpen, Clock, Users, Heart, Play, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { RatingDisplay } from './RatingStars';
import { useAuth } from '../../contexts/AuthContext';
import { wishlistAPI } from '../../services/api';
import { canAccessCourse } from '../../lib/courseAccess';
import toast from 'react-hot-toast';

const LEVEL_COLORS = {
    Beginner: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    Intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Advanced: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

export function CourseCard({ course, enrollment }) {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [wishlisted, setWishlisted] = useState(user?.wishlist?.includes(course.id) || false);
    const [hearting, setHearting] = useState(false);

    const canAccess = canAccessCourse(user, course);
    const isEnrolled = !!enrollment;

    const handleWishlist = async (e) => {
        e.stopPropagation();
        if (!user) { toast.error('Login to save courses'); return; }
        setHearting(true);
        try {
            const newWishlist = await wishlistAPI.toggle(user.id, course.id);
            setWishlisted(newWishlist.includes(course.id));
            updateUser({ wishlist: newWishlist });
            toast.success(wishlisted ? 'Removed from wishlist' : 'Saved to wishlist ❤️');
        } finally { setHearting(false); }
    };

    const handleClick = () => {
        navigate(`/courses/${course.id}`);
    };

    const effectivePrice = course.discountPrice ?? course.price ?? 0;
    const discountPct = course.price > 0 && course.discountPrice !== null
        ? Math.round((1 - course.discountPrice / course.price) * 100)
        : 0;

    return (
        <div
            className="flex flex-col bg-card rounded-xl border border-border overflow-hidden card-hover cursor-pointer group shadow-card"
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-label={`Course: ${course.title}`}
        >
            {/* Thumbnail */}
            <div className="relative overflow-hidden aspect-video">
                <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider ${LEVEL_COLORS[course.level] || 'bg-indigo-100 text-indigo-800'}`}>{course.level}</span>
                    {course.status === 'PENDING' && <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">Pending Review</span>}
                    {discountPct > 0 && <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">{discountPct}% OFF</span>}
                </div>
                {!canAccess && !isEnrolled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100">
                        <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2 shadow-lg">
                            <Lock size={14} className="text-amber-500" />
                            <span className="text-xs font-bold text-foreground">{course.requiredPlan} Plan Required</span>
                        </div>
                    </div>
                )}
                {/* Wishlist btn */}
                <button
                    onClick={handleWishlist}
                    disabled={hearting}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/90 backdrop-blur shadow-sm border border-border flex items-center justify-center hover:bg-rose-50 transition-colors"
                    aria-label="Add to wishlist"
                >
                    <Heart
                        size={14}
                        className={wishlisted ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground/60'}
                    />
                </button>
                {/* Play btn overlay */}
                {isEnrolled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-indigo-600 shadow-lg flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                            <Play size={20} className="text-white ml-1" fill="white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs text-indigo-600 font-bold uppercase tracking-wide">{course.category}</span>
                </div>
                <h3 className="font-bold text-foreground text-base leading-tight mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                    {course.title}
                </h3>
                <div className="flex items-center gap-2 mb-3">
                    <img src={course.instructorAvatar} alt="" className="w-5 h-5 rounded-full bg-muted" />
                    <span className="text-muted-foreground text-sm">{course.instructorName}</span>
                </div>

                {/* Progress if enrolled */}
                {isEnrolled && (
                    <div className="mt-auto mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1 font-medium">
                            <span>Your Progress</span>
                            <span className="text-indigo-600 font-bold">{enrollment.progress}%</span>
                        </div>
                        <ProgressBar value={enrollment.progress} />
                    </div>
                )}

                <div className="flex items-center gap-3 mb-3 text-[11px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><Clock size={12} /> {course.duration}</span>
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {course.lessonsCount} lessons</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {course.enrollmentCount?.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600 text-sm">{course.rating}</span>
                    <RatingDisplay rating={course.rating} count={course.reviewCount} />
                </div>

                {/* Price */}
                {!isEnrolled && (
                    <div className="mt-auto pt-3 flex items-end justify-between">
                        <div className="flex items-center gap-2">
                            {course.price === 0 ? (
                                <span className="text-emerald-600 font-bold text-lg leading-none">Free</span>
                            ) : (
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-foreground font-bold text-lg leading-none">₹{effectivePrice.toLocaleString()}</span>
                                    {course.discountPrice !== null && course.discountPrice < course.price && (
                                        <span className="text-muted-foreground text-sm line-through decoration-slate-300 dark:decoration-slate-700">₹{course.price?.toLocaleString()}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        {course.certificate && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded">
                                Certificate
                            </span>
                        )}
                    </div>
                )}

                {isEnrolled && (
                    <button className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm py-2 rounded-lg text-sm font-semibold transition-colors">
                        {enrollment.progress === 100 ? 'Review Course' : 'Continue Learning'}
                    </button>
                )}
            </div>
        </div>
    );
}

export function SkeletonCard() {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="aspect-video bg-muted animate-pulse" />
            <div className="p-4 flex flex-col gap-3">
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse mt-2" />
            </div>
        </div>
    );
}
