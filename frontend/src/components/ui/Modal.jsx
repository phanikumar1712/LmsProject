import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Modal – reusable dialog with backdrop, ESC-to-close, body scroll lock, and
 * size variants. Rendered through a portal so it escapes any stacking context.
 *
 * @param {boolean} open
 * @param {() => void} [onClose]
 * @param {string} [title]
 * @param {string} [subtitle]
 * @param {'sm'|'md'|'lg'|'xl'} [size]
 * @param {React.ReactNode} children
 * @param {React.ReactNode} [footer] - optional footer row (e.g. action buttons)
 * @param {boolean} [hideClose]      - hide the X button (use for confirmations)
 */
export function Modal({
    open,
    onClose,
    title,
    subtitle,
    size = 'md',
    children,
    footer,
    hideClose = false,
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div className={`bg-card w-full ${sizes[size]} border border-border shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col`}>
                {(title || subtitle || !hideClose) && (
                    <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 flex-shrink-0">
                        <div className="min-w-0">
                            {title && <h3 className="text-xl font-extrabold text-foreground tracking-tight">{title}</h3>}
                            {subtitle && <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>}
                        </div>
                        {!hideClose && (
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors flex-shrink-0" aria-label="Close">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        )}
                    </div>
                )}
                <div className="p-6 overflow-y-auto flex-1">{children}</div>
                {footer && <div className="p-6 pt-0 flex-shrink-0">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}
