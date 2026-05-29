import { TrendingUp } from 'lucide-react';

/**
 * Reusable stat/KPI card component used across all dashboards.
 * 
 * @param {string} label       - Stat label text
 * @param {string|number} value - Stat value to display
 * @param {React.ElementType} icon  - Lucide icon component
 * @param {string} color       - Icon color (hex or tailwind text color)
 * @param {string} bg          - Icon background (tailwind bg class)
 * @param {string} [change]    - Optional change/trend text below the value
 * @param {boolean} [showTrend] - Show green TrendingUp badge (default false)
 * @param {string} [changeColor] - Override change text color (defaults to icon color)
 * @param {string} [className] - Extra wrapper classes
 */
export function StatCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
    change,
    showTrend = false,
    changeColor,
    className = '',
}) {
    return (
        <div
            className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow ${className}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
                    <Icon size={24} style={{ color }} />
                </div>
                {showTrend && (
                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">
                        <TrendingUp size={14} />
                    </div>
                )}
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1 tracking-tight">
                {value}
            </p>
            <p className="text-slate-500 text-sm font-medium">{label}</p>
            {change && (
                <p
                    className="text-[13px] font-medium mt-2"
                    style={{ color: changeColor ?? color }}
                >
                    {change}
                </p>
            )}
        </div>
    );
}

/**
 * Grid wrapper for a row of stat cards.
 * Defaults to 2 cols on mobile, 4 cols on lg.
 */
export function StatCardGrid({ children, cols = 4, className = '' }) {
    const colClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 lg:grid-cols-4',
    }[cols] ?? 'grid-cols-2 lg:grid-cols-4';

    return (
        <div className={`grid ${colClass} gap-6 ${className}`}>
            {children}
        </div>
    );
}

/** Skeleton placeholders while stats load */
export function StatCardSkeleton({ count = 4 }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl h-[120px] animate-pulse" />
            ))}
        </div>
    );
}
