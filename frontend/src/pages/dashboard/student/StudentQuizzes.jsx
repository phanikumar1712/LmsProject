import { useAuth } from '../../../contexts/AuthContext';
import { quizzesAPI } from '../../../services/api';
import { ClipboardList, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

export default function StudentQuizzes() {
    const { user } = useAuth();

    const { data: attempts, loading } = useAsyncData(
        () => quizzesAPI.getAttempts(user.id),
        [user?.id]
    );

    if (loading) return <LoadingContainer height="h-64" />;

    if ((attempts ?? []).length === 0) {
        return (
            <EmptyState
                icon={ClipboardList}
                message="You haven't taken any quizzes yet. Enroll in a course and test your knowledge!"
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
            <PageHeader title="My Quizzes" subtitle="Review your assessment history and scores" />

            <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                    <thead className="bg-muted/40 border-b border-border">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Quiz Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Course</th>
                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Score</th>
                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {attempts.map((attempt) => (
                            <tr key={attempt.id} className="hover:bg-muted/40 transition-colors">
                                <td className="px-6 py-4 font-bold text-foreground">{attempt.quiz?.title || 'Unknown Quiz'}</td>
                                <td className="px-6 py-4 text-sm text-muted-foreground font-medium">{attempt.course?.title || 'Unknown Course'}</td>
                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                    {attempt.completedAt
                                        ? new Date(attempt.completedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : '—'
                                    }
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-bold text-foreground">{attempt.score}%</span>
                                    <span className="text-xs text-muted-foreground/60 ml-1">/ {attempt.quiz?.passingScore || 0}% passing</span>
                                </td>
                                <td className="px-6 py-4">
                                    {attempt.passed ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                                            <CheckCircle size={12} /> Passed
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800">
                                            <XCircle size={12} /> Failed
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link
                                        to={`/courses/${attempt.course?.id}/quiz/${attempt.quizId}`}
                                        className="inline-flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-indigo-100 dark:border-indigo-800/30 hover:border-indigo-600 shadow-sm"
                                    >
                                        Reattempt
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
}
