import { useState, useRef, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

const pageTransitionVariants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } },
};

// ─── Swipe Gesture Hook ─────────────────────────────────────────────────────
// Tracks touch start position and detects horizontal swipes on mobile
function useSwipeGesture({ onSwipeLeft, onSwipeRight, enabled }) {
    const touchStart = useRef(null);

    const handleTouchStart = useCallback((e) => {
        if (!enabled) return;
        touchStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now(),
        };
    }, [enabled]);

    const handleTouchEnd = useCallback((e) => {
        if (!enabled || !touchStart.current) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        const dt = Date.now() - touchStart.current.time;

        // Only horizontal swipes, quick gestures (<300ms or >30px distance)
        if (Math.abs(dx) > Math.abs(dy) * 1.5 && (dt < 300 || Math.abs(dx) > 30)) {
            const startX = touchStart.current.x;
            touchStart.current = null;
            if (dx > 50 && onSwipeRight) onSwipeRight(startX);
            else if (dx < -50 && onSwipeLeft) onSwipeLeft(dx);
        } else {
            touchStart.current = null;
        }
    }, [enabled, onSwipeLeft, onSwipeRight]);

    return { handleTouchStart, handleTouchEnd };
}

export function DashboardLayout() {
    const { isAuthenticated } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    // Swipe from edge to open sidebar on mobile
    const edgeSwipe = useSwipeGesture({
        enabled: !mobileOpen,
        onSwipeRight: (startX) => {
            // Only open if swiping from near the left edge
            if (startX < 40) setMobileOpen(true);
        },
        onSwipeLeft: () => {},
    });

    // Swipe on open sidebar overlay to close
    const closeSwipe = useSwipeGesture({
        enabled: mobileOpen,
        onSwipeLeft: () => setMobileOpen(false),
        onSwipeRight: () => {},
    });

    // Close sidebar on route change (navigation)
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-background transition-colors duration-300">
            <Navbar onMobileMenuClick={() => setMobileOpen(true)} />

            {/* Overlay backdrop — also supports swipe to close */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-all duration-300 animate-in fade-in"
                    onClick={() => setMobileOpen(false)}
                    onTouchStart={closeSwipe.handleTouchStart}
                    onTouchEnd={closeSwipe.handleTouchEnd}
                />
            )}

            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(c => !c)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            <main
                onTouchStart={edgeSwipe.handleTouchStart}
                onTouchEnd={edgeSwipe.handleTouchEnd}
                className={`pt-16 min-h-screen transition-all duration-300 ease-in-out ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}
            >
                <div className="p-4 sm:p-5 md:p-6 lg:p-8 max-w-full overflow-x-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            variants={pageTransitionVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

export function PublicLayout() {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="pt-16">
                <Outlet />
            </main>
        </div>
    );
}
