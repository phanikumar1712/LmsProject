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
    const { isAuthenticated, user } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    const [bannerDismissed, setBannerDismissed] = useState(false);

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

    // Close sidebar on route change (navigation) — intentional external-system
    // sync (location), so the direct state write is fine here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const handleMobileMenuClick = useCallback(() => setMobileOpen(true), []);
    const handleOverlayClose = useCallback(() => setMobileOpen(false), []);
    const handleToggleCollapse = useCallback(() => setCollapsed(c => !c), []);
    const handleSidebarMobileClose = useCallback(() => setMobileOpen(false), []);

    if (!isAuthenticated) return null;

    const showPasswordBanner = !bannerDismissed && user?.mustChangePassword && user?.role !== 'ADMIN' && location.pathname !== '/profile';

    return (
        <div className="min-h-screen bg-background transition-colors duration-300">
            <Navbar onMobileMenuClick={handleMobileMenuClick} />

            {/* Overlay backdrop — also supports swipe to close */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-all duration-300 animate-in fade-in"
                    onClick={handleOverlayClose}
                    onTouchStart={closeSwipe.handleTouchStart}
                    onTouchEnd={closeSwipe.handleTouchEnd}
                />
            )}

            <Sidebar
                collapsed={collapsed}
                onToggle={handleToggleCollapse}
                mobileOpen={mobileOpen}
                onMobileClose={handleSidebarMobileClose}
            />

            {/* Forced password change banner — set when an admin force-resets
                the account password (must_change_password flag).
                Admins are excluded: their passwords are managed exclusively by
                the Super Admin, so this banner is only for students/instructors. */}
            {showPasswordBanner && (
                <div
                    className={`fixed z-30 bg-amber-500 text-white text-sm font-bold shadow-lg ${collapsed ? 'md:ml-16' : 'md:ml-64'} ml-0 right-0 left-0 top-16 flex items-center justify-between px-4 py-2.5`}
                >
                    <a href="/profile" className="flex items-center gap-2 hover:underline">
                        <span>🔒 An administrator reset your password — please set a new one to continue.</span>
                        <span className="underline underline-offset-2">Change password now</span>
                    </a>
                    <button
                        onClick={() => setBannerDismissed(true)}
                        className="p-1 rounded-full hover:bg-amber-600/80 transition-colors text-white focus:outline-none"
                        title="Dismiss alert"
                        aria-label="Close notification"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <main
                onTouchStart={edgeSwipe.handleTouchStart}
                onTouchEnd={edgeSwipe.handleTouchEnd}
                className={`pt-16 min-h-screen transition-all duration-300 ease-in-out ${collapsed ? 'md:ml-16' : 'md:ml-64'} ${showPasswordBanner ? 'pt-24' : ''}`}
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
