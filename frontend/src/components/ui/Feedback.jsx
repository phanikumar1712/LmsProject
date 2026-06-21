/**
 * Spinner – centered loading spinner.
 *
 * @param {string} [size]    - 'sm' | 'md' (default) | 'lg'
 * @param {string} [className]
 */
export function Spinner({ size = 'md', className = '' }) {
    const dim = { sm: 'w-5 h-5 border-[3px]', md: 'w-8 h-8 border-4', lg: 'w-12 h-12 border-4' }[size];
    return (
        <div className={`${dim} border-indigo-200 border-t-indigo-600 rounded-full animate-spin ${className}`} />
    );
}

/**
 * LoadingContainer – centers a Spinner vertically in a fixed-height area.
 *
 * @param {string} [height] - Tailwind height class, default 'h-64'
 */
export function LoadingContainer({ height = 'h-64', size = 'md' }) {
    return (
        <div className={`flex items-center justify-center ${height}`}>
            <Spinner size={size} />
        </div>
    );
}

/**
 * EmptyState – "no data" placeholder block.
 *
 * @param {React.ElementType} icon  - Lucide icon
 * @param {string} message          - Primary message
 * @param {React.ReactNode} [action] - Optional CTA button/link
 * @param {string} [className]
 */
export function EmptyState({ icon: Icon, message, action, className = '' }) {
    return (
        <div className={`bg-card border border-border border-dashed rounded-2xl p-12 text-center ${className}`}>
            {Icon && <Icon size={48} className="text-muted-foreground/30 mx-auto mb-4" />}
            <p className="text-muted-foreground font-medium text-lg mb-6">{message}</p>
            {action}
        </div>
    );
}

/**
 * Badge – inline label badge.
 *
 * @param {string} variant   - 'success' | 'warning' | 'danger' | 'info' | 'neutral'
 * @param {React.ReactNode} children
 * @param {string} [className]
 */
export function Badge({ variant = 'neutral', children, className = '' }) {
    const variants = {
        success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
        warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
        danger: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
        info: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
        cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
        neutral: 'bg-muted text-muted-foreground',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${variants[variant] ?? variants.neutral} ${className}`}>
            {children}
        </span>
    );
}

/**
 * StatusBadge – maps LMS status strings to a colored badge automatically.
 */
export function StatusBadge({ status }) {
    const map = {
        PUBLISHED: 'success',
        APPROVED: 'success',
        ACTIVE: 'success',
        PENDING: 'warning',
        DRAFT: 'neutral',
        REJECTED: 'danger',
        SUSPENDED: 'danger',
        COMPLETED: 'info',
    };
    return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>;
}
