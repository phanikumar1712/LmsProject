import { useState, useRef } from 'react';
import { Users, BookOpen, Search, Upload, CheckCircle, XCircle, Loader2, Send, UserPlus, FileSpreadsheet, Download, AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { coursesAPI, enrollmentsAPI, usersAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { CourseThumbnail } from '../../../components/ui/CourseThumbnail';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const SAMPLE_CSV = `Course,Student ID,Email
Java Programming,CSE001,student1@example.com
Java Programming,CSE002,student2@example.com
`;

/**
 * BulkEnrollmentPanel – the full bulk-enrollment flow: pick students by name,
 * enter roll numbers, or upload a CSV/Excel file (validate → preview → confirm).
 * Designed to be embedded anywhere (standalone page or the Enrollment Management
 * module's Bulk tab); it renders no page header of its own.
 */
export default function BulkEnrollmentPanel({ initialCourseId } = {}) {
    const { can } = useAuth();
    const [step, setStep] = useState('select'); // select | review | done
    const [selectedCourse, setSelectedCourse] = useState(initialCourseId || '');
    const [enrollMethod, setEnrollMethod] = useState('students'); // students | rolls | import
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [rollNoInput, setRollNoInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [results, setResults] = useState(null);

    // ── CSV import mode state ──
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef(null);

    const { data: courses } = useAsyncData(() => coursesAPI.getAll({ admin: true, limit: 200 }), []);

    const course = (courses || []).find(c => c.id === selectedCourse);

    // Only list students from the selected course's department
    const { data: students, loading: studentsLoading } = useAsyncData(
        () => course?.departmentId
            ? usersAPI.getAll({ role: 'STUDENT', limit: 500, departmentId: course.departmentId })
            : Promise.resolve([]),
        [course?.departmentId]
    );

    const handleCourseChange = (courseId) => {
        setSelectedCourse(courseId);
        setSelectedStudents([]); // students belong to the previous course's department
    };

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

    // ── CSV import: validate → preview (no writes) ──
    const pickFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setFileName(f.name);
        setPreview(null);
        setResults(null);
    };

    const resetImport = () => {
        setFile(null);
        setFileName('');
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const downloadSample = () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'enrollment_sample.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const runPreview = async () => {
        if (!file) { toast.error('Choose a file first'); return; }
        setBusy(true);
        try {
            const res = await enrollmentsAPI.previewEnrollmentImport(file, selectedCourse || undefined);
            setPreview(res);
            toast.success(`Previewed ${res.total} rows — ${res.ok} valid, ${res.failed} with errors`);
        } catch (err) {
            toast.error(err.message || 'Preview failed');
        } finally {
            setBusy(false);
        }
    };

    const confirmImport = async () => {
        if (!file) { toast.error('Choose a file first'); return; }
        setBusy(true);
        try {
            const res = await enrollmentsAPI.importEnrollments(file, selectedCourse || undefined);
            setResults(res);
            setStep('done');
            toast.success(`Enrolled ${res.created} student${res.created !== 1 ? 's' : ''}!`);
            if (res.failed > 0) toast.error(`${res.failed} row${res.failed === 1 ? '' : 's'} failed`);
        } catch (err) {
            toast.error(err.message || 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    const reset = () => {
        setStep('select');
        setSelectedCourse('');
        setSelectedStudents([]);
        setRollNoInput('');
        setResults(null);
        resetImport();
    };

    const resultRows = results?.results || [];
    const previewRows = preview?.results || [];
    const errorRows = previewRows.filter(r => r.status === 'error');
    const okRows = previewRows.filter(r => r.status === 'ok');

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader
                    title="Step 1: Select Course"
                    icon={<BookOpen size={18} className="text-indigo-500" />}
                />
                <div className="p-6">
                    <select
                        value={selectedCourse}
                        onChange={e => handleCourseChange(e.target.value)}
                        className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold shadow-sm"
                    >
                        <option value="">Choose a course...</option>
                        {(courses || []).map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                    {course && (
                        <div className="mt-3 flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                            {course.thumbnail ? (
                                <CourseThumbnail thumbnail={course.thumbnail} title={course.title} className="w-12 h-8 rounded-lg object-cover" />
                            ) : (
                                <div className="w-12 h-8 rounded-lg bg-muted flex items-center justify-center text-lg">📚</div>
                            )}
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
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => { setEnrollMethod('students'); setStep('select'); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${enrollMethod === 'students' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
                            >
                                <UserPlus size={14} className="inline mr-1" /> By Name
                            </button>
                            <button
                                onClick={() => { setEnrollMethod('rolls'); setStep('select'); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${enrollMethod === 'rolls' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
                            >
                                <Users size={14} className="inline mr-1" /> By Roll No
                            </button>
                            {can('enrollment.manage') && (
                                <button
                                    onClick={() => { setEnrollMethod('import'); setStep('select'); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${enrollMethod === 'import' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
                                >
                                    <Upload size={14} className="inline mr-1" /> Upload CSV
                                </button>
                            )}
                        </div>
                    }
                />
                <div className="p-6">
                    {enrollMethod === 'students' ? (
                        !selectedCourse ? (
                            <p className="py-8 text-center text-muted-foreground text-sm font-medium">
                                Select a course first — only students from the course's department will be listed
                            </p>
                        ) : (
                        <>
                            {course?.departmentName && (
                                <p className="text-xs font-bold text-indigo-600 mb-3">
                                    Showing students from {course.departmentName} department only
                                </p>
                            )}
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
                                {studentsLoading && (
                                    <p className="py-8 text-center text-muted-foreground text-sm">Loading students...</p>
                                )}
                                {!studentsLoading && filteredStudents.length === 0 && (
                                    <p className="py-8 text-center text-muted-foreground text-sm">No students found in this department</p>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 font-medium">
                                {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                            </p>
                        </>
                        )
                    ) : enrollMethod === 'rolls' ? (
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
                    ) : (
                        <div className="space-y-5">
                            {/* Course hint when selected */}
                            {selectedCourse && course && (
                                <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3">
                                    <BookOpen size={16} className="text-indigo-600 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                            Enrolling into: <span className="font-extrabold">{course.title}</span>
                                        </p>
                                        <p className="text-[11px] text-indigo-600/70 font-medium">CSV rows will be enrolled in this course. You can skip the "Course" column in your CSV.</p>
                                    </div>
                                </div>
                            )}
                            {!selectedCourse && (
                                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">No course selected</p>
                                        <p className="text-[11px] text-amber-600/80 font-medium">Your CSV must include a "Course" column with the course name or ID for each row.</p>
                                    </div>
                                </div>
                            )}

                            {/* Upload */}
                            <div className="flex flex-wrap items-center gap-3">
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">
                                    <FileSpreadsheet size={15} /> Choose File
                                </button>
                                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={pickFile} className="hidden" />
                                <button onClick={downloadSample}
                                    className="flex items-center gap-2 bg-card border border-border hover:bg-muted/40 px-4 py-2.5 rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Download size={14} /> Sample CSV
                                </button>
                                <button onClick={() => enrollmentsAPI.downloadEnrollmentTemplate().catch(err => toast.error(err.message || 'Failed to download template'))}
                                    className="flex items-center gap-2 bg-card border border-border hover:bg-muted/40 px-4 py-2.5 rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Download size={14} /> Excel Template
                                </button>
                            </div>

                            {fileName && (
                                <div className="flex items-center justify-between gap-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 min-w-0">
                                        <CheckCircle size={16} className="shrink-0" />
                                        <span className="truncate">{fileName}</span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={resetImport} className="text-xs font-bold text-muted-foreground hover:text-rose-600 transition-colors flex items-center gap-1">
                                            <RefreshCw size={12} /> Remove
                                        </button>
                                        <button onClick={runPreview} disabled={busy}
                                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors">
                                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                            Validate & Preview
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Preview summary */}
                            {preview && (
                                <div className="grid sm:grid-cols-3 gap-3">
                                    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                                        <FileSpreadsheet size={18} className="text-muted-foreground" />
                                        <div>
                                            <p className="text-2xl font-black">{preview.total}</p>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rows parsed</p>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
                                        <CheckCircle size={18} className="text-emerald-600" />
                                        <div>
                                            <p className="text-2xl font-black text-emerald-600">{preview.ok ?? preview.created ?? 0}</p>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600/70">Valid rows</p>
                                        </div>
                                    </div>
                                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-center gap-3">
                                        <XCircle size={18} className="text-rose-600" />
                                        <div>
                                            <p className="text-2xl font-black text-rose-600">{preview.failed ?? 0}</p>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600/70">Rows with errors</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview table */}
                            {preview && previewRows.length > 0 && (
                                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
                                        <h4 className="font-extrabold text-sm flex items-center gap-2">
                                            {errorRows.length ? <AlertTriangle size={15} className="text-amber-500" /> : <CheckCircle size={15} className="text-emerald-500" />}
                                            {errorRows.length ? 'Validation Errors' : 'Preview — all rows valid'}
                                        </h4>
                                        <span className="text-xs font-bold text-muted-foreground">{okRows.length} valid · {errorRows.length} errors</span>
                                    </div>
                                    <div className="max-h-[320px] overflow-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-muted/40 border-b border-border sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">#</th>
                                                    <th className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Course</th>
                                                    <th className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Student</th>
                                                    <th className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Status</th>
                                                    <th className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {previewRows.map((r, i) => (
                                                    <tr key={i} className={r.status === 'error' ? 'bg-rose-50/50 dark:bg-rose-950/10' : 'hover:bg-muted/30 transition-colors'}>
                                                        <td className="px-4 py-2.5 text-muted-foreground font-medium">{r.row ?? i + 1}</td>
                                                        <td className="px-4 py-2.5">
                                                            <p className="font-bold text-foreground text-xs">{r.courseTitle || '—'}</p>
                                                            {r.departmentName && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Building2 size={10} /> {r.departmentName}</p>}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <p className="font-bold text-foreground text-xs">{r.studentName || '—'}</p>
                                                            {(r.rollNo || r.email) && <p className="text-[11px] text-muted-foreground">{r.rollNo || ''}{r.rollNo && r.email ? ' • ' : ''}{r.email || ''}</p>}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            {r.status === 'error' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-700">
                                                                    <XCircle size={11} /> Error
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-emerald-100 text-emerald-700">
                                                                    <CheckCircle size={11} /> Valid
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs text-rose-600 font-semibold max-w-[220px]">{r.error || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Action bar */}
                            {preview && (
                                <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border rounded-2xl px-5 py-3.5">
                                    <div className="text-sm font-semibold text-muted-foreground">
                                        {errorRows.length === 0
                                            ? <>All <span className="font-extrabold text-emerald-600">{okRows.length}</span> rows are valid and ready to enroll.</>
                                            : <>Fix the <span className="font-extrabold text-rose-600">{errorRows.length}</span> error rows in your file, or enroll only the valid rows.</>}
                                    </div>
                                    {can('enrollment.manage') && (
                                        <button
                                            onClick={confirmImport}
                                            disabled={busy || okRows.length === 0}
                                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 ${errorRows.length ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                        >
                                            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                                            Confirm Import{okRows.length ? ` (${okRows.length})` : ''}
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="bg-muted/40 border border-border rounded-xl p-4">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> Expected columns
                                </p>
                                <ul className="text-xs text-muted-foreground font-medium space-y-1">
                                    {selectedCourse ? (
                                        <li><span className="font-mono font-extrabold text-emerald-600">Course</span> — optional (pre-selected above, all rows enroll in that course)</li>
                                    ) : (
                                        <li><span className="font-mono font-extrabold text-foreground">Course</span> — course ID or title (case-insensitive), <b>required</b> per row</li>
                                    )}
                                    <li><span className="font-mono font-extrabold text-foreground">Student ID</span> — roll number, or</li>
                                    <li><span className="font-mono font-extrabold text-foreground">Email</span> — student email (either one is required)</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {step === 'select' && enrollMethod !== 'import' && can('enrollment.manage') && (
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
                                <p className="text-2xl font-black text-emerald-600">{results.enrolled ?? results.created ?? 0}</p>
                                <p className="text-xs font-bold text-muted-foreground">Enrolled</p>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-center">
                                <p className="text-2xl font-black text-amber-600">{results.skipped ?? results.failed ?? 0}</p>
                                <p className="text-xs font-bold text-muted-foreground">{enrollMethod === 'import' ? 'Failed' : 'Already Enrolled'}</p>
                            </div>
                            <div className="bg-muted p-4 rounded-xl text-center">
                                <p className="text-2xl font-black text-foreground">{results.total}</p>
                                <p className="text-xs font-bold text-muted-foreground">Total Attempted</p>
                            </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                            {resultRows.map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm">
                                    <span className="font-medium min-w-0 truncate">
                                        {r.studentName || r.studentId?.slice(0, 8) || r.email || 'Student'}
                                        {r.courseTitle ? <span className="text-muted-foreground text-xs"> — {r.courseTitle}</span> : null}
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${r.status === 'enrolled' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {r.status} {r.reason ? `- ${r.reason}` : ''} {r.error ? `- ${r.error}` : ''}
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
