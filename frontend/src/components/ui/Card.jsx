/**
 * Card – the standard white rounded card used everywhere in the dashboards.
 *
 * @param {React.ReactNode} children
 * @param {string} [className]  - Extra classes (e.g. "p-8" to override default padding)
 * @param {boolean} [noPadding] - Skip default padding (useful when nesting tables)
 * @param {string} [accentColor] - If provided, renders a left accent bar with this css color
 * @param {() => void} [onClick] - If provided, renders as a clickable button (full detail page nav)
 * @param {string} [title]      - Optional tooltip when clickable
 */
export function Card({ children, className = '', noPadding = false, accentColor, onClick, title }) {
    const Tag = onClick ? 'button' : 'div';
    const interactive = onClick ? 'text-left w-full cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30' : '';
    return (
        <Tag
            onClick={onClick}
            title={title}
            type={onClick ? 'button' : undefined}
            className={`bg-card border border-border rounded-2xl shadow-sm relative overflow-hidden ${noPadding ? '' : 'p-6'} ${interactive} ${className}`}
        >
            {accentColor && (
                <div
                    className="absolute top-0 left-0 w-1.5 h-full"
                    style={{ backgroundColor: accentColor }}
                />
            )}
            {children}
        </Tag>
    );
}

/**
 * CardHeader – title row inside a Card.
 */
export function CardHeader({ title, icon, right, className = '' }) {
    return (
        <div className={`flex items-center justify-between mb-6 ${className}`}>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {icon}
                {title}
            </h3>
            {right}
        </div>
    );
}

/**
 * MetricRow – key/value row used for simple stat lists inside cards.
 */
export function MetricRow({ label, value, valueClassName = '' }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">{label}</span>
            <span className={`font-bold text-foreground ${valueClassName}`}>{value}</span>
        </div>
    );
}
