/**
 * Card – the standard white rounded card used everywhere in the dashboards.
 *
 * @param {React.ReactNode} children
 * @param {string} [className]  - Extra classes (e.g. "p-8" to override default padding)
 * @param {boolean} [noPadding] - Skip default padding (useful when nesting tables)
 * @param {string} [accentColor] - If provided, renders a left accent bar with this css color
 */
export function Card({ children, className = '', noPadding = false, accentColor }) {
    return (
        <div
            className={`bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden ${noPadding ? '' : 'p-6'} ${className}`}
        >
            {accentColor && (
                <div
                    className="absolute top-0 left-0 w-1.5 h-full"
                    style={{ backgroundColor: accentColor }}
                />
            )}
            {children}
        </div>
    );
}

/**
 * CardHeader – title row inside a Card.
 */
export function CardHeader({ title, icon, right, className = '' }) {
    return (
        <div className={`flex items-center justify-between mb-6 ${className}`}>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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
            <span className="text-slate-600 font-medium">{label}</span>
            <span className={`font-bold ${valueClassName}`}>{value}</span>
        </div>
    );
}
