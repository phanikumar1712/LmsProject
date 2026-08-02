/**
 * PageHeader – consistent page title block used across all dashboard pages.
 *
 * @param {string} title          - Main heading
 * @param {string} [subtitle]     - Optional subtext
 * @param {React.ReactNode} [action] - Optional right-side action node (button/link)
 * @param {boolean} [border]      - Add a bottom border (admin-style)
 * @param {string} [className]
 */
export function PageHeader({ title, subtitle, action, border = false, className = '' }) {
    return (
        <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${border ? 'border-b border-border pb-5' : ''} ${className}`}
        >
            <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">{title}</h1>
                {subtitle && <p className="text-muted-foreground mt-1 font-medium text-sm sm:text-base">{subtitle}</p>}
            </div>
            {action && <div className="flex items-center gap-4 shrink-0 flex-wrap">{action}</div>}
        </div>
    );
}

/**
 * SectionHeader – smaller heading used inside dashboard sections.
 *
 * @param {string} title           - Section title
 * @param {React.ReactNode} [icon] - Optional icon before title
 * @param {React.ReactNode} [link] - Optional right-side link/action
 * @param {string} [className]
 */
export function SectionHeader({ title, icon, link, className = '' }) {
    return (
        <div className={`flex items-center justify-between mb-4 ${className}`}>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                {icon}
                {title}
            </h2>
            {link}
        </div>
    );
}
