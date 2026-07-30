import { useState, useEffect } from 'react';
import { Users, TrendingUp, BarChart2, Star } from 'lucide-react';
import { statsAPI, coursesAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';

export default function InstructorAnalytics() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            statsAPI.getInstructor(user.id),
            coursesAPI.getByInstructor(user.id)
        ]).then(([s, c]) => {
            setStats(s);
            setCourses(Array.isArray(c) ? c : []);
        }).finally(() => setLoading(false));
    }, [user.id]);

    const coursePerformanceData = courses.map(c => ({
        name: c.title.substring(0, 15) + '...',
        fullTitle: c.title,
        students: c.enrollmentCount
    })).sort((a, b) => b.students - a.students);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <div className="bg-card border border-border shadow-md rounded-lg px-4 py-3 text-sm">
                    <p className="text-muted-foreground font-bold mb-2">{payload[0].payload.fullTitle || label}</p>
                    {payload.map((p, i) => (
                        <p key={i} className="font-bold flex items-center gap-1" style={{ color: p.color }}>
                            {p.value.toLocaleString()} {p.name}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) return <div className="p-12 text-center text-muted-foreground font-medium">Loading analytics...</div>;

    const statItems = [
        {
            icon: Users, iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600', glow: 'bg-indigo-50 dark:bg-indigo-900/10',
            label: 'Total Students', value: stats?.totalEnrollments?.toLocaleString(),
        },
        {
            icon: TrendingUp, iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconColor: 'text-cyan-600', glow: 'bg-cyan-50 dark:bg-cyan-900/10',
            label: 'Total Courses', value: stats?.totalCourses,
        },
        {
            icon: Users, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600', glow: 'bg-emerald-50 dark:bg-emerald-900/10',
            label: 'Total Enrollments', value: stats?.totalEnrollments?.toLocaleString(),
        },
        {
            icon: Star, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-500', glow: 'bg-amber-50 dark:bg-amber-900/10',
            label: 'Average Course Rating', value: stats?.avgRating?.toFixed(1) || '0.0', fillIcon: true,
        },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">Analytics & Earnings</h1>
                <p className="text-muted-foreground font-medium">Deep dive into your revenue and course performance</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                {statItems.map(({ icon: Icon, iconBg, iconColor, glow, label, value, badge, badgeClass, fillIcon }) => (
                    <div key={label} className="bg-card border border-border shadow-sm rounded-2xl p-6 relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-32 h-32 ${glow} rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110`} />
                        <div className="relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
                                    <Icon size={24} className={iconColor} fill={fillIcon ? 'currentColor' : 'none'} />
                                </div>
                                {badge && <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${badgeClass}`}>{badge}</span>}
                            </div>
                            <p className="text-muted-foreground font-bold text-[13px] uppercase tracking-wider mb-1">{label}</p>
                            <p className="text-4xl font-black text-foreground">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-card border border-border shadow-sm rounded-2xl p-6">
                    <h2 className="text-foreground font-bold text-lg mb-6 flex items-center gap-2"><BarChart2 size={20} className="text-indigo-600" /> Students by Course</h2>
                    <div className="h-72">
                        {coursePerformanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={coursePerformanceData.slice(0, 5)} layout="vertical" margin={{ left: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                    {/* eslint-disable-next-line react-hooks/static-components */}
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="students" name="Students" fill="#0891b2" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 bg-muted/20 rounded-xl border border-dashed border-border">
                                <BarChart2 size={32} className="opacity-20" />
                                <p className="text-sm font-medium">No student data to show</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-card border border-border shadow-sm rounded-2xl p-6">
                    <h2 className="text-foreground font-bold text-lg mb-6 flex items-center gap-2"><Users size={20} className="text-cyan-600" /> Enrollments Over Time</h2>
                    <div className="h-72">
                        {stats?.monthlyEarnings && stats.monthlyEarnings.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.monthlyEarnings}>
                                    <defs>
                                        <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0891b2" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    {/* eslint-disable-next-line react-hooks/static-components */}
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="revenue" name="Students (x10 Proxy)" stroke="#0891b2" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 bg-muted/20 rounded-xl border border-dashed border-border">
                                <TrendingUp size={32} className="opacity-20" />
                                <p className="text-sm font-medium">No enrollment data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
