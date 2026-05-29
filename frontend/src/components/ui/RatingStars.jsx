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
                        className={`star cursor-pointer transition-colors ${star <= numericRating ? 'text-yellow-400' : 'text-gray-600'}`}
                        fill={star <= numericRating ? '#facc15' : 'none'}
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
                    className={star <= Math.round(numericRating) ? 'text-yellow-400' : 'text-gray-600'}
                    fill={star <= Math.round(numericRating) ? '#facc15' : 'none'}
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
            <span className="text-yellow-400 font-semibold text-sm">{numericRating.toFixed(1)}</span>
            {count !== undefined && count !== null && (
                <span className="text-gray-500 text-xs">({Number(count).toLocaleString()})</span>
            )}
        </div>
    );
}
