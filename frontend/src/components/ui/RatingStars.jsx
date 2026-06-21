import { Star, StarHalf } from 'lucide-react';

export function RatingStars({ rating, size = 14, interactive = false, onRate, max = 5 }) {
    const numericRating = Number(rating) || 0;
    const stars = Array.from({ length: max }, (_, i) => i + 1);

    if (interactive) {
        return (
            <div className="flex items-center gap-0.5">
                {stars.map(star => (
                    <Star
                        key={star}
                        size={size}
                        className={`star cursor-pointer transition-all hover:scale-110 ${star <= numericRating ? 'text-amber-400' : 'text-muted-foreground/30'}`}
                        fill={star <= numericRating ? 'currentColor' : 'none'}
                        onClick={() => onRate?.(star)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-0.5">
            {stars.map(star => (
                <Star
                    key={star}
                    size={size}
                    className={star <= Math.round(numericRating) ? 'text-amber-400' : 'text-muted-foreground/30'}
                    fill={star <= Math.round(numericRating) ? 'currentColor' : 'none'}
                />
            ))}
        </div>
    );
}

export function RatingDisplay({ rating, count }) {
    const numericRating = Number(rating) || 0;
    return (
        <div className="flex items-center gap-1.5">
            <RatingStars rating={numericRating} size={13} />
            <span className="text-amber-400 font-bold text-sm tracking-tight">{numericRating.toFixed(1)}</span>
            {count !== undefined && count !== null && (
                <span className="text-muted-foreground/60 text-xs font-medium">({Number(count).toLocaleString()})</span>
            )}
        </div>
    );
}
