import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ThumbsUp, CheckCircle, Trash2, Send, ChevronDown, ChevronUp, Award, Lock } from 'lucide-react';
import { discussionsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function DiscussionSection({ courseId }) {
    const { user } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [asking, setAsking] = useState(false);
    const [showAskForm, setShowAskForm] = useState(false);
    const [expandedQs, setExpandedQs] = useState({});
    const [answers, setAnswers] = useState({});
    const [loadingAnswers, setLoadingAnswers] = useState({});
    const [newAnswers, setNewAnswers] = useState({});
    const [submittingAnswer, setSubmittingAnswer] = useState({});
    const [accessDenied, setAccessDenied] = useState(false);

    const loadQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await discussionsAPI.getQuestions(courseId);
            setQuestions(data || []);
            setAccessDenied(false);
        } catch (err) {
            // 403 = the backend's course-access guard (not enrolled / not the
            // course's instructor / out of the admin's department) — show a
            // clear notice instead of a silently-empty section.
            setAccessDenied(err?.status === 403);
            setQuestions([]);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);

    const toggleExpand = async (qId) => {
        const next = !expandedQs[qId];
        setExpandedQs(prev => ({ ...prev, [qId]: next }));
        if (next && !answers[qId]) {
            setLoadingAnswers(prev => ({ ...prev, [qId]: true }));
            try {
                const data = await discussionsAPI.getAnswers(qId);
                setAnswers(prev => ({ ...prev, [qId]: data || [] }));
            } catch {
                toast.error('Failed to load answers');
            } finally {
                setLoadingAnswers(prev => ({ ...prev, [qId]: false }));
            }
        }
    };

    const handleAsk = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            toast.error('Title and content are required');
            return;
        }
        setAsking(true);
        try {
            await discussionsAPI.createQuestion({ courseId, title: newTitle, content: newContent });
            toast.success('Question posted! 💬');
            setNewTitle('');
            setNewContent('');
            setShowAskForm(false);
            loadQuestions();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setAsking(false);
        }
    };

    const handleDeleteQuestion = async (id) => {
        if (!window.confirm('Delete this question? All answers will also be removed.')) return;
        try {
            await discussionsAPI.deleteQuestion(id);
            toast.success('Question deleted');
            setQuestions(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleAnswer = async (qId) => {
        const content = newAnswers[qId]?.trim();
        if (!content) { toast.error('Answer content is required'); return; }
        setSubmittingAnswer(prev => ({ ...prev, [qId]: true }));
        try {
            await discussionsAPI.createAnswer(qId, content);
            toast.success('Answer posted!');
            setNewAnswers(prev => ({ ...prev, [qId]: '' }));
            // Reload answers
            const data = await discussionsAPI.getAnswers(qId);
            setAnswers(prev => ({ ...prev, [qId]: data || [] }));
            // Reload questions to update answer count
            loadQuestions();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmittingAnswer(prev => ({ ...prev, [qId]: false }));
        }
    };

    const handleUpvote = async (answerId, qId) => {
        try {
            const result = await discussionsAPI.toggleUpvote(answerId);
            // Reload answers
            const data = await discussionsAPI.getAnswers(qId);
            setAnswers(prev => ({ ...prev, [qId]: data || [] }));
            toast.success(result.upvoted ? 'Upvoted! ⬆️' : 'Upvote removed');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleBestAnswer = async (answerId, qId) => {
        try {
            await discussionsAPI.markBestAnswer(answerId);
            toast.success('Marked as best answer 🏆');
            const data = await discussionsAPI.getAnswers(qId);
            setAnswers(prev => ({ ...prev, [qId]: data || [] }));
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDeleteAnswer = async (answerId, qId) => {
        if (!window.confirm('Delete this answer?')) return;
        try {
            await discussionsAPI.deleteAnswer(answerId);
            toast.success('Answer deleted');
            const data = await discussionsAPI.getAnswers(qId);
            setAnswers(prev => ({ ...prev, [qId]: data || [] }));
            loadQuestions();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const isInstructorOrAdmin = user && ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <MessageSquare size={20} className="text-indigo-500" />
                        Discussion Q&A
                    </h3>
                    <p className="text-muted-foreground text-sm font-medium mt-1">
                        Ask questions and get help from instructors and peers
                    </p>
                </div>
                {user && !accessDenied && (
                    <button
                        onClick={() => setShowAskForm(!showAskForm)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        <MessageSquare size={16} />
                        {showAskForm ? 'Cancel' : 'Ask a Question'}
                    </button>
                )}
            </div>

            {accessDenied ? (
                <div className="text-center py-16 bg-muted/20 rounded-2xl border border-border border-dashed">
                    <Lock size={40} className="text-muted-foreground/20 mx-auto mb-4" />
                    <h4 className="font-bold text-foreground mb-1">Discussion not available</h4>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        This course's discussion is only available to enrolled students and the course instructor.
                    </p>
                </div>
            ) : (
                <>
                    {/* Ask Form */}
                    {showAskForm && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                    <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Summarize your question..."
                        className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="Provide details about your question..."
                        rows={4}
                        className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleAsk}
                            disabled={asking}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                            <Send size={16} />
                            {asking ? 'Posting...' : 'Post Question'}
                        </button>
                    </div>
                </div>
            )}

            {/* Questions List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-card border border-border rounded-2xl p-6 animate-pulse">
                            <div className="h-5 w-3/4 bg-muted rounded-lg mb-3" />
                            <div className="h-4 w-full bg-muted rounded-lg mb-2" />
                            <div className="h-4 w-2/3 bg-muted rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : questions.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 rounded-2xl border border-border border-dashed">
                    <MessageSquare size={48} className="text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium pb-2">No questions yet.</p>
                    <p className="text-muted-foreground/60 text-sm">Be the first to ask a question about this course!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {questions.map(q => (
                        <div key={q.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            {/* Question Header */}
                            <div className="p-6 cursor-pointer" onClick={() => toggleExpand(q.id)}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <img
                                            src={q.studentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(q.studentName || '?')}&background=6366f1&color=fff&size=40`}
                                            alt={q.studentName}
                                            className="w-10 h-10 rounded-full bg-muted flex-shrink-0 object-cover"
                                        />
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-foreground text-[15px]">{q.title}</h4>
                                            <p className="text-muted-foreground text-xs font-medium mt-1.5 flex items-center gap-2">
                                                <span className="text-indigo-600 font-semibold">{q.studentName}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold">{q.answerCount || 0} answers</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {(user?.id === q.studentId || isInstructorOrAdmin) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id); }}
                                                className="p-1.5 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        {expandedQs[q.id] ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                                    </div>
                                </div>
                                {expandedQs[q.id] && (
                                    <p className="text-muted-foreground text-sm mt-4 pl-14 leading-relaxed">{q.content}</p>
                                )}
                            </div>

                            {/* Answers Section */}
                            {expandedQs[q.id] && (
                                <div className="border-t border-border bg-muted/20">
                                    {/* Answers */}
                                    <div className="px-6 py-4 space-y-4">
                                        {loadingAnswers[q.id] ? (
                                            <div className="text-center py-8">
                                                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                                            </div>
                                        ) : answers[q.id]?.length > 0 ? (
                                            answers[q.id].map(a => (
                                                <div key={a.id} className={`bg-card border rounded-xl p-4 ${a.isBestAnswer ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200' : 'border-border'}`}>
                                                    <div className="flex items-start gap-3">
                                                        <img
                                                            src={a.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.userName || '?')}&background=8b5cf6&color=fff&size=32`}
                                                            alt={a.userName}
                                                            className="w-8 h-8 rounded-full bg-muted flex-shrink-0 object-cover mt-0.5"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm text-foreground">{a.userName}</span>
                                                                {a.userRole === 'INSTRUCTOR' && (
                                                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Instructor</span>
                                                                )}
                                                                {['ADMIN', 'SUPER_ADMIN'].includes(a.userRole) && (
                                                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Admin</span>
                                                                )}
                                                                {a.isBestAnswer && (
                                                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                                                        <CheckCircle size={10} /> Best Answer
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-muted-foreground/60">{new Date(a.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.content}</p>
                                                            <div className="flex items-center gap-3 mt-3">
                                                                <button
                                                                    onClick={() => handleUpvote(a.id, q.id)}
                                                                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-indigo-600 transition-colors"
                                                                >
                                                                    <ThumbsUp size={14} />
                                                                    <span>{a.upvoteCount || 0}</span>
                                                                </button>
                                                                {isInstructorOrAdmin && !a.isBestAnswer && (
                                                                    <button
                                                                        onClick={() => handleBestAnswer(a.id, q.id)}
                                                                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                                                                    >
                                                                        <Award size={14} /> Mark Best Answer
                                                                    </button>
                                                                )}
                                                                {(user?.id === a.userId || isInstructorOrAdmin) && (
                                                                    <button
                                                                        onClick={() => handleDeleteAnswer(a.id, q.id)}
                                                                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-rose-500 transition-colors"
                                                                    >
                                                                        <Trash2 size={12} /> Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-muted-foreground/70 text-sm py-4 font-medium">No answers yet. Be the first to answer!</p>
                                        )}
                                    </div>

                                    {/* Answer Form */}
                                    {user && (
                                        <div className="px-6 py-4 border-t border-border bg-card/40">
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={newAnswers[q.id] || ''}
                                                    onChange={e => setNewAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    placeholder="Write your answer..."
                                                    className="flex-1 bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                />
                                                <button
                                                    onClick={() => handleAnswer(q.id)}
                                                    disabled={submittingAnswer[q.id]}
                                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-60 flex items-center gap-1.5"
                                                >
                                                    <Send size={15} />
                                                    {submittingAnswer[q.id] ? '...' : 'Reply'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
                </>
            )}
        </div>
    );
}
