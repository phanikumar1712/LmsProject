import { useAuth } from '../../../contexts/AuthContext';
import { enrollmentsAPI } from '../../../services/api';
import { CourseCard } from '../../../components/ui/CourseCard';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

export default function StudentCourses() {
    const { user } = useAuth();

    // enrollmentsAPI.getByStudent already joins the course object, so no separate fetch needed
    const { data: enrollments, loading } = useAsyncData(
        () => enrollmentsAPI.getByStudent(user.id),
        [user?.id]
    );

    const enrolledCourses = (enrollments ?? []).map(e =>
        e.course ? { ...e.course, progress: e.progress, isEnrolled: true } : null
    ).filter(Boolean);

    if (loading) return <LoadingContainer height="h-64" />;

    if (enrolledCourses.length === 0) {
        return (
            <EmptyState
                icon={BookOpen}
                message="You haven't enrolled in any courses yet. Explore our catalog to get started!"
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
            <PageHeader title="My Learning" subtitle="Jump back in and continue your progress" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {enrolledCourses.map(course => (
                    <CourseCard key={course.id} course={course} progress={course.progress} />
                ))}
            </div>
        </div>
    );
}
