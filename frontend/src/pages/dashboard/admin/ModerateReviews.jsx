import { useState, useEffect } from 'react';
import { MessageSquare, Star, Trash2 } from 'lucide-react';
import { ratingsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export default function ModerateReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        // eslint-disable-next-line react-hooks/immutability
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            const data = await ratingsAPI.getAll();
            setReviews(data);
        } catch {
            toast.error("Could not load reviews");
        } finally {
            setLoading(false);
        }
    };

    const removeReview = async (id) => {
        if (!window.confirm("Delete this review permanently?")) return;
        try {
            await ratingsAPI.delete(id);
            setReviews(prev => prev.filter(r => r.id !== id));
            toast.success("Review deleted");
        } catch {
            toast.error("Failed to delete review");
        }
    };

    const filteredReviews = reviews.filter(r => {
        if (filter === 'low') return r.stars <= 2;
        if (filter === 'high') return r.stars >= 4;
        return true;
    });

    if (loading) return (
        <div className="p-12 text-center text-muted-foreground/60 font-bold animate-pulse">
            <MessageSquare className="mx-auto mb-4 opacity-20" size={48} />
            Loading reviews...
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Review Moderation</h1>
                    <p className="text-muted-foreground font-medium">Maintain platform quality by monitoring feedback</p>
                </div>

                <div className="flex bg-muted p-1 rounded-xl">
                    {['all', 'low', 'high'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-muted/40 border-b border-border">
                            <tr>
                                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Student</th>
                                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Course Info</th>
                                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Rating</th>
                                <th className="hidden sm:table-cell px-3 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Review</th>
                                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredReviews.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-muted-foreground/60">
                                        <Star size={40} className="mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">No reviews match your filters</p>
                                    </td>
                                </tr>
                            ) : filteredReviews.map(r => (
                                <tr key={r.id} className="hover:bg-muted/40/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-bold overflow-hidden shadow-inner">
                                                {r.studentAvatar ? <img src={r.studentAvatar} className="w-full h-full object-cover" /> : r.studentName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground text-sm leading-none">{r.studentName}</p>
                                                <p className="text-[11px] text-muted-foreground/60 font-medium mt-1 uppercase tracking-tight">{new Date(r.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-foreground max-w-xs truncate" title={r.courseTitle}>
                                            {r.courseTitle || `#${String(r.courseId).slice(0, 8)}…`}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-amber-500 gap-1 bg-amber-50 w-fit px-2.5 py-1 rounded-lg border border-amber-100">
                                            <span className="text-sm font-black">{r.stars}</span>
                                            <Star size={14} fill="currentColor" />
                                        </div>
                                    </td>
                                    <td className="hidden sm:table-cell px-6 py-4">
                                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-sm italic">"{r.comment || 'No comment provided.'}"</p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => removeReview(r.id)}
                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all hover:scale-110 active:scale-95"
                                            title="Delete Review"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
