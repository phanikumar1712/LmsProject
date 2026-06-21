import { useState, useEffect } from 'react';
import { MessageSquare, Reply } from 'lucide-react';
import { ratingsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { RatingDisplay } from '../../../components/ui/RatingStars';
import toast from 'react-hot-toast';

export default function InstructorReviews() {
    const { user } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);

    useEffect(() => {
        ratingsAPI.getByInstructor(user.id)
            .then((data) => {
                setReviews(
                    (data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                );
            })
            .catch(() => toast.error('Failed to load reviews'))
            .finally(() => setLoading(false));
    }, [user.id]);

    const handleReplySubmit = async (reviewId) => {
        if (!replyText.trim()) return;
        try {
            const updated = await ratingsAPI.replyToReview(reviewId, replyText);
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, instructorReply: updated.instructorReply } : r));
            setReplyingTo(null);
            setReplyText('');
            toast.success('Reply posted');
        } catch {
            toast.error('Failed to post reply');
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading reviews...</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-extrabold text-foreground">Student Reviews</h1>
                <p className="text-muted-foreground text-sm font-medium mt-1">Respond to feedback on your courses</p>
            </div>

            {reviews.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">No reviews yet on your courses.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map(review => (
                        <div key={review.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    {review.studentAvatar ? (
                                        <img src={review.studentAvatar} alt="" className="w-10 h-10 rounded-full bg-muted object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-sm font-bold">{review.studentName?.charAt(0)?.toUpperCase()}</span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-foreground text-sm">{review.studentName}</p>
                                        <p className="text-xs text-muted-foreground">{review.courseTitle || 'Course'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <RatingDisplay rating={review.stars} size={14} />
                                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                                    </p>
                                </div>
                            </div>
                            <p className="text-foreground/80 text-sm leading-relaxed mb-4">{review.comment}</p>

                            {review.instructorReply && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-700 rounded-xl p-4 mb-4">
                                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Your reply</p>
                                    <p className="text-sm text-foreground/80">{review.instructorReply}</p>
                                </div>
                            )}

                            {replyingTo === review.id ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        className="w-full border border-border bg-background text-foreground rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-muted-foreground"
                                        placeholder="Write your reply..."
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleReplySubmit(review.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">Send Reply</button>
                                        <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-muted-foreground px-4 py-2 text-sm font-bold hover:text-foreground transition-colors">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setReplyingTo(review.id)}
                                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:text-indigo-700 transition-colors"
                                >
                                    <Reply size={16} /> Reply to review
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
