/**
 * ChartTooltip – universal recharts custom tooltip used across all analytics pages.
 *
 * @param {boolean} active
 * @param {object[]} payload
 * @param {string} label
 * @param {string} [prefix]  - value prefix
 * @param {string} [suffix]  - value suffix, e.g. 'students'
 */
export function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border shadow-xl rounded-xl px-4 py-3 text-sm">
            {label && <p className="text-muted-foreground font-medium mb-1">{label}</p>}
            {payload.map((p, i) => (
                <p key={i} className="font-bold" style={{ color: p.color || p.fill || '#4f46e5' }}>
                    {p.name && <span className="text-muted-foreground font-normal mr-1">{p.name}:</span>}
                    {prefix}
                    {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                    {suffix && ` ${suffix}`}
                </p>
            ))}
        </div>
    );
}

/**
 * ChartCard – wrapper card for a recharts chart.
 *
 * @param {string} title
 * @param {React.ReactNode} [badge]  - Optional badge/label in the top-right
 * @param {string} [height]          - Tailwind height class for the chart area, default 'h-[260px]'
 * @param {React.ReactNode} children - The ResponsiveContainer / chart
 * @param {string} [className]
 */
export function ChartCard({ title, badge, height = 'h-[240px] sm:h-[260px]', children, className = '' }) {
    return (
        <div className={`bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm ${className}`}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-foreground font-bold text-base sm:text-lg">{title}</h3>
                {badge}
            </div>
            <div className={height}>{children}</div>
        </div>
    );
}
