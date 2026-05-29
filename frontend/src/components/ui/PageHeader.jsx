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
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${border ? 'border-b border-slate-200 pb-6' : ''} ${className}`}
        >
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
                {subtitle && <p className="text-slate-500 mt-1 font-medium">{subtitle}</p>}
            </div>
            {action && <div className="flex items-center gap-4">{action}</div>}
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
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {icon}
                {title}
            </h2>
            {link}
        </div>
    );
}
