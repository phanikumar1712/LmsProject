import { useAuth } from '../../../contexts/AuthContext';
import { gradesAPI } from '../../../services/api';
import { GraduationCap, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

function scoreColor(pct) {
    if (pct === null || pct === undefined) return 'text-muted-foreground';
    if (pct >= 85) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
}

export default function StudentGrades() {
    const { user } = useAuth();

    const { data: grades, loading } = useAsyncData(
        () => gradesAPI.getMy(),
        [user?.id]
    );

    if (loading) return <LoadingContainer height="h-64" />;

    if ((grades ?? []).length === 0) {
        return (
            <EmptyState
                icon={GraduationCap}
                message="No grades yet. Enroll in a course and complete assignments, quizzes, and exams to see your weighted grade."
                action={
                    <Link to="/courses" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">
                        Explore Courses
                    </Link>
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="My Grades" subtitle="Per-course weighted grade breakdown" />

            <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-muted/40 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Course</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Instructor</th>
                                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Overall Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {grades.map((g) => (
                                <tr key={g.courseId} className="hover:bg-muted/40 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-foreground">{g.courseTitle}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                            <Award size={12} /> {g.total !== null ? `${g.total}% overall` : 'Not yet graded'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground font-medium">{g.instructorName || '—'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-2xl font-extrabold ${scoreColor(g.total)}`}>
                                            {g.total !== null ? `${g.total}%` : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {grades.map((g) => (
                    <div key={g.courseId} className="bg-card border border-border shadow-sm rounded-2xl p-6">
                        <h3 className="font-bold text-foreground mb-1">{g.courseTitle}</h3>
                        <p className="text-xs text-muted-foreground font-medium mb-4">Grade Breakdown</p>

                        <div className="space-y-3">
                            {g.components.length === 0 && (
                                <p className="text-sm text-muted-foreground">No graded components yet.</p>
                            )}
                            {g.components.map((c) => (
                                <div key={c.key}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-semibold text-muted-foreground">
                                            {c.label} <span className="text-muted-foreground/50 font-medium">({c.weight}%)</span>
                                        </span>
                                        <span className={`font-bold ${scoreColor(c.pct)}`}>{c.pct}%</span>
                                    </div>
                                    <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${c.pct >= 85 ? 'bg-emerald-500' : c.pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                            style={{ width: `${Math.min(c.pct, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}

                            {g.components.length > 0 && (
                                <div className="flex justify-between items-center pt-3 mt-3 border-t border-border">
                                    <span className="text-sm font-bold text-foreground uppercase tracking-wide">Total</span>
                                    <span className={`text-lg font-extrabold ${scoreColor(g.total)}`}>
                                        {g.total !== null ? `${g.total}%` : '—'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl p-5">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    <span className="font-bold">Grade model:</span> Assignments 20% · Quizzes 20% · Mid Exam 20% · Final Exam 40%.
                    Components you haven't attempted yet are excluded and the remaining weights are renormalized, so your total always reflects what you've actually completed.
                </p>
            </div>
        </div>
    );
}
