import { useState, useEffect } from 'react';

// Theme preference — persisted in localStorage (key shared with Navbar) and
// applied as the `dark` class on <html>.
export default function useDarkMode() {
    const [dark, setDark] = useState(() => {
        try {
            const saved = localStorage.getItem('lms_dark_mode');
            if (saved !== null) return saved === 'true';
        } catch { /* noop */ }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        try { localStorage.setItem('lms_dark_mode', String(dark)); } catch { /* noop */ }
    }, [dark]);

    return [dark, () => setDark(d => !d)];
}
