import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

/**
 * ConfirmDialog – destructive/generic confirmation dialog built on Modal.
 * Replaces ad-hoc window.confirm() calls with an on-brand, accessible dialog.
 *
 * @param {boolean} open
 * @param {string} [title]
 * @param {React.ReactNode} [message]
 * @param {string} [confirmLabel]
 * @param {string} [cancelLabel]
 * @param {boolean} [danger]   - rose styling + destructive confirm (default true)
 * @param {boolean} [loading]  - disables buttons while an async action runs
 * @param {() => void} [onConfirm]
 * @param {() => void} [onCancel]
 */
export function ConfirmDialog({
    open,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = true,
    loading = false,
    onConfirm,
    onCancel,
}) {
    return (
        <Modal open={open} onClose={loading ? undefined : onCancel} size="sm" hideClose>
            <div className="text-center">
                <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${danger ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                    <AlertTriangle size={26} className={danger ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'} />
                </div>
                <h3 className="text-lg font-extrabold text-foreground tracking-tight">{title}</h3>
                {message && (
                    <div className="text-sm text-muted-foreground mt-2 font-medium leading-relaxed">{message}</div>
                )}
            </div>
            <div className="flex gap-3 mt-6">
                <button
                    onClick={onCancel}
                    disabled={loading}
                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                    {cancelLabel}
                </button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    className={`flex-1 px-6 py-3 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${danger
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                    {loading && <Loader2 size={15} className="animate-spin" />}
                    {loading ? 'Working...' : confirmLabel}
                </button>
            </div>
        </Modal>
    );
}
