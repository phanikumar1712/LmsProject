import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Users, GraduationCap, Building2, BookOpen, Activity, CheckCircle2,
    TrendingUp, CalendarCheck, ClipboardList, FileQuestion, Award, Download,
    FileSpreadsheet, RefreshCw, Printer
} from 'lucide-react';
import { usersAPI, coursesAPI, statsAPI } from '../../../services/api';
import { DataTable } from '../../../components/ui/DataTable';
import toast from 'react-hot-toast';

const shortId = (id) => id ? id.slice(0, 8).toUpperCase() : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
    if (!rows.length) { toast.error('Nothing to export'); return; }
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    download(blob, `${filename}.csv`);
}

function exportExcel(rows, filename) {
    if (!rows.length) { toast.error('Nothing to export'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportPDF(rows, title) {
    if (!rows.length) { toast.error('Nothing to export'); return; }
    const headers = Object.keys(rows[0]);
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups to export PDF'); return; }
    const rowsHtml = rows.slice(0, 1000).map(r =>
        `<tr>${headers.map(h => `<td>${String(r[h] ?? '')}</td>`).join('')}</tr>`
    ).join('');
    win.document.write(`<!doctype html><html><head><title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            p.meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #eef2ff; text-align: left; padding: 7px 9px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; }
            td { padding: 6px 9px; border: 1px solid #e2e8f0; }
            tr:nth-child(even) td { background: #f8fafc; }
        </style></head><body>
        <h1>${title}</h1>
        <p class="meta">Generated ${new Date().toLocaleString()}</p>
        <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>
        <script>window.onload = () => window.print();<\\/script>
        </body></html>`);
    win.document.close();
}

function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Report definitions ───────────────────────────────────────────────────────
const reportMeta = {
    students: { label: 'Student Report', icon: Users, group: 'People' },
    instructors: { label: 'Instructor Report', icon: GraduationCap, group: 'People' },
    departments: { label: 'Department Report', icon: Building2, group: 'People' },
    courses: { label: 'Course Report', icon: BookOpen, group: 'Courses' },
    enrollments: { label: 'Enrollment Report', icon: Activity, group: 'Courses' },
    completion: { label: 'Completion Report', icon: CheckCircle2, group: 'Courses' },
    performance: { label: 'Performance Report', icon: TrendingUp, group: 'Courses' },
    attendance: { label: 'Attendance Report', icon: CalendarCheck, group: 'Activity' },
    assignments: { label: 'Assignment Report', icon: ClipboardList, group: 'Activity' },
    quizzes: { label: 'Quiz Report', icon: FileQuestion, group: 'Activity' },
    certificates: { label: 'Certificate Report', icon: Award, group: 'Activity' },
};

const GROUP_ORDER = ['People', 'Courses', 'Activity'];

export default function SuperAdminReports() {
    const [reportKey, setReportKey] = useState('students');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadReport = async (key) => {
        setLoading(true);
        setData(null);
        try {
            let rows = [];
            if (key === 'students') {
                const [users, progress] = await Promise.all([
                    usersAPI.getAll({ role: 'STUDENT', limit: 1000 }),
                    statsAPI.getStudentProgress({ limit: 1000 }).catch(() => []),
                ]);
                const progById = (Array.isArray(progress) ? progress : progress?.data || []).reduce((m, p) => ({ ...m, [p.id]: p }), {});
                rows = (Array.isArray(users) ? users : []).map(u => {
                    const p = progById[u.id] || {};
                    return {
                        'Student ID': shortId(u.id),
                        'Name': u.name,
                        'Email': u.email,
                        'Roll No': u.rollNo || '',
                        'Department': u.departmentName || '',
                        'Phone': u.phone || '',
                        'Enrolled': p.enrolledCourses ?? '',
                        'Avg Progress': p.avgProgress != null ? `${p.avgProgress}%` : '',
                        'Completed': p.completedCourses ?? '',
                        'Status': u.active === false ? 'Suspended' : 'Active',
                        'Created': fmtDate(u.createdAt),
                    };
                });
            } else if (key === 'instructors') {
                const list = Array.isArray(await usersAPI.getAll({ role: 'INSTRUCTOR', limit: 100 })) ? await usersAPI.getAll({ role: 'INSTRUCTOR', limit: 100 }) : [];
                const enriched = await Promise.all(list.map(async u => {
                    try { return { user: u, stats: await statsAPI.getInstructor(u.id) }; } catch { return { user: u, stats: null }; }
                }));
                rows = enriched.map(({ user: u, stats }) => ({
                    'Instructor ID': shortId(u.id),
                    'Name': u.name,
                    'Email': u.email,
                    'Department': u.departmentName || '',
                    'Designation': u.designation || '',
                    'Phone': u.phone || '',
                    'Courses': stats?.totalCourses ?? '',
                    'Enrollments': stats?.totalEnrollments ?? '',
                    'Avg Rating': stats?.avgRating != null ? stats.avgRating : '',
                    'Status': u.active === false ? 'Suspended' : 'Active',
                }));
            } else if (key === 'departments') {
                const list = await statsAPI.getDepartments();
                rows = (Array.isArray(list) ? list : []).map(d => ({
                    'Department ID': shortId(d.id),
                    'Name': d.name,
                    'Code': d.code || '',
                    'Students': d.studentCount,
                    'Instructors': d.instructorCount,
                    'Admins': d.adminCount,
                    'Courses': d.courseTotal,
                    'Enrollments': d.totalEnrollments,
                    'Avg Rating': d.avgRating != null ? Number(d.avgRating).toFixed(1) : '',
                    'Status': d.active === false ? 'Inactive' : 'Active',
                }));
            } else if (key === 'courses') {
                const list = await coursesAPI.getAll({ admin: true, limit: 1000 });
                rows = (Array.isArray(list) ? list : []).map(c => ({
                    'Course ID': shortId(c.id),
                    'Title': c.title,
                    'Department': c.departmentName || '',
                    'Instructor': c.instructorName || '',
                    'Category': c.categoryName || '',
                    'Students': c.enrollmentCount ?? '',
                    'Lessons': c.lessonsCount ?? '',
                    'Rating': c.rating != null ? Number(c.rating).toFixed(1) : '',
                    'Status': c.status,
                    'Created': fmtDate(c.createdAt),
                }));
            } else if (key === 'enrollments') {
                const plat = await statsAPI.getPlatform();
                rows = (plat?.enrollmentsByMonth || []).map(e => ({
                    'Month': e.month,
                    'Enrollments': e.count,
                }));
                if (rows.length === 0) {
                    const depts = await statsAPI.getDepartments();
                    rows = (Array.isArray(depts) ? depts : []).map(d => ({ 'Department': d.name, 'Enrollments': d.totalEnrollments }));
                }
                setData({ rows, extra: plat });
                return;
            } else if (key === 'completion') {
                const progress = await statsAPI.getStudentProgress({ limit: 1000 });
                const list = Array.isArray(progress) ? progress : progress?.data || [];
                rows = list.filter(p => p.enrolledCourses > 0).map(p => ({
                    'Student ID': shortId(p.id),
                    'Name': p.name,
                    'Email': p.email,
                    'Department': p.departmentName || '',
                    'Enrolled': p.enrolledCourses,
                    'Completed': p.completedCourses,
                    'Avg Progress': p.avgProgress != null ? `${p.avgProgress}%` : '',
                    'Quiz Attempts': p.quizAttempts ?? '',
                    'Avg Quiz Score': p.avgQuizScore ?? '',
                    'Last Active': p.lastActive ? fmtDate(p.lastActive) : '',
                }));
            } else if (key === 'performance') {
                const [plat, quizzes] = await Promise.all([
                    statsAPI.getPlatform(),
                    statsAPI.getQuizReport(),
                ]);
                rows = (Array.isArray(quizzes) ? quizzes : []).map(q => ({
                    'Course': q.courseTitle,
                    'Quizzes': q.quizzes,
                    'Attempts': q.attempts,
                    'Passed': q.passed,
                    'Pass Rate': q.attempts ? `${Math.round((q.passed / q.attempts) * 100)}%` : '',
                    'Avg Score': q.avgScore != null ? `${q.avgScore}%` : '',
                }));
                setData({ rows, extra: plat });
                return;
            } else if (key === 'attendance') {
                rows = await statsAPI.getAttendanceReport();
                rows = (Array.isArray(rows) ? rows : []).map(r => ({
                    'Course': r.courseTitle,
                    'Sessions': r.sessions,
                    'Records': r.records,
                    'Present': r.present,
                    'Absent': r.absent,
                    'Late': r.late,
                    'Excused': r.excused,
                    'Attendance %': r.records ? `${Math.round((r.present / r.records) * 100)}%` : '',
                }));
            } else if (key === 'assignments') {
                rows = await statsAPI.getAssignmentsReport();
                rows = (Array.isArray(rows) ? rows : []).map(r => ({
                    'Course': r.courseTitle,
                    'Assignments': r.assignments,
                    'Submissions': r.submissions,
                    'Submitting Students': r.submittingStudents,
                    'Avg Marks': r.avgMarks != null ? r.avgMarks : '',
                    'Max Marks': r.maxMarks,
                }));
            } else if (key === 'quizzes') {
                rows = await statsAPI.getQuizReport();
                rows = (Array.isArray(rows) ? rows : []).map(r => ({
                    'Course': r.courseTitle,
                    'Quizzes': r.quizzes,
                    'Attempts': r.attempts,
                    'Passed': r.passed,
                    'Pass Rate': r.attempts ? `${Math.round((r.passed / r.attempts) * 100)}%` : '',
                    'Avg Score': r.avgScore != null ? `${r.avgScore}%` : '',
                }));
            } else if (key === 'certificates') {
                rows = await statsAPI.getCertificateReport();
                rows = (Array.isArray(rows) ? rows : []).map(r => ({
                    'Course': r.courseTitle,
                    'Certificates': r.certificates,
                }));
            }
            setData({ rows });
        } catch (err) {
            toast.error(err.message || 'Failed to load report');
            setData({ rows: [] });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadReport(reportKey); }, [reportKey]);

    const rows = data?.rows || [];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const filename = `${reportMeta[reportKey].label.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

    const renderSummary = () => {
        const extra = data?.extra;
        if (!extra) return null;
        const items = [
            extra.totalUsers != null && { label: 'Total Users', value: extra.totalUsers },
            extra.totalEnrollments != null && { label: 'Total Enrollments', value: extra.totalEnrollments },
            extra.totalCourses != null && { label: 'Total Courses', value: extra.totalCourses },
            extra.avgRating != null && { label: 'Avg Rating', value: Number(extra.avgRating).toFixed(1) },
            extra.activeStudents != null && { label: 'Active Students', value: extra.activeStudents },
            extra.totalDepartments != null && { label: 'Departments', value: extra.totalDepartments },
        ].filter(Boolean);
        if (!items.length) return null;
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {items.map(it => (
                    <div key={it.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{it.label}</p>
                        <p className="text-xl font-black text-foreground mt-1">{it.value.toLocaleString?.() ?? it.value}</p>
                    </div>
                ))}
            </div>
        );
    };

    const meta = reportMeta[reportKey];
    const ExportIcon = meta.icon;

    return (
        <div className="space-y-6 max-w-7xl w-full mx-auto px-0 pb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <ExportIcon size={28} className="text-indigo-600" /> Reports
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Platform-wide reports across students, instructors, courses, and activity</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => loadReport(reportKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button onClick={() => exportCSV(rows, filename)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
                        <FileSpreadsheet size={14} className="text-emerald-600" /> CSV
                    </button>
                    <button onClick={() => exportExcel(rows, filename)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
                        <FileSpreadsheet size={14} className="text-emerald-600" /> Excel
                    </button>
                    <button onClick={() => exportPDF(rows, meta.label, filename)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
                        <Printer size={14} className="text-rose-600" /> PDF
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-4 gap-6">
                {/* Report type nav */}
                <div className="space-y-4">
                    {GROUP_ORDER.map(group => (
                        <div key={group} className="bg-card border border-border rounded-2xl p-3 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-2 mb-1.5">{group}</p>
                            <div className="space-y-0.5">
                                {Object.entries(reportMeta)
                                    .filter(([, m]) => m.group === group)
                                    .map(([key, m]) => (
                                        <button key={key} onClick={() => setReportKey(key)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                                                reportKey === key ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30' : 'text-muted-foreground hover:bg-muted/40'
                                            }`}>
                                            <m.icon size={15} /> {m.label}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Report body */}
                <div className="lg:col-span-3 space-y-5">
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                <meta.icon size={18} className="text-indigo-500" /> {meta.label}
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">{rows.length.toLocaleString()} rows</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 text-xs font-black uppercase tracking-wider">
                            <Download size={13} /> {groupOf(reportKey)}
                        </span>
                    </div>

                    {renderSummary()}

                    <DataTable columns={columns} loading={loading} empty={!loading && rows.length === 0} emptyText="No data available for this report yet.">
                        {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                                {columns.map(col => (
                                    <td key={col} className="px-3 sm:px-4 md:px-6 py-3.5 text-sm font-medium text-foreground/85 whitespace-nowrap">
                                        {row[col]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </DataTable>
                </div>
            </div>
        </div>
    );
}

function groupOf(key) {
    return reportMeta[key]?.group || '';
}
