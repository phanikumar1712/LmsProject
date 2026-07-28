import { useState } from 'react';
import { Users, BookOpen, Search, Upload, CheckCircle, XCircle, Loader2, Send, UserPlus } from 'lucide-react';
import { coursesAPI, enrollmentsAPI, usersAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardHeader } from '../../../components/ui/Card';
import toast from 'react-hot-toast';

export default function AdminBulkEnrollment() {
    const [step, setStep] = useState('select'); // select | review | done
    const [selectedCourse, setSelectedCourse] = useState('');
    const [enrollMethod, setEnrollMethod] = useState('students'); // students | rolls
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [rollNoInput, setRollNoInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [results, setResults] = useState(null);

    const { data: courses } = useAsyncData(() => coursesAPI.getAll({ admin: true, limit: 200 }), []);
    const { data: students } = useAsyncData(() => usersAPI.getAll({ role: 'STUDENT', limit: 500 }), []);

    const filteredStudents = (students || []).filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.rollNo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleStudent = (id) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleEnroll = async () => {
        if (!selectedCourse) { toast.error('Select a course'); return; }
        if (enrollMethod === 'students' && !selectedStudents.length) { toast.error('Select at least one student'); return; }
        if (enrollMethod === 'rolls' && !rollNoInput.trim()) { toast.error('Enter at least one roll number'); return; }

        setEnrolling(true);
        try {
            const rollNos = enrollMethod === 'rolls'
                ? rollNoInput.split(',').map(r => r.trim()).filter(Boolean)
                : [];

            const res = await enrollmentsAPI.bulkEnroll(selectedCourse, selectedStudents, rollNos);
            setResults(res);
            setStep('done');
            toast.success(`Enrolled ${res.enrolled} student${res.enrolled !== 1 ? 's' : ''}!`);
        } catch (err) {
            toast.error(err.message || 'Bulk enrollment failed');
        } finally {
            setEnrolling(false);
        }
    };

    const reset = () => {
        setStep('select');
        setSelectedCourse('');
        setSelectedStudents([]);
        setRollNoInput('');
        setResults(null);
    };

    const course = (courses || []).find(c => c.id === selectedCourse);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title="Bulk Enrollment"
                subtitle="Enroll multiple students in a course at once"
            />

            <Card>
                <CardHeader
                    title="Step 1: Select Course"
                    icon={<BookOpen size={18} className="text-indigo-500" />}
                />
                <div className="p-6">
                    <select
                        value={selectedCourse}
                        onChange={e => setSelectedCourse(e.target.value)}
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm"
                    >
                        <option value="">Choose a course...</option>
                        {(courses || []).map(c => (
                            <option key={c.id} value={c.id}>{c.title} (₹{c.discountPrice || c.price || 0})</option>
                        ))}
                    </select>
                    {course && (
                        <div className="mt-3 flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                            {course.thumbnail && <img src={course.thumbnail} alt="" className="w-12 h-8 rounded-lg object-cover" />}
                            <div>
                                <p className="font-bold text-sm">{course.title}</p>
                                <p className="text-xs text-muted-foreground">{course.instructorName} • {course.lessonsCount} lessons</p>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Step 2: Select Students"
                    icon={<Users size={18} className="text-indigo-500" />}
                    right={
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEnrollMethod('students')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${enrollMethod === 'students' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
                            >
                                <UserPlus size={14} className="inline mr-1" /> By Name
                            </button>
                            <button
                                onClick={() => setEnrollMethod('rolls')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${enrollMethod === 'rolls' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
                            >
                                <Upload size={14} className="inline mr-1" /> By Roll No
                            </button>
                        </div>
                    }
                />
                <div className="p-6">
                    {enrollMethod === 'students' ? (
                        <>
                            <div className="relative mb-4">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search students by name, email or roll no..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                                {filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => toggleStudent(student.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left ${selectedStudents.includes(student.id) ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200' : 'hover:bg-muted border border-transparent'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedStudents.includes(student.id) ? 'bg-indigo-600 border-indigo-600' : 'border-muted-foreground/30'}`}>
                                            {selectedStudents.includes(student.id) && <CheckCircle size={14} className="text-white" />}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {student.name?.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{student.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{student.email}{student.rollNo ? ` • ${student.rollNo}` : ''}</p>
                                        </div>
                                    </button>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <p className="py-8 text-center text-muted-foreground text-sm">No students found</p>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 font-medium">
                                {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                            </p>
                        </>
                    ) : (
                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 block">
                                Enter Roll Numbers
                            </label>
                            <textarea
                                value={rollNoInput}
                                onChange={e => setRollNoInput(e.target.value)}
                                placeholder="CS22001, CS22002, EC22001"
                                className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none h-24"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Separate multiple roll numbers with commas</p>
                        </div>
                    )}
                </div>
            </Card>

            {step === 'select' && (
                <button
                    onClick={handleEnroll}
                    disabled={enrolling || !selectedCourse}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                    {enrolling ? (
                        <><Loader2 size={18} className="animate-spin" /> Enrolling Students...</>
                    ) : (
                        <><Send size={18} /> Enroll {enrollMethod === 'students' ? selectedStudents.length : 'Students'}</>
                    )}
                </button>
            )}

            {results && step === 'done' && (
                <Card>
                    <CardHeader
                        title="Enrollment Results"
                        icon={results.enrolled > 0 ? <CheckCircle size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-rose-500" />}
                    />
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl text-center">
                                <p className="text-2xl font-black text-emerald-600">{results.enrolled}</p>
                                <p className="text-xs font-bold text-muted-foreground">Enrolled</p>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-center">
                                <p className="text-2xl font-black text-amber-600">{results.skipped || 0}</p>
                                <p className="text-xs font-bold text-muted-foreground">Already Enrolled</p>
                            </div>
                            <div className="bg-muted p-4 rounded-xl text-center">
                                <p className="text-2xl font-black text-foreground">{results.total}</p>
                                <p className="text-xs font-bold text-muted-foreground">Total Attempted</p>
                            </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                            {results.results?.map((r, i) => (
                                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm">
                                    <span className="font-medium">{r.studentId?.slice(0, 8)}...</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.status === 'enrolled' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {r.status} {r.reason ? `- ${r.reason}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={reset}
                            className="w-full bg-muted hover:bg-muted/80 text-foreground font-bold py-3 rounded-xl transition-colors"
                        >
                            Enroll More Students
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
}
