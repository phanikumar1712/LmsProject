import { useState, useEffect } from 'react';
import { DollarSign, Search, Users, Eye, TrendingUp, BarChart2 } from 'lucide-react';
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
        revenue: c.price * c.enrollmentCount * 0.8, // 80% instructor cut mock
        students: c.enrollmentCount
    })).sort((a, b) => b.revenue - a.revenue);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <div className="bg-white border border-slate-200 shadow-md rounded-lg px-4 py-3 text-sm">
                    <p className="text-slate-500 font-bold mb-2">{payload[0].payload.fullTitle || label}</p>
                    {payload.map((p, i) => (
                        <p key={i} className="font-bold flex items-center gap-1" style={{ color: p.color }}>
                            {p.dataKey === 'revenue' ? `₹${p.value.toLocaleString()}` : p.value.toLocaleString()} {p.name}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Loading analytics...</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Analytics & Earnings</h1>
                <p className="text-slate-500 font-medium">Deep dive into your revenue and course performance</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center border border-emerald-200">
                                <DollarSign size={24} className="text-emerald-600" />
                            </div>
                            {stats?.thisMonth?.earnings > 0 && (
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">+₹{stats.thisMonth.earnings.toLocaleString()} New</span>
                            )}
                        </div>
                        <p className="text-slate-500 font-bold text-[13px] uppercase tracking-wider mb-1">Total Lifetime Earnings</p>
                        <p className="text-4xl font-black text-slate-900">₹{stats?.earnings?.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center border border-indigo-200">
                                <TrendingUp size={24} className="text-indigo-600" />
                            </div>
                            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">Active Month</span>
                        </div>
                        <p className="text-slate-500 font-bold text-[13px] uppercase tracking-wider mb-1">Current Month Earnings</p>
                        <p className="text-4xl font-black text-slate-900">₹{(stats?.thisMonth?.earnings || 0).toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center border border-cyan-200">
                                <Users size={24} className="text-cyan-600" />
                            </div>
                        </div>
                        <p className="text-slate-500 font-bold text-[13px] uppercase tracking-wider mb-1">Total Students Reach</p>
                        <p className="text-4xl font-black text-slate-900">{stats?.totalEnrollments?.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
                    <h2 className="text-slate-900 font-bold text-lg mb-6 flex items-center gap-2"><BarChart2 size={20} className="text-indigo-600" /> Revenue by Course</h2>
                    <div className="h-72">
                        {coursePerformanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={coursePerformanceData.slice(0, 5)} layout="vertical" margin={{ left: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                    <Bar dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <BarChart2 size={32} className="opacity-20" />
                                <p className="text-sm font-medium">No course revenue to show</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
                    <h2 className="text-slate-900 font-bold text-lg mb-6 flex items-center gap-2"><Users size={20} className="text-cyan-600" /> Enrollments Over Time</h2>
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="revenue" name="Students (x10 Proxy)" stroke="#0891b2" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
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
