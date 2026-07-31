import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    BookOpen, Users, Star, ArrowLeft, Mail, Globe,
    ExternalLink, Play, Award, Calendar, X, Send,
    Heart, Share2, BadgeCheck, Film
} from 'lucide-react';
import { usersAPI, notificationsAPI } from '../services/api';
import { RatingDisplay } from '../components/ui/RatingStars';
import { CourseThumbnail } from '../components/ui/CourseThumbnail';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, color = 'indigo' }) {
    const colors = {
        indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-600 border-indigo-200/50',
        emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 border-emerald-200/50',
        amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 border-amber-200/50',
        violet: 'from-violet-500/10 to-violet-500/5 text-violet-600 border-violet-200/50',
        rose: 'from-rose-500/10 to-rose-500/5 text-rose-600 border-rose-200/50',
        sky: 'from-sky-500/10 to-sky-500/5 text-sky-600 border-sky-200/50',
    };
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br ${colors[color]} border shadow-sm`}>
            <Icon size={20} className="opacity-70" />
            <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
            </div>
        </div>
    );
}

function CourseCard({ course }) {
    return (
        <Link to={`/courses/${course.id}`}
            className="group bg-card rounded-3xl overflow-hidden border border-border shadow-sm hover:shadow-xl hover:border-indigo-500/20 transition-all duration-300 flex flex-col">
            <div className="relative aspect-video overflow-hidden">
                <CourseThumbnail thumbnail={course.thumbnail} title={course.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-white/90 backdrop-blur-md text-foreground text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-widest shadow-sm border border-white/50">
                        {course.level}
                    </span>
                    {course.certificate && (
                        <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-widest shadow-sm flex items-center gap-1">
                            <Award size={10} /> Cert
                        </span>
                    )}
                </div>
            </div>
            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-base font-black text-foreground mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">
                    {course.title}
                </h3>
                <p className="text-xs text-muted-foreground font-medium line-clamp-2 mb-4">
                    {course.shortDesc || course.description?.slice(0, 120)}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-bold mb-4">
                    <div className="flex items-center gap-1.5">
                        <BookOpen size={14} className="text-indigo-500" /> {course.lessonsCount || 0} lessons
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-indigo-500" /> {course.enrollmentCount?.toLocaleString()} students
                    </div>
                </div>
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                    <RatingDisplay rating={course.rating} count={course.reviewCount} />
                </div>
            </div>
        </Link>
    );
}

export default function InstructorProfilePage() {
    const [id] = useParams().id.split('?');
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [actionLoading, setActionLoading] = useState(false);

    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        setLoading(true);
        usersAPI.getInstructorProfile(id)
            .then(res => {
                setData(res);
                setFollowing(res.instructor.isFollowing);
                setFollowerCount(res.instructor.followerCount || 0);
            })
            .catch(() => {
                toast.error('Failed to load instructor profile');
                navigate('/courses');
            })
            .finally(() => setLoading(false));
    }, [id, navigate]);

    const handleFollow = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            if (following) {
                await usersAPI.unfollowInstructor(id);
                setFollowing(false);
                setFollowerCount(prev => Math.max(0, prev - 1));
                toast.success('Unfollowed');
            } else {
                await usersAPI.followInstructor(id);
                setFollowing(true);
                setFollowerCount(prev => prev + 1);
                toast.success('Following instructor!');
            }
        } catch (err) { toast.error(err.message || 'Action failed'); }
        finally { setActionLoading(false); }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Profile link copied to clipboard!');
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('lms_token');
        if (!token) { toast.error('Please login to contact the instructor'); return; }
        setSending(true);
        try {
            await notificationsAPI.create({
                userId: id,
                message: `New message from a student regarding your profile: "${message}"`,
                type: 'message'
            });
            toast.success('Message sent successfully!');
            setIsContactModalOpen(false);
            setMessage('');
        } catch { toast.error('Failed to send message'); }
        finally { setSending(false); }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-14 h-14 border-[4px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                    <p className="text-muted-foreground font-medium">Loading instructor profile...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { instructor } = data;
    const courses = data.courses || [];

    return (
        <div className="min-h-screen bg-background">
            {/* Contact Modal */}
            {isContactModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsContactModalOpen(false)}>
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Mail size={20} className="text-indigo-600" /> Contact {instructor.name}
                            </h3>
                            <button onClick={() => setIsContactModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleSendMessage} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Your Message</label>
                                <textarea required rows={5}
                                    placeholder="I'm interested in your courses and have a question about..."
                                    value={message} onChange={e => setMessage(e.target.value)}
                                    className="w-full px-5 py-4 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsContactModalOpen(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={sending || !message.trim()}
                                    className="flex-[2] bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2">
                                    {sending ? 'Sending...' : <><Send size={16} /> Send Message</>}
                                </button>
                            </div>
                            <p className="text-[11px] text-center text-muted-foreground/60 font-medium italic">
                                * The instructor will receive this as an in-app notification
                            </p>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Hero Section ── */}
            <div className="relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-400/10 via-transparent to-transparent" />
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute -bottom-32 left-1/2 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-white/60 hover:text-white mb-8 text-sm font-medium transition-all group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back
                    </button>

                    <div className="flex flex-col lg:flex-row gap-10 items-start">
                        {/* Avatar + Info */}
                        <div className="flex-shrink-0">
                            <div className="relative group">
                                {instructor.avatar ? (
                                    <img src={instructor.avatar} alt={instructor.name}
                                        className="w-36 h-36 lg:w-44 lg:h-44 rounded-3xl object-cover shadow-2xl border-4 border-white/20 transition-transform duration-500 group-hover:scale-[1.02]" />
                                ) : (
                                    <div className="w-36 h-36 lg:w-44 lg:h-44 rounded-3xl shadow-2xl border-4 border-white/20 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.02]">
                                        <span className="text-white text-6xl font-extrabold">{instructor.name?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white p-2.5 rounded-xl shadow-lg border-2 border-white/20">
                                    <Award size={22} />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-5">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tight">{instructor.name}</h1>
                                <span className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/30 backdrop-blur-sm">
                                    <BadgeCheck size={12} className="inline mr-1" /> Verified Instructor
                                </span>
                            </div>

                            <p className="text-lg text-white/70 leading-relaxed max-w-2xl">
                                {instructor.bio || "Passionate educator dedicated to sharing knowledge and helping students reach their full potential."}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                <StatCard icon={BookOpen} label="Courses" value={courses.length} color="indigo" />
                                <StatCard icon={Users} label="Followers" value={followerCount.toLocaleString()} color="emerald" />
                                <StatCard icon={Star} label="Rating" value={instructor.rating || '4.8'} color="amber" />
                                <StatCard icon={Calendar} label="Joined" value={new Date(instructor.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} color="violet" />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 min-w-[220px]">
                            <button onClick={handleFollow} disabled={actionLoading}
                                className={`w-full px-6 py-3.5 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${following
                                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                                    : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 shadow-indigo-500/25'}`}>
                                {following ? <><Heart size={18} className="fill-rose-400 text-rose-400" /> Following</> : 'Follow Instructor'}
                            </button>
                            <button onClick={() => setIsContactModalOpen(true)}
                                className="w-full bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95">
                                <Mail size={18} /> Contact
                            </button>
                            <div className="flex gap-2">
                                <button onClick={handleShare} title="Share Profile"
                                    className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 p-3 rounded-xl transition-all flex justify-center active:scale-90">
                                    <Share2 size={18} className="text-white/70" />
                                </button>
                                <button onClick={() => window.open('https://youtube.com', '_blank')}
                                    className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 p-3 rounded-xl transition-all flex justify-center active:scale-90">
                                    <Film size={18} className="text-white/70" />
                                </button>
                                <button onClick={() => window.open('https://edunexus.com', '_blank')}
                                    className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 p-3 rounded-xl transition-all flex justify-center active:scale-90">
                                    <Globe size={18} className="text-white/70" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Courses Section ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                            Courses by {instructor.name}
                        </h2>
                        <p className="text-muted-foreground text-sm font-medium mt-1">
                            <span className="text-indigo-600 font-bold">{courses.length}</span> high-quality courses
                        </p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => <CourseCard key={course.id} course={course} />)}
                </div>

                {courses.length === 0 && (
                    <div className="text-center py-24 bg-card border-2 border-dashed border-border rounded-[40px]">
                        <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={32} className="text-muted-foreground/30" />
                        </div>
                        <h3 className="text-2xl font-black text-foreground mb-2">No courses yet</h3>
                        <p className="text-muted-foreground font-medium">This instructor hasn't published any courses yet. Check back soon!</p>
                    </div>
                )}
            </div>
        </div>
    );
}