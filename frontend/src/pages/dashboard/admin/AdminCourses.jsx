import { useState } from 'react';
import { BookOpen, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { coursesAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function AdminCourses() {
    const [filter, setFilter] = useState('ALL');
    const { data, loading, reload } = useAsyncData(() => coursesAPI.getAll({ admin: true }), []);
    const courses = data ?? [];

    const handleApprove = async (courseId) => {
        try {
            await coursesAPI.approve(courseId);
            reload();
            toast.success('Course approved and published!');
        } catch {
            toast.error('Failed to approve course');
        }
    };

    const handleReject = async (courseId) => {
        try {
            await coursesAPI.reject(courseId);
            reload();
            toast.success('Course rejected.');
        } catch {
            toast.error('Failed to reject course');
        }
    };

    const displayCourses = courses.filter(c => filter === 'ALL' || c.status === filter);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="Course Management"
                subtitle="Review, approve, and manage platform courses."
                action={
                    <button
                        onClick={() => {
                            const csv = "Title,Instructor,Category,Price,Status,Enrollments\n" +
                                displayCourses.map(c => `"${c.title}","${c.instructorName}","${c.category}",${c.price},"${c.status}",${c.enrollmentsCount || 0}`).join("\n");
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Courses_Export_${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                        }}
                        className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        Export CSV
                    </button>
                }
            />

            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
                    <div className="flex gap-3">
                        {['ALL', 'PUBLISHED', 'PENDING', 'DRAFT'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-sm ${filter === f ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <span className="flex items-center gap-2">
                                    {f}
                                    {f === 'PENDING' && courses.filter(c => c.status === 'PENDING').length > 0 && (
                                        <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px]">
                                            {courses.filter(c => c.status === 'PENDING').length}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <LoadingContainer height="h-64" />
                ) : (
                    <div className="space-y-5">
                        {displayCourses.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 font-medium">
                                No courses found in this category.
                            </div>
                        ) : displayCourses.map(course => (
                            <div key={course.id} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row gap-6 items-center hover:bg-slate-100 transition-colors relative group shadow-sm">
                                <div className="w-56 h-32 rounded-xl overflow-hidden flex-shrink-0 relative shadow-sm border border-slate-200">
                                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                    <div className="absolute top-3 right-3 flex gap-1">
                                        <span className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] text-slate-900 font-bold tracking-wider shadow-sm border border-slate-100">₹{course.discountPrice || course.price}</span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1"><Link to={`/courses/${course.id}`} className="hover:text-indigo-600 transition-colors">{course.title}</Link></h3>
                                            <p className="text-[13px] font-semibold text-slate-500 flex items-center gap-2">By {course.instructorName} • {course.category}</p>
                                            <p className="text-[12px] font-bold text-slate-400 mt-2 bg-white border border-slate-200 px-3 py-1 rounded-lg inline-block">{course.lessonsCount} lessons • {course.duration}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 flex-shrink-0 w-36 border-l border-slate-200 pl-6">
                                    <div className="w-full">
                                        {course.status === 'PENDING' && <span className="bg-amber-50 text-amber-600 border border-amber-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><AlertTriangle size={14} /> Needs Review</span>}
                                        {course.status === 'PUBLISHED' && <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1.5"><CheckCircle size={14} /> Published</span>}
                                        {course.status === 'DRAFT' && <span className="bg-slate-100 text-slate-600 border border-slate-200 shadow-sm text-[11px] font-bold px-3 py-1.5 rounded-lg w-full text-center">Draft</span>}
                                    </div>

                                    {course.status === 'PENDING' && (
                                        <div className="flex flex-col gap-2.5 w-full mt-3">
                                            <button onClick={() => handleApprove(course.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm">
                                                <CheckCircle size={14} /> Approve
                                            </button>
                                            <button onClick={() => handleReject(course.id)} className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[12px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm">
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
