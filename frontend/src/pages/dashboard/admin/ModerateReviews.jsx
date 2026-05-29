import { useState, useEffect } from 'react';
import { MessageSquare, Check, X, Star, ExternalLink, Filter, Trash2 } from 'lucide-react';
import { ratingsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export default function ModerateReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            const data = await ratingsAPI.getAll();
            setReviews(data);
        } catch (err) {
            toast.error("Cloud not load reviews");
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
        <div className="p-12 text-center text-slate-400 font-bold animate-pulse">
            <MessageSquare className="mx-auto mb-4 opacity-20" size={48} />
            Loading reviews...
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Review Moderation</h1>
                    <p className="text-slate-500 font-medium">Maintain platform quality by monitoring feedback</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['all', 'low', 'high'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Course Info</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rating</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Review</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReviews.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-slate-400">
                                        <Star size={40} className="mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">No reviews match your filters</p>
                                    </td>
                                </tr>
                            ) : filteredReviews.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden shadow-inner">
                                                {r.studentAvatar ? <img src={r.studentAvatar} className="w-full h-full object-cover" /> : r.studentName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm leading-none">{r.studentName}</p>
                                                <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-tight">{new Date(r.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline cursor-pointer">
                                            <span>#ID-{r.courseId}</span>
                                            <ExternalLink size={12} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-amber-500 gap-1 bg-amber-50 w-fit px-2.5 py-1 rounded-lg border border-amber-100">
                                            <span className="text-sm font-black">{r.stars}</span>
                                            <Star size={14} fill="currentColor" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600 line-clamp-2 max-w-sm italic">"{r.comment || 'No comment provided.'}"</p>
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
