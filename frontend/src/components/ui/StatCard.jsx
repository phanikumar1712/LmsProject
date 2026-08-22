import { memo } from 'react';
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
 * @param {() => void} [onClick] - If provided, renders as a clickable button (navigates to detail page)
 */
export const StatCard = memo(function StatCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
    change,
    showTrend = false,
    changeColor,
    className = '',
    onClick,
}) {
    const Tag = onClick ? 'button' : 'div';
    const interactive = onClick ? 'text-left w-full cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30' : '';
    return (
        <Tag
            onClick={onClick}
            type={onClick ? 'button' : undefined}
            className={`bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group ${interactive} ${className}`}
        >
            <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-[0.03] dark:opacity-[0.07] pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <Icon size={80} />
            </div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${bg} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={20} style={{ color }} className="sm:hidden" />
                    <Icon size={24} style={{ color }} className="hidden sm:block" />
                </div>
                {showTrend && (
                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">
                        <TrendingUp size={14} />
                    </div>
                )}
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-1 tracking-tight break-words">
                {value}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">{label}</p>
            {change && (
                <p
                    className="text-[11px] sm:text-[13px] font-medium mt-1.5 sm:mt-2 truncate"
                    style={{ color: changeColor ?? color }}
                >
                    {change}
                </p>
            )}
        </Tag>
    );
});

/**
 * Grid wrapper for a row of stat cards.
 * Defaults to 2 cols on mobile, 4 cols on lg.
 */
export const StatCardGrid = memo(function StatCardGrid({ children, cols = 4, className = '' }) {
    const colClass = {
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-2 lg:grid-cols-4',
    }[cols] ?? 'grid-cols-2 lg:grid-cols-4';

    return (
        <div className={`grid ${colClass} gap-3 sm:gap-4 lg:gap-5 ${className}`}>
            {children}
        </div>
    );
});

/** Skeleton placeholders while stats load */
export function StatCardSkeleton({ count = 4 }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl h-[104px] sm:h-[120px] animate-pulse" />
            ))}
        </div>
    );
}
