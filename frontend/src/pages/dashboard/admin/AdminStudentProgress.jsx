import { useState } from 'react';
import { Search, BarChart3, TrendingUp, Award, GraduationCap, Activity, ChevronDown } from 'lucide-react';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardHeader } from '../../../components/ui/Card';
import { UserCell } from '../../../components/ui/DataTable';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { StatCard, StatCardGrid } from '../../../components/ui/StatCard';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getToken = () => localStorage.getItem('lms_token');

const http = async (method, path) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
};

export default function AdminStudentProgress() {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('lastActive');
    const [expandedStudent, setExpandedStudent] = useState(null);

    const { data, loading } = useAsyncData(() => http('GET', '/stats/students/progress?limit=500'), []);

    const students = (data?.data || []).filter(s =>
        !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNo?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
        switch (sortBy) {
            case 'name': return a.name?.localeCompare(b.name);
            case 'progress': return b.avgProgress - a.avgProgress;
            case 'courses': return b.enrolledCourses - a.enrolledCourses;
            case 'quizScore': return (b.avgQuizScore || 0) - (a.avgQuizScore || 0);
            case 'lastActive':
            default: return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
        }
    });

    const totalStudents = students.length;
    const avgProgressAll = totalStudents > 0 ? Math.round(students.reduce((s, st) => s + st.avgProgress, 0) / totalStudents) : 0;
    const completedCourses = students.reduce((s, st) => s + st.completedCourses, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inactiveCount = students.filter(s => !s.lastActive || new Date(s.lastActive) < thirtyDaysAgo).length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Student Progress Dashboard"
                subtitle="Track student engagement, course completion, and performance metrics."
            />

            <StatCardGrid cols={4}>
                <StatCard label="Total Students" value={totalStudents} icon={GraduationCap} color="#4f46e5" bg="bg-indigo-50" />
                <StatCard label="Avg Progress" value={`${avgProgressAll}%`} icon={TrendingUp} color="#0891b2" bg="bg-cyan-50" />
                <StatCard label="Completed Courses" value={completedCourses} icon={Award} color="#059669" bg="bg-emerald-50" />
                <StatCard label="Inactive (30d)" value={inactiveCount} icon={Activity} color="#dc2626" bg="bg-rose-50" />
            </StatCardGrid>

            <Card>
                <CardHeader
                    title="Student Performance"
                    icon={<BarChart3 size={18} className="text-indigo-500" />}
                    right={
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search students..."
                                    className="pl-8 pr-3 py-2 bg-card border border-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
                                />
                            </div>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="px-3 py-2 bg-card border border-border rounded-lg text-xs font-bold outline-none cursor-pointer"
                            >
                                <option value="lastActive">Last Active</option>
                                <option value="name">Name</option>
                                <option value="progress">Progress</option>
                                <option value="courses">Courses</option>
                                <option value="quizScore">Quiz Score</option>
                            </select>
                        </div>
                    }
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/60 border-y border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Student</th>
                                <th className="px-6 py-4">Roll No</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Courses</th>
                                <th className="px-6 py-4">Avg Progress</th>
                                <th className="px-6 py-4">Avg Quiz</th>
                                <th className="px-6 py-4">Last Active</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : students.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground font-medium">No students found</td>
                                </tr>
                            ) : students.map(student => (
                                <>
                                    <tr key={student.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}>
                                        <td className="px-6 py-4">
                                            <UserCell name={student.name} email={student.email} avatar={student.avatar} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2.5 py-1 rounded-lg">
                                                {student.rollNo || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground font-medium">{student.departmentName || '—'}</td>
                                        <td className="px-6 py-4 font-bold">{student.enrolledCourses}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <ProgressBar value={student.avgProgress} color={student.avgProgress >= 70 ? 'success' : student.avgProgress >= 40 ? 'warning' : 'danger'} className="flex-1 max-w-[120px]" />
                                                <span className={`text-xs font-bold ${student.avgProgress >= 70 ? 'text-emerald-600' : student.avgProgress >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                    {student.avgProgress}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold ${(student.avgQuizScore || 0) >= 70 ? 'text-emerald-600' : (student.avgQuizScore || 0) >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                {student.avgQuizScore ? `${student.avgQuizScore}%` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs font-medium">
                                            {student.lastActive ? new Date(student.lastActive).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expandedStudent === student.id ? 'rotate-180' : ''} inline`} />
                                        </td>
                                    </tr>
                                    {expandedStudent === student.id && (
                                        <tr className="bg-muted/20">
                                            <td colSpan={8} className="px-6 py-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                                                    <div className="bg-card border border-border rounded-xl p-4 text-center">
                                                        <p className="text-2xl font-black text-indigo-600">{student.enrolledCourses}</p>
                                                        <p className="text-xs font-bold text-muted-foreground">Enrolled</p>
                                                    </div>
                                                    <div className="bg-card border border-border rounded-xl p-4 text-center">
                                                        <p className="text-2xl font-black text-emerald-600">{student.completedCourses}</p>
                                                        <p className="text-xs font-bold text-muted-foreground">Completed</p>
                                                    </div>
                                                    <div className="bg-card border border-border rounded-xl p-4 text-center">
                                                        <p className="text-2xl font-black text-amber-600">{student.quizAttempts || 0}</p>
                                                        <p className="text-xs font-bold text-muted-foreground">Quiz Attempts</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
