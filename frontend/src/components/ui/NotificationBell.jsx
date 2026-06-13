import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { notificationsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS = {
    quiz_result: '📊',
    enrollment: '📚',
    certificate: '🏆',
    subscription: '💎',
    pending_course: '📋',
    review: '⭐',
    approval: '✅',
    report: '🚨',
    system: '⚙️',
};

export function NotificationBell() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState([]);
    const ref = useRef(null);

    useEffect(() => {
        if (!user) return;
        notificationsAPI.getByUser(user.id).then(setNotifs).catch(() => setNotifs([]));
    }, [user]);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const unread = notifs.filter(n => !n.read).length;

    const handleMarkRead = async (notif) => {
        await notificationsAPI.markRead(user.id, notif.id);
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        if (notif.link) { navigate(notif.link); setOpen(false); }
    };

    const handleMarkAll = async () => {
        await notificationsAPI.markAllRead(user.id);
        setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleClearAll = async () => {
        await notificationsAPI.clearAll();
        setNotifs([]);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="relative w-10 h-10 rounded-xl glass flex items-center justify-center hover:border-purple-500/40 transition-colors"
                aria-label="Notifications"
            >
                <Bell size={18} className="text-gray-300" />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center pulse-glow">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 w-80 glass-card shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <h3 className="font-semibold text-white text-sm">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unread > 0 && (
                                <button onClick={handleMarkAll} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                    <CheckCheck size={12} /> Mark read
                                </button>
                            )}
                            {notifs.length > 0 && (
                                <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 ml-2">
                                    <X size={12} /> Clear all
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white ml-2">
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {notifs.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 text-sm">No notifications</div>
                        ) : (
                            notifs.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleMarkRead(notif)}
                                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 ${!notif.read ? 'bg-purple-500/5' : ''}`}
                                >
                                    <span className="text-lg flex-shrink-0">{TYPE_ICONS[notif.type] || '🔔'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs leading-relaxed ${notif.read ? 'text-gray-400' : 'text-white'}`}>{notif.message}</p>
                                        <p className="text-gray-600 text-[10px] mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    {!notif.read && <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-1" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
