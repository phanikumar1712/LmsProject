import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumbs – navigation trail. The last item renders as the current page.
 *
 * @param {{ label: string, to?: string }[]} items
 * @param {string} [className]
 */
export function Breadcrumbs({ items = [], className = '' }) {
    return (
        <nav className={`flex items-center gap-1.5 text-xs font-bold flex-wrap ${className}`} aria-label="Breadcrumb">
            {items.map((item, i) => {
                const last = i === items.length - 1;
                return (
                    <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && <ChevronRight size={14} className="text-muted-foreground/50" />}
                        {item.to && !last ? (
                            <Link to={item.to} className="text-muted-foreground hover:text-indigo-600 transition-colors">
                                {item.label}
                            </Link>
                        ) : (
                            <span className={last ? 'text-foreground' : 'text-muted-foreground'}>
                                {item.label}
                            </span>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
