import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    BookOpen, Users, Star, ArrowLeft, Mail, Globe,
    ExternalLink, Play, Award, Calendar, X, Send
} from 'lucide-react';
import { usersAPI, notificationsAPI } from '../services/api';
import { RatingDisplay } from '../components/ui/RatingStars';
import toast from 'react-hot-toast';

export default function InstructorProfilePage() {
    const [id] = useParams().id.split('?'); // handle potential trailing chars
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [actionLoading, setActionLoading] = useState(false);

    // Contact Modal State
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
            .catch(err => {
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
        } catch (err) {
            toast.error(err.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Profile link copied to clipboard!');
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('lms_token');
        if (!token) {
            toast.error('Please login to contact the instructor');
            return;
        }

        setSending(true);
        try {
            // We use the notifications system to "send a message"
            await notificationsAPI.create({
                userId: id,
                message: `New message from a student regarding your profile: "${message}"`,
                type: 'message'
            });
            toast.success('Message sent successfully!');
            setIsContactModalOpen(false);
            setMessage('');
        } catch (err) {
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="w-32 h-32 bg-muted rounded-full" />
                    <div className="flex-1 space-y-4">
                        <div className="h-8 bg-muted rounded w-1/3" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                        <div className="h-24 bg-muted rounded w-full" />
                    </div>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Contact {instructor.name}</h3>
                            <button onClick={() => setIsContactModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleSendMessage} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Your Message</label>
                                <textarea
                                    required
                                    rows={5}
                                    placeholder="I'm interested in your courses and have a question about..."
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    className="w-full px-5 py-4 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsContactModalOpen(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending || !message.trim()}
                                    className="flex-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                                >
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

            {/* Header / Hero */}
            <div className="bg-card border-b border-border">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm font-medium transition-colors"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="relative group">
                            {instructor.avatar ? (
                                <img
                                    src={instructor.avatar}
                                    alt={instructor.name}
                                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-lg border-4 border-card transition-transform duration-500 group-hover:scale-[1.02]"
                                />
                            ) : (
                                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-lg border-4 border-card bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.02]">
                                    <span className="text-white text-5xl font-extrabold">{instructor.name?.charAt(0)?.toUpperCase()}</span>
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg border-2 border-card">
                                <Award size={20} />
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'Outfit' }}>{instructor.name}</h1>
                                <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-200/50">Top Instructor</span>
                            </div>

                            <p className="text-lg text-muted-foreground font-medium mb-6 max-w-2xl leading-relaxed">
                                {instructor.bio || "Passionate educator dedicated to sharing knowledge and helping students reach their full potential."}
                            </p>

                            <div className="flex flex-wrap gap-6 text-sm font-semibold">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <BookOpen size={18} className="text-indigo-500" />
                                    <span className="text-foreground font-extrabold">{courses.length}</span> Courses
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users size={18} className="text-indigo-500" />
                                    <span className="text-foreground font-extrabold">{followerCount.toLocaleString()}</span> Followers
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Star size={18} className="text-amber-400 fill-amber-400" />
                                    <span className="text-foreground font-extrabold">{instructor.rating || '4.8'}</span> Rating
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar size={18} className="text-indigo-500" />
                                    <span className="text-muted-foreground font-bold">Joined {new Date(instructor.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 min-w-[220px]">
                            <button
                                onClick={handleFollow}
                                disabled={actionLoading}
                                className={`w-full px-6 py-3.5 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${following ? 'bg-muted text-foreground hover:bg-muted/80' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}
                            >
                                {following ? 'Following' : 'Follow Instructor'}
                            </button>
                            <button
                                onClick={() => setIsContactModalOpen(true)}
                                className="w-full bg-card border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white px-6 py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 group"
                            >
                                <Mail size={18} className="group-hover:scale-110 transition-transform" /> Contact Instructor
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleShare}
                                    title="Share Profile"
                                    className="flex-1 bg-muted/30 border border-border hover:bg-muted hover:border-muted p-3 px-4 rounded-xl transition-all flex justify-center active:scale-90"
                                >
                                    <ExternalLink size={18} className="text-muted-foreground" />
                                </button>
                                <button
                                    onClick={() => window.open(`https://youtube.com/search?q=${instructor.name}`, '_blank')}
                                    className="flex-1 bg-muted/30 border border-border hover:bg-muted hover:border-muted p-3 px-4 rounded-xl transition-all flex justify-center active:scale-90"
                                >
                                    <Play size={18} className="text-muted-foreground" />
                                </button>
                                <button
                                    onClick={() => window.open('https://edunexus.com', '_blank')}
                                    className="flex-1 bg-muted/30 border border-border hover:bg-muted hover:border-muted p-3 px-4 rounded-xl transition-all flex justify-center active:scale-90"
                                >
                                    <Globe size={18} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Courses Section */}
            <div className="max-w-7xl mx-auto px-4 py-16">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight" style={{ fontFamily: 'Outfit' }}>Courses by {instructor.name}</h2>
                        <p className="text-muted-foreground text-sm font-medium mt-1 uppercase tracking-wider">{courses.length} high-quality courses found</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {courses.map(course => (
                        <Link
                            key={course.id}
                            to={`/courses/${course.id}`}
                            className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm hover:shadow-xl hover:border-indigo-500/20 transition-all duration-300 flex flex-col group"
                        >
                            <div className="relative aspect-video overflow-hidden">
                                <img
                                    src={course.thumbnail}
                                    alt={course.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4">
                                    <span className="bg-card/90 backdrop-blur-md text-foreground text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-widest shadow-sm border border-border">
                                        {course.level}
                                    </span>
                                </div>
                            </div>

                            <div className="p-7 flex flex-col flex-1">
                                <h3 className="text-lg font-black text-foreground mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">
                                    {course.title}
                                </h3>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground font-bold mb-6">
                                    <div className="flex items-center gap-1.5">
                                        <BookOpen size={14} className="text-indigo-500" /> {course.lessonsCount || 0} lessons
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Users size={14} className="text-indigo-500" /> {course.enrollmentCount?.toLocaleString()} students
                                    </div>
                                </div>

                                <div className="mt-auto pt-5 border-t border-border flex items-center justify-between">
                                    <RatingDisplay rating={course.rating} count={course.reviewCount} />
                                    <div className="text-xl font-black text-foreground">
                                        {course.price === 0 ? (
                                            <span className="text-emerald-600">Free</span>
                                        ) : (
                                            `₹${(course.discountPrice || course.price).toLocaleString()}`
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {courses.length === 0 && (
                    <div className="text-center py-24 bg-card rounded-[40px] border-2 border-border border-dashed">
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
