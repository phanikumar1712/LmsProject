export function ProgressBar({ value, className = '', showLabel = false, color = 'primary' }) {
    const colors = {
        primary: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
        success: 'linear-gradient(90deg, #22c55e, #16a34a)',
        warning: 'linear-gradient(90deg, #f59e0b, #d97706)',
        danger: 'linear-gradient(90deg, #ef4444, #dc2626)',
    };

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="progress-bar flex-1">
                <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: colors[color] || colors.primary }}
                />
            </div>
            {showLabel && (
                <span className="text-xs font-semibold text-gray-400 w-8 text-right">{value}%</span>
            )}
        </div>
    );
}
