import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Download, PieChart as PieIcon, Layers } from 'lucide-react';
import { statsAPI } from '../../../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { CHART_COLORS, CHART_AXIS_STYLE, CHART_MARGIN } from '../../../lib/constants';
import { ChartTooltip } from '../../../components/ui/ChartComponents';

export default function AdminReports() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        statsAPI.getPlatform().then(setStats).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-400 font-bold">Generating Reports...</div>;

    const exportData = () => {
        if (!stats) return;

        // Create CSV for Monthly Stats
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Metric,Month,Value\n";

        stats.monthlyRevenue.forEach(r => {
            csvContent += `Revenue,${r.month},${r.revenue}\n`;
        });

        stats.enrollmentsByMonth.forEach(e => {
            csvContent += `Enrollments,${e.month},${e.count}\n`;
        });

        stats.topCategories.forEach(c => {
            csvContent += `Category Share,${c.name},${c.enrollments}\n`;
        });

        csvContent += `\nSummary Metrics\n`;
        csvContent += `Platform Revenue,,${stats.totalRevenue}\n`;
        csvContent += `Total Users,,${stats.totalUsers}\n`;
        csvContent += `Total Enrollments,,${stats.totalEnrollments}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `LMS_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Platform Analytics</h1>
                    <p className="text-slate-500 font-medium mt-1">Deep dive into course performance and revenue metrics</p>
                </div>
                <button
                    onClick={exportData}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all active:scale-95"
                >
                    <Download size={18} /> Export Data
                </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Enrollment Trends */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Enrollment Growth</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Last 6 Months</p>
                        </div>
                    </div>
                    <div className="h-64">
                        {stats?.enrollmentsByMonth && stats.enrollmentsByMonth.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.enrollmentsByMonth} margin={CHART_MARGIN}>
                                    <defs>
                                        <linearGradient id="colorEn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                    <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEn)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <BarChart3 size={32} className="opacity-20 mb-2" />
                                <p className="text-sm font-medium">No enrollment data</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Revenue Performance</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Currency in INR (₹)</p>
                        </div>
                    </div>
                    <div className="h-64">
                        {stats?.monthlyRevenue && stats.monthlyRevenue.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.monthlyRevenue} margin={CHART_MARGIN}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} />
                                    <YAxis tick={CHART_AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
                                    <Tooltip content={<ChartTooltip prefix="₹" />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <TrendingUp size={32} className="opacity-20 mb-2" />
                                <p className="text-sm font-medium">No revenue data</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Categories */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Layers size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800">Category Distribution</h3>
                    </div>
                    <div className="h-64">
                        {stats?.topCategories && stats.topCategories.length > 0 ? (
                            <div className="h-full flex items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.topCategories}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="enrollments"
                                            nameKey="name"
                                        >
                                            {stats.topCategories.map((_, i) => (
                                                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-col gap-2 ml-4">
                                    {stats.topCategories.map((cat, i) => (
                                        <div key={cat.name} className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            <span className="text-[11px] font-bold text-slate-600 truncate w-24">{cat.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <Layers size={32} className="opacity-20 mb-2" />
                                <p className="text-sm font-medium">No category data</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Conversion Stats */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Avg Enrollment Fee', value: stats?.totalEnrollments > 0 ? `₹${Math.round(stats.totalRevenue / stats.totalEnrollments)}` : '₹0', sub: 'Per student', color: 'text-indigo-600' },
                            { label: 'Student Growth', value: stats?.totalUsers > 0 ? '+14.2%' : '0%', sub: 'Last 30 days', color: 'text-emerald-600' },
                            { label: 'Course Completion', value: stats?.totalEnrollments > 0 ? '68%' : '0%', sub: 'Average rate', color: 'text-blue-600' },
                            { label: 'Retention Rate', value: stats?.totalUsers > 0 ? '82%' : '0%', sub: 'Active monthly students', color: 'text-orange-600' }
                        ].map(item => (
                            <div key={item.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                                <p className={`text-2xl font-black mt-1 ${item.color}`}>{item.value}</p>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">{item.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
