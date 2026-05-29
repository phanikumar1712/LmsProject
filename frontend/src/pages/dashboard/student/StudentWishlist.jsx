import { useAuth } from '../../../contexts/AuthContext';
import { wishlistAPI } from '../../../services/api';
import { CourseCard } from '../../../components/ui/CourseCard';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

export default function StudentWishlist() {
    const { user } = useAuth();

    const { data: wishlistCourses, loading } = useAsyncData(
        () => wishlistAPI.get(user?.id),
        [user?.id]
    );

    if (loading) return <LoadingContainer height="h-64" />;

    if ((wishlistCourses ?? []).length === 0) {
        return (
            <EmptyState
                icon={Heart}
                message="Save courses you're interested in by clicking the heart icon on any course page."
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
            <PageHeader title="My Wishlist" subtitle="Courses you've saved for later" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {wishlistCourses.map(course => (
                    <CourseCard key={course.id} course={course} />
                ))}
            </div>
        </div>
    );
}
