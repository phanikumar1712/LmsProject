import { useState, useMemo } from 'react';
import {
    BarChart3, TrendingUp, BookOpen, Users, Star,
    AlertTriangle, Lightbulb, Target, Activity, Zap, RefreshCw,
    Building2, CheckCircle2, GraduationCap
} from 'lucide-react';
import { statsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer } from '../../../components/ui/Feedback';

const priorityColors = {
    high: 'bg-rose-100 text-rose-700 border-rose-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
};
const priorityLabels = { high: 'High Priority', medium: 'Medium', low: 'Low' };
const insightIcons = {
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Lightbulb,
    metric: BarChart3,
};

export default function AIAnalytics() {
    const { data: report, loading, reload } = useAsyncData(
        () => statsAPI.getAiReport(),
        []
    );

    const [activeTab, setActiveTab] = useState('overview');

    const topInsight = useMemo(() => {
        if (!report?.insights?.length) return null;
        return report.insights.find(i => i.type === 'warning' || i.type === 'success') || report.insights[0];
    }, [report]);

    if (loading) {
        return (
            <div className="space-y-6 max-w-6xl">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <BarChart3 size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">AI Analytics</h1>
                        <p className="text-muted-foreground font-medium mt-0.5">Generating platform intelligence...</p>
                    </div>
                </div>
                <LoadingContainer height="h-96" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="space-y-6 max-w-6xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <BarChart3 size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">AI Analytics</h1>
                            <p className="text-muted-foreground font-medium mt-0.5">No data available yet</p>
                        </div>
                    </div>
                    <button onClick={reload} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors">
                        <RefreshCw size={16} /> Generate Report
                    </button>
                </div>
                <div className="bg-card border border-border rounded-3xl p-16 text-center">
                    <BarChart3 size={64} className="text-muted-foreground/20 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground">Insufficient Data</h3>
                    <p className="text-muted-foreground text-sm mt-1">Add courses and get some enrollments to see AI-powered insights.</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { key: 'overview', label: 'Overview', icon: BarChart3 },
        { key: 'insights', label: 'Insights', icon: Lightbulb },
        { key: 'courses', label: 'Top Courses', icon: BookOpen },
        { key: 'departments', label: 'Departments', icon: Building2 },
        { key: 'recommendations', label: 'Recommendations', icon: Target },
    ];

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg animate-pulse">
                        <Zap size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                            AI Analytics
                            <span className="text-[10px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Beta</span>
                        </h1>
                        <p className="text-muted-foreground font-medium mt-0.5">
                            Data-driven insights · Generated {new Date(report.generatedAt).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={reload} className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-xl font-bold text-sm transition-colors border border-border">
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: report.platform?.total_users?.toLocaleString() || '0', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
                    { label: 'Published Courses', value: report.platform?.published_courses?.toLocaleString() || '0', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                    { label: 'Enrollments', value: report.platform?.total_enrollments?.toLocaleString() || '0', icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/10' },
                    { label: 'Instructors', value: report.platform?.total_instructors?.toLocaleString() || report.usersByRole?.find(r => r.role === 'INSTRUCTOR')?.count?.toLocaleString() || '0', icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} border border-border rounded-2xl p-4 shadow-sm`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center`}>
                                <s.icon size={16} className={s.color} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">{s.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Top Insight Banner */}
            {topInsight && (() => {
                const TopIcon = insightIcons[topInsight.type] || Lightbulb;
                const iconClass = topInsight.type === 'warning' ? 'text-amber-600' : topInsight.type === 'success' ? 'text-emerald-600' : 'text-indigo-600 flex-shrink-0 mt-0.5';
                return (
                    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
                        topInsight.type === 'warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/20' :
                        topInsight.type === 'success' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/20' :
                        'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-900/20'
                    }`}>
                        <TopIcon size={20} className={iconClass} />
                        <div className="flex-1">
                            <p className="font-extrabold text-foreground text-sm">{topInsight.title}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{topInsight.detail}</p>
                        </div>
                        <span className="text-2xl font-black text-foreground">{topInsight.value}</span>
                    </div>
                );
            })()}

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl border border-border overflow-x-auto">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === t.key ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}>
                        <t.icon size={15} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* 30-day growth */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="font-extrabold text-foreground mb-4 flex items-center gap-2 text-sm">
                            <TrendingUp size={16} className="text-indigo-500" /> Last 30 Days
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'New Users', value: report.period?.last30Days?.newUsers || 0, icon: Users },
                                { label: 'New Courses', value: report.period?.last30Days?.newCourses || 0, icon: BookOpen },
                                { label: 'New Enrollments', value: report.period?.last30Days?.newEnrollments || 0, icon: Activity },
                                { label: 'Active Users', value: report.period?.last30Days?.activeUsers?.toLocaleString() || report.period?.last30Days?.newUsers?.toLocaleString() || '0', icon: Users },
                            ].map(item => (
                                <div key={item.label} className="bg-muted/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <item.icon size={14} className="text-muted-foreground/60" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{item.label}</span>
                                    </div>
                                    <p className="text-xl font-black text-foreground">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Users by Role */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="font-extrabold text-foreground mb-4 flex items-center gap-2 text-sm">
                            <Users size={16} className="text-indigo-500" /> Users by Role
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {report.usersByRole?.map((r, i) => {
                                const colors = [
                                    { bg: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-500' },
                                    { bg: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
                                    { bg: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
                                    { bg: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' },
                                ];
                                const total = report.platform?.total_users || 1;
                                const pct = Math.round((r.count / total) * 100);
                                return (
                                    <div key={r.role} className="bg-muted/30 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${colors[i]?.bg || 'bg-muted text-muted-foreground'}`}>
                                                {r.role}
                                            </span>
                                            <span className="text-lg font-black text-foreground">{r.count.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${colors[i]?.bar || 'bg-muted-foreground/30'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/60 font-medium mt-1">{pct}% of total</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* All Insights Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {report.insights?.filter(i => i !== topInsight).map((insight, idx) => {
                            const Icon = insightIcons[insight.type] || Lightbulb;
                            return (
                                <div key={idx} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-indigo-200 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            insight.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                            insight.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                            'bg-indigo-50 text-indigo-600'
                                        }`}>
                                            <Icon size={20} />
                                        </div>
                                        <span className="text-xl font-black text-foreground">{insight.value}</span>
                                    </div>
                                    <h4 className="font-extrabold text-foreground text-sm mb-1">{insight.title}</h4>
                                    <p className="text-xs text-muted-foreground font-medium">{insight.detail}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'insights' && (
                <div className="space-y-4">
                    {report.insights?.length > 0 ? report.insights.map((insight, idx) => {
                        const Icon = insightIcons[insight.type] || Lightbulb;
                        return (
                            <div key={idx} className={`bg-card border rounded-2xl p-5 shadow-sm ${
                                insight.type === 'warning' ? 'border-amber-200 dark:border-amber-900/20' :
                                insight.type === 'success' ? 'border-emerald-200 dark:border-emerald-900/20' :
                                'border-border'
                            }`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            insight.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                            insight.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                            'bg-indigo-50 text-indigo-600'
                                        }`}>
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-foreground">{insight.title}</h4>
                                            <p className="text-sm text-muted-foreground mt-0.5">{insight.detail}</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-black text-foreground flex-shrink-0 ml-4">{insight.value}</span>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="bg-card border border-border rounded-2xl p-12 text-center">
                            <Lightbulb size={48} className="text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No insights available yet. Generate a report with more data.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'courses' && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-border bg-muted/20">
                        <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
                            <BookOpen size={16} className="text-indigo-500" /> Top 5 Courses by Enrollment
                        </h3>
                    </div>
                    <div className="divide-y divide-border">
                        {report.topCourses?.map((course, idx) => (
                            <div key={idx} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                                <span className="text-lg font-black text-muted-foreground/40 w-6">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground text-sm truncate">{course.title}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">by {course.instructor}</p>
                                </div>
                                <div className="flex items-center gap-3 text-xs font-bold">
                                    <span className="flex items-center gap-1 text-indigo-600"><Activity size={12} /> {course.enrollments}</span>
                                    <span className="flex items-center gap-1 text-amber-600"><Star size={12} /> {course.rating || '—'}</span>
                                    <span className="text-muted-foreground">{course.reviews} reviews</span>
                                </div>
                            </div>
                        ))}
                        {(!report.topCourses || report.topCourses.length === 0) && (
                            <div className="p-12 text-center text-muted-foreground font-medium">No course data available</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'departments' && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-border bg-muted/20">
                        <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm">
                            <Building2 size={16} className="text-indigo-500" /> Department Performance
                        </h3>
                    </div>
                    <div className="divide-y divide-border">
                        {report.departments?.map((dept, idx) => (
                            <div key={dept.name} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-muted-foreground/40 w-6">{idx + 1}</span>
                                        <span className="font-extrabold text-foreground text-sm">{dept.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-foreground">
                                        {dept.enrollments?.toLocaleString() || 0} enrolled
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 ml-8">
                                    <div className="text-xs">
                                        <span className="text-muted-foreground/60 font-medium">{dept.users} Users</span>
                                    </div>
                                    <div className="text-xs">
                                        <span className="text-muted-foreground/60 font-medium">{dept.courses} Courses</span>
                                    </div>
                                    <div className="text-xs">
                                        <span className="text-muted-foreground/60 font-medium">{dept.enrollments} Enrollments</span>
                                    </div>
                                </div>
                                {/* Performance bar */}
                                {report.departments.length > 1 && (
                                    <div className="ml-8 mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                                            style={{ width: `${Math.min(100, Math.round((dept.enrollments / (report.departments[0]?.enrollments || 1)) * 100))}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                        {(!report.departments || report.departments.length === 0) && (
                            <div className="p-12 text-center text-muted-foreground font-medium">No department data available</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'recommendations' && (
                <div className="space-y-4">
                    {report.recommendations?.length > 0 ? (
                        report.recommendations.map((rec, idx) => (
                            <div key={idx} className={`bg-card border rounded-2xl p-5 shadow-sm ${
                                rec.priority === 'high' ? 'border-l-4 border-l-rose-500 border-border' :
                                rec.priority === 'medium' ? 'border-l-4 border-l-amber-500 border-border' :
                                'border-l-4 border-l-blue-500 border-border'
                            }`}>
                                <div className="flex items-start gap-3">
                                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${priorityColors[rec.priority] || 'bg-muted text-muted-foreground'}`}>
                                        {priorityLabels[rec.priority]}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-extrabold text-foreground text-sm">{rec.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-1 font-medium">{rec.detail}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-card border border-border rounded-2xl p-12 text-center">
                            <Target size={48} className="text-muted-foreground/20 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No recommendations yet. More data will generate actionable suggestions.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-muted-foreground/40 font-medium py-4">
                AI Analytics generates insights from your platform data. No external AI service is used — all insights are computed directly from your database.
            </div>
        </div>
    );
}
