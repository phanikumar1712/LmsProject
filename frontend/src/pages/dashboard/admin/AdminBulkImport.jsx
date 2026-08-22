import { useState, useRef, useEffect } from 'react';
import {
    Upload, Users, GraduationCap, BookOpen, CheckCircle, XCircle, AlertTriangle,
    Loader2, Download, FileSpreadsheet, RefreshCw, ArrowRight, ShieldAlert, Building2, UserRound
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usersAPI, coursesAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

const TABS = [
    { id: 'students', label: 'Students', icon: GraduationCap, accent: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'instructors', label: 'Instructors', icon: Users, accent: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'courses', label: 'Courses', icon: BookOpen, accent: 'text-amber-600 bg-amber-50 border-amber-200' },
];

const COLUMN_HINTS = {
    students: [
        { col: 'Student ID', desc: 'Roll number (e.g. CSE001) — required, unique per department' },
        { col: 'Name', desc: 'Full name — required' },
        { col: 'Email', desc: 'Login email — required, unique' },
        { col: 'Department', desc: 'Dept name (e.g. CSE) — optional; scoped admins are locked to their own' },
        { col: 'Year', desc: 'Academic year — optional' },
        { col: 'Section', desc: 'Section (e.g. A) — optional' },
    ],
    instructors: [
        { col: 'Name', desc: 'Full name — required' },
        { col: 'Email', desc: 'Login email — required, unique' },
        { col: 'Phone', desc: 'Optional' },
    ],
    courses: [
        { col: 'Title', desc: 'Course title — required' },
        { col: 'Instructor', desc: 'Instructor email or name — optional (defaults to you)' },
        { col: 'Department', desc: 'Dept name — optional; scoped admins locked to their own' },
        { col: 'Category', desc: 'Category name — optional, created if missing' },
        { col: 'Level', desc: 'Beginner / Intermediate / Advanced' },
        { col: 'Duration', desc: 'e.g. "8 weeks" — optional' },
        { col: 'Description', desc: 'Optional' },
    ],
};

const STEPS = ['Upload', 'Validate', 'Preview', 'Errors', 'Confirm', 'Created'];

const SAMPLE_ROWS = {
    students: `Student ID,Name,Email,Department,Year,Section\nCSE001,Rahul Kumar,rahul@gmail.com,CSE,3,A\nCSE002,Arjun Singh,arjun@gmail.com,CSE,3,A`,
    instructors: `Name,Email,Phone\nPriya Sharma,priya@example.com,9876543210\nVikram Rao,vikram@example.com,9876501234`,
    courses: `Title,Instructor,Department,Category,Level,Duration\nJava Programming,cse.instructor@demo.com,CSE,Programming,Beginner,8 weeks\nDatabase Management,cse.instructor@demo.com,CSE,Programming,Intermediate,10 weeks`,
};

export default function AdminBulkImport() {
    const { user, can } = useAuth();
    const [tab, setTab] = useState('students');
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState(null); // { total, ok|created, failed, results, preview }
    const [imported, setImported] = useState(null); // final confirm response
    const [busy, setBusy] = useState(false);
    const [step, setStep] = useState(0);
    const fileInputRef = useRef(null);
    const abortRef = useRef(null);

    const isSuper = user?.role === 'SUPER_ADMIN';

    // Each tab writes through a permission-gated endpoint; only surface the
    // tabs this user is actually allowed to import.
    const TAB_PERMISSIONS = { students: 'student.create', instructors: 'instructor.create', courses: 'course.create' };
    const allowedTabs = TABS.filter(t => can(TAB_PERMISSIONS[t.id]));
    // If the active tab is no longer permitted (override revoked mid-session),
    // fall back to the first tab this user can still import.
    useEffect(() => {
        if (!allowedTabs.some(t => t.id === tab)) {
            setTab(allowedTabs[0]?.id || 'students');
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [can]);

    const reset = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setFile(null);
        setFileName('');
        setPreview(null);
        setImported(null);
        setStep(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const pickFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setFileName(f.name);
        setPreview(null);
        setImported(null);
        setStep(1);
    };

    const downloadSample = () => {
        const blob = new Blob([SAMPLE_ROWS[tab]], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tab}_sample.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const downloadTemplate = () => {
        const fn = tab === 'students' ? usersAPI.downloadStudentTemplate
            : tab === 'instructors' ? usersAPI.downloadInstructorTemplate
                : coursesAPI.downloadCourseTemplate;
        fn().catch(err => toast.error(err.message || 'Failed to download template'));
    };

    // Step 2: Validate + Preview (no writes)
    const runPreview = async () => {
        if (!file) { toast.error('Choose a file first'); return; }
        setBusy(true);
        const ac = new AbortController();
        abortRef.current = ac;
        try {
            const fn = tab === 'students' ? usersAPI.previewStudents
                : tab === 'instructors' ? usersAPI.previewInstructors
                    : coursesAPI.previewCourseImport;
            const res = await fn(file, { signal: ac.signal });
            setPreview(res);
            setImported(null);
            setStep(2);
        } catch (err) {
            if (err.name === 'AbortError') toast.error('Preview timed out. Try a smaller file.');
            else toast.error(err.message || 'Preview failed');
        } finally {
            setBusy(false);
        }
    };

    // Step 5: Confirm import (writes)
    const confirmImport = async () => {
        if (!file) { toast.error('Choose a file first'); return; }
        setBusy(true);
        const ac = new AbortController();
        abortRef.current = ac;
        try {
            const fn = tab === 'students' ? usersAPI.importStudents
                : tab === 'instructors' ? usersAPI.importInstructors
                    : coursesAPI.importCourses;
            const res = await fn(file, { signal: ac.signal });
            setImported(res);
            setStep(5);
            const created = res.created ?? 0;
            const failed = res.failed ?? 0;
            if (created > 0) toast.success(`${created} ${tab === 'courses' ? 'courses' : tab} created`);
            if (failed > 0) toast.error(`${failed} row${failed === 1 ? '' : 's'} failed`);
        } catch (err) {
            if (err.name === 'AbortError') toast.error('Import timed out. Try a smaller file.');
            else toast.error(err.message || 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    const downloadPasswords = () => {
        const rows = imported?.results?.filter(r => r.status === 'created' && r.tempPassword) || [];
        if (!rows.length) { toast.error('No temp passwords to download'); return; }
        const csv = "Name,Email,Department,TempPassword\n" +
            rows.map(r => `"${r.name || ''}","${r.email}","${r.departmentName || ''}","${r.tempPassword}"`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tab}_credentials_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Prefer the confirm-import response once it exists: its rows carry
    // tempPassword (and departmentName), which the preview rows don't.
    const resultRows = imported?.results || preview?.results || [];
    const errorRows = resultRows.filter(r => r.status === 'error');
    const okRows = resultRows.filter(r => r.status !== 'error');
    const stepIndex = Math.min(step, STEPS.length - 1);

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-16">
            <PageHeader
                title="Bulk Import"
                subtitle="Upload a CSV/Excel file → validate → preview → fix errors → confirm to create"
            />

            {/* Tabs — only the import types this user holds the permission for */}
            <div className="flex gap-3 flex-wrap">
                {allowedTabs.map(t => (
                    <button key={t.id} onClick={() => { setTab(t.id); reset(); }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all ${tab === t.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1.5 flex-wrap bg-card border border-border rounded-2xl px-5 py-4 shadow-sm">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg ${i <= stepIndex ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                            {s}
                        </span>
                        {i < STEPS.length - 1 && <ArrowRight size={12} className="text-muted-foreground/40" />}
                    </div>
                ))}
            </div>

            {/* ── Step 0/1: Upload ── */}
            {(step === 0 || step === 1) && (
                <div className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold text-foreground">Upload {tab}</h3>
                            <p className="text-sm text-muted-foreground font-medium mt-0.5">
                                CSV or Excel (.csv / .xlsx / .xls), up to 500 rows. Headers are case-insensitive.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
                            <FileSpreadsheet size={16} /> Choose File
                        </button>
                        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={pickFile} className="hidden" />
                        <button onClick={downloadSample}
                            className="flex items-center gap-2 bg-card border border-border hover:bg-muted/40 px-5 py-3 rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <Download size={15} /> Sample CSV
                        </button>
                        <button onClick={downloadTemplate}
                            className="flex items-center gap-2 bg-card border border-border hover:bg-muted/40 px-5 py-3 rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <Download size={15} /> Excel Template
                        </button>
                    </div>

                    {fileName && (
                        <div className="flex items-center justify-between gap-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 min-w-0">
                                <CheckCircle size={16} className="shrink-0" />
                                <span className="truncate">{fileName}</span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={reset} className="text-xs font-bold text-muted-foreground hover:text-rose-600 transition-colors flex items-center gap-1">
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

                    <div className="bg-muted/40 border border-border rounded-2xl p-5">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Expected columns
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {COLUMN_HINTS[tab].map(c => (
                                <div key={c.col} className="bg-card border border-border rounded-xl px-4 py-3">
                                    <p className="text-xs font-extrabold text-foreground font-mono">{c.col}</p>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-snug">{c.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 2: Validate summary ── */}
            {step >= 2 && preview && !imported && (
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                            <FileSpreadsheet size={18} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-foreground">{preview.total}</p>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rows parsed</p>
                        </div>
                    </div>
                    <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle size={18} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-emerald-600">{preview.ok ?? preview.created ?? 0}</p>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600/70">Valid rows</p>
                        </div>
                    </div>
                    <div className="bg-card border border-rose-200 dark:border-rose-800 rounded-2xl p-5 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                            <XCircle size={18} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-rose-600">{preview.failed ?? 0}</p>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600/70">Rows with errors</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 3/4: Preview table (rows + errors) ── */}
            {step >= 2 && (preview || imported) && (
                <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
                        <h3 className="font-extrabold text-foreground flex items-center gap-2">
                            {step === 5 ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                            {step === 5 ? 'Import Results' : errorRows.length ? 'Validation Errors' : 'Preview — all rows valid'}
                        </h3>
                        <span className="text-xs font-bold text-muted-foreground">
                            {okRows.length} valid · {errorRows.length} errors
                        </span>
                    </div>

                    <div className="max-h-[420px] overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/40 border-b border-border sticky top-0">
                                <tr>
                                    <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">#</th>
                                    {tab !== 'courses' && <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Name</th>}
                                    {tab !== 'courses' && <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Email</th>}
                                    {tab === 'courses' && <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Title</th>}
                                    {tab === 'students' && <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Roll No</th>}
                                    {tab === 'courses' && <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Instructor</th>}
                                    <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Department</th>
                                    <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Status</th>
                                    {step !== 5 && <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Error</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {resultRows.map((r, i) => (
                                    <tr key={i} className={r.status === 'error' ? 'bg-rose-50/50 dark:bg-rose-950/10' : 'hover:bg-muted/30 transition-colors'}>
                                        <td className="px-5 py-3 text-muted-foreground font-medium">{r.row ?? i + 1}</td>
                                        {tab !== 'courses' && <td className="px-5 py-3 font-bold text-foreground">{r.name || '—'}</td>}
                                        {tab !== 'courses' && <td className="px-5 py-3 text-muted-foreground font-medium">{r.email || '—'}</td>}
                                        {tab === 'courses' && <td className="px-5 py-3 font-bold text-foreground">{r.title || '—'}</td>}
                                        {tab === 'students' && <td className="px-5 py-3 text-muted-foreground font-medium">{r.rollNo || '—'}</td>}
                                        {tab === 'courses' && <td className="px-5 py-3 text-muted-foreground font-medium">{r.instructorName || '—'}</td>}
                                        <td className="px-5 py-3">
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                                <Building2 size={11} /> {r.departmentName || (isSuper ? 'Global' : '—')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {r.status === 'error' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-700">
                                                    <XCircle size={12} /> Error
                                                </span>
                                            ) : step === 5 ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle size={12} /> {tab === 'courses' ? 'Created' : 'Created'}{r.tempPassword ? ' ✓' : ''}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle size={12} /> Valid
                                                </span>
                                            )}
                                        </td>
                                        {step !== 5 && (
                                            <td className="px-5 py-3 text-xs text-rose-600 font-semibold max-w-[260px]">{r.error || '—'}</td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Action bar ── */}
            {step >= 2 && !imported && (
                <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border rounded-2xl px-6 py-4 shadow-sm">
                    <div className="text-sm font-semibold text-muted-foreground">
                        {errorRows.length === 0
                            ? <>All <span className="font-extrabold text-emerald-600">{okRows.length}</span> rows are valid and ready to import.</>
                            : <>Fix the <span className="font-extrabold text-rose-600">{errorRows.length}</span> error rows in your file and re-upload, or import only the valid rows.</>}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={reset} className="px-5 py-2.5 border border-border hover:bg-muted/40 rounded-xl text-sm font-bold text-muted-foreground transition-colors">
                            Back
                        </button>
                        <button
                            onClick={confirmImport}
                            disabled={busy || okRows.length === 0}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 ${errorRows.length ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            Confirm Import{okRows.length ? ` (${okRows.length})` : ''}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 5: Created summary + passwords ── */}
            {step === 5 && imported && (
                <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <UserRound size={22} />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{imported.created ?? 0}</p>
                                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70">Successfully created</p>
                            </div>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                <ShieldAlert size={22} />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-rose-700 dark:text-rose-300">{imported.failed ?? 0}</p>
                                <p className="text-xs font-bold uppercase tracking-wider text-rose-600/70">Failed</p>
                            </div>
                        </div>
                    </div>

                    {tab !== 'courses' && (imported.created ?? 0) > 0 && (
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                                Temp passwords were generated for the created accounts. Download them now — they won't be shown again.
                            </p>
                            <button onClick={downloadPasswords}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                                <Download size={15} /> Download Credentials (CSV)
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button onClick={reset} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
                            <Upload size={15} /> Import Another File
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
