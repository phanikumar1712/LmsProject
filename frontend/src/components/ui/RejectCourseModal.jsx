import { useState } from 'react';
import { X, AlertTriangle, FileText, XCircle } from 'lucide-react';

/**
 * Modal for rejecting a course or moving it back to Draft.
 *
 * Props:
 *   course       – the course object (must have .id and .title)
 *   open         – boolean, whether the modal is visible
 *   onClose      – () => void
 *   onReject     – async (courseId, reason) => void   — called when "Reject" is clicked
 *   onMoveToDraft – async (courseId, reason) => void   — called when "Move to Draft" is clicked
 */
export default function RejectCourseModal({ course, open, onClose, onReject, onMoveToDraft }) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!open || !course) return null;

    const handleReject = async () => {
        if (!reason.trim()) return;
        setSubmitting(true);
        try {
            await onReject(course.id, reason.trim());
            setReason('');
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    const handleMoveToDraft = async () => {
        if (!reason.trim()) return;
        setSubmitting(true);
        try {
            await onMoveToDraft(course.id, reason.trim());
            setReason('');
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-rose-50/50 dark:bg-rose-950/20">
                    <h3 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                        <AlertTriangle size={20} className="text-rose-600" /> Review Course
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X size={20} className="text-muted-foreground" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    <div className="bg-muted/40 border border-border rounded-2xl p-4">
                        <p className="text-sm font-bold text-foreground truncate">{course.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Instructor: {course.instructorName || '—'} · Status: {course.status}
                        </p>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 block">
                            Reason *
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full bg-card border border-border text-foreground rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-rose-100 outline-none shadow-sm transition-shadow min-h-[120px] resize-y placeholder:text-muted-foreground/60"
                            placeholder="Explain why this course needs changes. The instructor will see this message..."
                            autoFocus
                        />
                        {!reason.trim() && (
                            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1.5">
                                A reason is required so the instructor knows what to fix.
                            </p>
                        )}
                    </div>

                    {/* Action hint */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                            <strong>Reject</strong> marks the course as rejected — the instructor must resubmit.
                            <br />
                            <strong>Move to Draft</strong> sends it back quietly so the instructor can edit and resubmit without the "Rejected" label.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMoveToDraft}
                        disabled={!reason.trim() || submitting}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm"
                    >
                        <FileText size={16} /> {submitting ? 'Saving...' : 'Move to Draft'}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={!reason.trim() || submitting}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm"
                    >
                        <XCircle size={16} /> {submitting ? 'Saving...' : 'Reject'}
                    </button>
                </div>
            </div>
        </div>
    );
}
