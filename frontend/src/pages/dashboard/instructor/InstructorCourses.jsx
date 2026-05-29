import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Search, Eye, Edit, Trash2, Clock, Users, Star } from 'lucide-react';
import { coursesAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { SkeletonCard } from '../../../components/ui/CourseCard';
import { RatingDisplay } from '../../../components/ui/RatingStars';
import toast from 'react-hot-toast';

export default function InstructorCourses() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCourses();
    }, [user.id]);

    const fetchCourses = () => {
        setLoading(true);
        coursesAPI.getByInstructor(user.id).then(setCourses).finally(() => setLoading(false));
    };

    const handleDelete = async (course) => {
        if (window.confirm(`Are you sure you want to delete "${course.title}"? This cannot be undone.`)) {
            try {
                await coursesAPI.delete(course.id);
                toast.success('Course deleted successfully');
                setCourses(prev => prev.filter(c => c.id !== course.id));
            } catch (err) {
                toast.error('Failed to delete course');
            }
        }
    };

    const filteredCourses = courses.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">My Courses</h1>
                    <p className="text-slate-500 font-medium">Manage, edit, and monitor your course portfolio</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/instructor/quiz-builder" className="bg-white border border-slate-200 text-indigo-600 px-5 py-2.5 rounded-xl text-[15px] font-bold flex items-center gap-2 whitespace-nowrap hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                        <PlusCircle size={18} /> Build Quiz
                    </Link>
                    <Link to="/instructor/create-course" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[15px] font-bold flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors">
                        <PlusCircle size={18} /> Create New Course
                    </Link>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search your courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow"
                />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading ? (
                    Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                ) : filteredCourses.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white border border-slate-200 border-dashed rounded-3xl shadow-sm">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100">
                            <PlusCircle size={28} className="text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No courses found</h3>
                        <p className="text-slate-500 font-medium mb-6">You haven't created any courses matching this criteria.</p>
                    </div>
                ) : (
                    filteredCourses.map(course => (
                        <div key={course.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden group flex flex-col hover:shadow-md transition-shadow">
                            <div className="relative h-44 overflow-hidden">
                                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                                <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : course.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {course.status}
                                </span>
                                {course.price === 0 ? (
                                    <span className="absolute top-3 right-3 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">Free</span>
                                ) : (
                                    <span className="absolute top-3 right-3 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">₹{course.discountPrice || course.price}</span>
                                )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-slate-900 text-base mb-4 line-clamp-2 leading-snug flex-1 group-hover:text-indigo-600 transition-colors" title={course.title}>
                                    {course.title}
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                                        <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {course.enrollmentCount} Students</span>
                                        <RatingDisplay rating={course.rating} />
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-medium text-slate-500 pb-4 border-b border-slate-100">
                                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {course.duration}</span>
                                        <span>{course.lessonsCount} Lessons</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    <button onClick={() => navigate(`/courses/${course.id}`)} className="flex flex-col items-center gap-1.5 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                        <Eye size={16} /> View
                                    </button>
                                    <button onClick={() => navigate(`/instructor/create-course?edit=${course.id}`)} className="flex flex-col items-center gap-1.5 py-2 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 rounded-xl hover:bg-indigo-600 transition-colors">
                                        <Edit size={16} /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(course)} className="flex flex-col items-center gap-1.5 py-2 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 rounded-xl hover:bg-rose-600 transition-colors">
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
