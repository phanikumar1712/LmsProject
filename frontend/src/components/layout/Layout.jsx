import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

export function DashboardLayout() {
    const { isAuthenticated } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar onMobileMenuClick={() => setMobileOpen(true)} />

            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-all duration-300"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(c => !c)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            <main
                className={`pt-16 min-h-screen transition-all duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}
            >
                <div className="p-4 md:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export function PublicLayout() {
    return (
        <div className="min-h-screen">
            <Navbar />
            <main className="pt-16">
                <Outlet />
            </main>
        </div>
    );
}
