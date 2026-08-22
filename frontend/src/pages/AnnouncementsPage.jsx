import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Pin, Users, Bell, AlertTriangle, Info, Calendar, ArrowUp, Eye, Tag, User, CheckCircle, EyeOff } from 'lucide-react';
import { announcementsAPI } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { PageHeader } from '../components/ui/PageHeader';

export default function AnnouncementsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const focusId = searchParams.get('focus');
    const focusRef = useRef(null);
    const [dismissedFocus, setDismissedFocus] = useState(false);
    const [readSet, setReadSet] = useState(new Set());
    const [showAll, setShowAll] = useState(false);

    const { data: announcements, loading } = useAsyncData(() => announcementsAPI.list(showAll), [showAll]);

    // Auto-mark focused announcement as read
    useEffect(() => {
        if (!focusId || !announcements?.length || dismissedFocus) return;
        const target = announcements.find(a => String(a.id) === focusId);
        if (!target) return;
        if (readSet.has(focusId)) return; // already marked

        announcementsAPI.markRead(focusId).catch(() => {});
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReadSet(prev => new Set(prev).add(focusId));
    }, [focusId, announcements, dismissedFocus, readSet]);

    useEffect(() => {
        if (!loading && focusId && focusRef.current && !dismissedFocus) {
            setTimeout(() => {
                focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }, [loading, focusId, announcements, dismissedFocus]);

    const clearFocus = () => {
        setDismissedFocus(true);
        setSearchParams({}, { replace: true });
    };

    // Pinned announcements first, then focused, then the rest
    const sorted = [...(announcements || [])].sort((a, b) => {
        if (String(a.id) === focusId) return -1;
        if (String(b.id) === focusId) return 1;
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
    });

    // Split focused from the rest for prominence
    const focusedAnn = !dismissedFocus && focusId
        ? sorted.find(a => String(a.id) === focusId)
        : null;
    const rest = focusedAnn ? sorted.filter(a => String(a.id) !== focusId) : sorted;

    const priorityIcon = (p) => {
        if (p === 'high') return <AlertTriangle size={14} className="text-rose-500" />;
        if (p === 'urgent') return <Bell size={14} className="text-red-500" />;
        return <Info size={14} className="text-blue-500" />;
    };

    const priorityColor = (p) => {
        if (p === 'high') return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400';
        if (p === 'urgent') return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400';
        return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400';
    };

    const priorityBg = (p) => {
        if (p === 'high') return 'bg-gradient-to-r from-rose-50 to-transparent dark:from-rose-950/30';
        if (p === 'urgent') return 'bg-gradient-to-r from-red-50 to-transparent dark:from-red-950/30';
        return 'bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/30';
    };

    const renderAnnouncement = (ann, isFocused) => {
        const isRead = readSet.has(String(ann.id));

        return (
            <div
                key={ann.id}
                ref={isFocused ? focusRef : null}
                className={`bg-card border rounded-2xl shadow-sm transition-all duration-500 ${
                    isFocused
                        ? 'border-indigo-400 ring-2 ring-indigo-500/30 shadow-xl scale-[1.02]'
                        : ann.pinned
                        ? 'border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20'
                        : isRead
                        ? 'border-border/80 hover:shadow-md'
                        : 'border-border hover:shadow-md'
                } ${isFocused ? priorityBg(ann.priority) : ''}`}
            >
                {/* Focused announcement hero banner */}
                {isFocused && (
                    <div className="bg-indigo-600 text-white px-6 py-3 rounded-t-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <Eye size={16} />
                            Focused Announcement
                        </div>
                        <button
                            onClick={clearFocus}
                            className="text-white/70 hover:text-white text-xs font-bold px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                <div className={`${isFocused ? 'p-6' : 'p-5'}`}>
                    {/* Meta row */}
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        {ann.pinned && (
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                                <Pin size={10} /> Pinned
                            </span>
                        )}
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider border flex items-center gap-1.5 ${priorityColor(ann.priority)}`}>
                            {priorityIcon(ann.priority)} {ann.priority}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(ann.createdAt || ann.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </span>
                        {/* Read status indicator */}
                        {isRead && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <CheckCircle size={10} /> Read
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className={`font-bold text-foreground mb-2 ${isFocused ? 'text-2xl' : 'text-lg'}`}>
                        {ann.title}
                    </h3>

                    {/* Content */}
                    <div className={`text-muted-foreground whitespace-pre-wrap leading-relaxed ${
                        isFocused ? 'text-[15px]' : 'text-sm'
                    }`}>
                        {ann.content}
                    </div>

                    {/* Footer meta */}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Users size={12} />
                            {(ann.target_roles || []).join(', ') || 'All'}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <User size={12} />
                            {ann.authorName || ann.author_name || 'Admin'}
                        </span>
                        {/* View count */}
                        <span className="flex items-center gap-1.5" title="Views">
                            <EyeOff size={12} />
                            {(ann.view_count || 0)} views
                        </span>
                        {ann.department_id && (
                            <span className="flex items-center gap-1.5">
                                <Tag size={12} />
                                Department
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
            <PageHeader
                title="Announcements"
                subtitle="Stay up to date with the latest news and updates."
            />

            {/* Target role filter */}
            <div className="flex items-center gap-4">
                <div className="bg-muted/40 border border-border rounded-xl p-0.5 flex items-center gap-0.5">
                    <button
                        onClick={() => setShowAll(false)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            !showAll
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        For Me
                    </button>
                    <button
                        onClick={() => setShowAll(true)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            showAll
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        All
                    </button>
                </div>
                <span className="text-xs text-muted-foreground">
                    {showAll ? 'Showing all announcements' : 'Showing announcements targeted to you'}
                </span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (announcements || []).length === 0 ? (
                <div className="text-center py-20 bg-muted/40 rounded-2xl border border-border border-dashed">
                    <Megaphone size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">No announcements yet</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">New announcements will appear here.</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Focused announcement (from notification) - shown prominently */}
                    {focusedAnn && renderAnnouncement(focusedAnn, true)}

                    {/* Quick count */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                        <span>{rest.length} announcement{rest.length !== 1 ? 's' : ''}</span>
                        {focusedAnn && (
                            <span className="flex items-center gap-1 text-indigo-600 font-bold">
                                <ArrowUp size={12} /> Focused
                            </span>
                        )}
                    </div>

                    {/* Rest of announcements */}
                    {rest.map(ann => renderAnnouncement(ann, false))}
                </div>
            )}
        </div>
    );
}
