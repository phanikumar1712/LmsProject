import { useState } from 'react';
import { Mail, Filter, BookOpen, Eye, Copy, X, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { coursesAPI, enrollmentsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { PageHeader } from '../../../components/ui/PageHeader';
import { SearchInput, FilterSelect, FilterBar } from '../../../components/ui/SearchInput';
import { DataTable, UserCell } from '../../../components/ui/DataTable';
import { useMultipleAsync } from '../../../hooks/useAsyncData';
import toast from 'react-hot-toast';

export default function InstructorStudents() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCourse, setFilterCourse] = useState(searchParams.get('course') || 'All');
    const [contactStudent, setContactStudent] = useState(null);

    // Only 2 API calls now — both are accessible to instructors
    const { results, loading } = useMultipleAsync([
        () => coursesAPI.getByInstructor(user.id),
        () => enrollmentsAPI.getStats(user.id),
    ], [user.id]);

    const myCourses = results[0] || [];
    const enrollments = results[1] || [];

    // Build per-course lookup for titles
    const courseMap = Object.fromEntries(myCourses.map(c => [c.id, c]));

    // Build rows directly from enriched enrollment stats (student info already included)
    const tableRows = enrollments
        .filter(e => {
            const courseId = e.courseId || e.course_id;
            const name = (e.studentName || '').toLowerCase();
            const email = (e.studentEmail || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
            const matchesCourse = filterCourse === 'All' || courseId === filterCourse;
            return matchesSearch && matchesCourse;
        })
        .map(e => ({
            studentId: e.studentId,
            studentName: e.studentName || 'Unknown',
            studentEmail: e.studentEmail || '',
            studentAvatar: e.studentAvatar || '',
            courseId: e.courseId || e.course_id,
            courseName: e.courseTitle || courseMap[e.courseId || e.course_id]?.title || '—',
            progress: e.progress || 0,
            enrolledAt: e.enrolled_at || e.enrolledAt,
            lastAccessed: e.last_accessed || e.lastAccessed,
        }));

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="My Students"
                subtitle="Monitor student progress and engagement across your courses"
            />

            <FilterBar>
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search by student name or email..."
                />
                <FilterSelect
                    value={filterCourse}
                    onChange={setFilterCourse}
                    icon={Filter}
                    className="min-w-[240px]"
                >
                    <option value="All">All Courses</option>
                    {myCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </FilterSelect>
            </FilterBar>

            <DataTable
                columns={['Student', 'Course Enrolled', 'Progress', 'Enrolled On', 'Last Active', 'Action']}
                loading={loading}
                loadingText="Loading students..."
                empty={!loading && tableRows.length === 0}
                emptyText="No students found matching your filters."
            >
                {tableRows.map((row, idx) => (
                    <tr
                        key={`${row.studentId}-${row.courseId}-${idx}`}
                        className="hover:bg-muted/40 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/instructor/students/${row.studentId}`)}
                    >
                        <td className="px-6 py-4">
                            <UserCell name={row.studentName} email={row.studentEmail} avatar={row.studentAvatar} />
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
                                    <BookOpen size={16} className="text-indigo-600" />
                                </div>
                                <span className="font-semibold text-foreground truncate max-w-[220px]" title={row.courseName}>
                                    {row.courseName}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 w-56">
                            <ProgressBar
                                value={row.progress}
                                showLabel
                                color={row.progress === 100 ? 'success' : 'primary'}
                            />
                        </td>
                        <td className="px-6 py-4 text-[13px] font-medium text-muted-foreground">
                            {row.enrolledAt
                                ? new Date(row.enrolledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                        </td>
                        <td className="px-6 py-4 text-[13px] font-medium text-muted-foreground">
                            {row.lastAccessed
                                ? new Date(row.lastAccessed).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/instructor/students/${row.studentId}`); }}
                                    className="p-2.5 inline-flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all shadow-sm"
                                    title="View Student Details"
                                >
                                    <Eye size={18} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setContactStudent(row); }}
                                    className="p-2.5 inline-flex items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all shadow-sm"
                                    title="Contact Student"
                                >
                                    <Mail size={18} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </DataTable>

            {/* ── Contact Student Modal ── */}
            {contactStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setContactStudent(null)}>
                    <div
                        className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <Mail size={20} className="text-indigo-600" /> Contact Student
                            </h3>
                            <button onClick={() => setContactStudent(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                {contactStudent.studentAvatar ? (
                                    <img src={contactStudent.studentAvatar} alt={contactStudent.studentName} className="w-16 h-16 rounded-2xl object-cover border-2 border-border" />
                                ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                                        <span className="text-xl font-black text-indigo-600">{contactStudent.studentName?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-extrabold text-foreground text-lg truncate">{contactStudent.studentName}</p>
                                    <p className="text-sm text-muted-foreground font-medium truncate">{contactStudent.studentEmail || 'No email on file'}</p>
                                </div>
                            </div>

                            {contactStudent.studentEmail ? (
                                <>
                                    <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-2xl px-4 py-3">
                                        <span className="text-sm text-muted-foreground font-medium truncate">{contactStudent.studentEmail}</span>
                                        <button
                                            onClick={() => { navigator.clipboard?.writeText(contactStudent.studentEmail); toast.success('Email copied'); }}
                                            className="ml-auto p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex-shrink-0"
                                            title="Copy email"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                    <a
                                        href={`mailto:${contactStudent.studentEmail}`}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Send size={16} /> Open in Email Client
                                    </a>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center font-medium">This student has no email address saved yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
