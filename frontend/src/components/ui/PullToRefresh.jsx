import { useState, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronDown, Loader2 } from 'lucide-react';

const THRESHOLD = 80; // px to trigger refresh
const MAX_PULL = 150; // max pull distance

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
    const [pulling, setPulling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const controls = useAnimation();

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || refreshing) return;
        setRefreshing(true);
        setPullDistance(0);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
            controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
        }
    }, [onRefresh, refreshing, controls]);

    const handleDragEnd = useCallback(async (_, info) => {
        if (disabled || refreshing) return;
        // Check that we're scrolled to the top
        if (window.scrollY > 0) {
            controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
            return;
        }
        if (info.offset.y > THRESHOLD) {
            controls.start({
                y: 60,
                transition: { type: 'spring', stiffness: 400, damping: 28 },
            });
            await handleRefresh();
        } else {
            controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
        }
    }, [disabled, refreshing, controls, handleRefresh]);

    const handleDrag = useCallback((_, info) => {
        if (disabled || refreshing) return;
        if (window.scrollY > 0) return;
        if (info.offset.y > 0) {
            const resisted = Math.min(info.offset.y * 0.5, MAX_PULL);
            setPulling(true);
            setPullDistance(resisted);
        }
    }, [disabled, refreshing]);

    const progress = Math.min(pullDistance / THRESHOLD, 1);
    const ready = pullDistance >= THRESHOLD;

    return (
        <div className="relative overflow-hidden">
            {/* Pull indicator */}
            <motion.div
                className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10"
                animate={controls}
                initial={{ y: -60 }}
                style={{ top: 0, height: 60 }}
            >
                <div className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                    ready
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                        : 'text-muted-foreground/60'
                }`}>
                    {refreshing ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Refreshing...
                        </>
                    ) : ready ? (
                        <>
                            <ChevronDown size={16} className="animate-bounce" />
                            Release to refresh
                        </>
                    ) : (
                        <>
                            <motion.div
                                animate={{ rotate: pulling ? 180 * progress : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown size={16} />
                            </motion.div>
                            <span className="text-xs">Pull to refresh</span>
                        </>
                    )}
                </div>
            </motion.div>

            {/* Draggable content — Framer Motion drag handles both touch & pointer */}
            <motion.div
                drag={disabled || refreshing ? false : 'y'}
                dragDirectionLock
                dragConstraints={{ top: 0, bottom: MAX_PULL }}
                dragElastic={0.3}
                onDragEnd={handleDragEnd}
                onDrag={handleDrag}
                animate={controls}
                className="relative"
                style={{ touchAction: 'pan-x' }}
            >
                {children}
            </motion.div>
        </div>
    );
}
