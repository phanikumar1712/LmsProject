import { useAuth } from '../../../contexts/AuthContext';
import { enrollmentsAPI, coursesAPI } from '../../../services/api';
import { Award, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';

export default function StudentCertificates() {
    const { user } = useAuth();

    const { data: certificates, loading } = useAsyncData(async () => {
        if (!user) return [];
        const [enrolls, allCourses] = await Promise.all([
            enrollmentsAPI.getByStudent(user.id),
            coursesAPI.getAll(),
        ]);
        const completedEnrolls = enrolls.filter(e => e.progress === 100);
        return completedEnrolls.map(e => {
            const c = allCourses.find(course => course.id === e.courseId);
            return c && c.certificate
                ? { ...c, completedAt: e.completedAt || e.enrolledAt }
                : null;
        }).filter(Boolean);
    }, [user?.id]);

    if (loading) return <LoadingContainer height="h-64" />;

    if ((certificates ?? []).length === 0) {
        return (
            <EmptyState
                icon={Award}
                message="Complete courses to 100% to earn your certificates."
                action={
                    <Link to="/student/courses" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">
                        Continue Learning
                    </Link>
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="My Certificates" subtitle="View and download your earned credentials" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {certificates.map(cert => (
                    <div key={cert.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-500" />
                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Award size={32} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg mb-1 leading-tight">{cert.title}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">
                            Issued: {new Date(cert.completedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </p>

                        <div className="mt-auto pt-4 w-full border-t border-slate-100 flex gap-2">
                            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-xs font-bold transition-colors">
                                <Download size={14} /> Download PDF
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
