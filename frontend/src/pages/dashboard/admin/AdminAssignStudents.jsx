import { useMemo, useState } from 'react';
import { BookOpen, GraduationCap, CheckCircle2, Users, Loader2 } from 'lucide-react';
import { coursesAPI, enrollmentsAPI, usersAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import DragTransfer from '../../../components/ui/DragTransfer';
import toast from 'react-hot-toast';

export default function AdminAssignStudents() {
    const [courseId, setCourseId] = useState('');
    const [busy, setBusy] = useState(false);

    const { data: courses, loading: coursesLoading } = useAsyncData(
        () => coursesAPI.getAll({ admin: true, limit: 200 }),
        []
    );
    const course = (courses || []).find(c => c.id === courseId) || null;

    // All department students (or all students for SUPER_ADMIN on a global course).
    const { data: allStudents, loading: loadingStudents, reload: reloadStudents } = useAsyncData(
        () => course
            ? usersAPI.getAll({ role: 'STUDENT', limit: 1000, departmentId: course.departmentId || undefined })
            : Promise.resolve([]),
        [courseId]
    );

    // Students already enrolled in the selected course.
    const { data: enrolled, loading: loadingEnrolled, reload: reloadEnrolled } = useAsyncData(
        () => courseId ? enrollmentsAPI.getCourseStudents(courseId).catch(() => []) : Promise.resolve([]),
        [courseId]
    );

    const enrolledList = useMemo(() => (Array.isArray(enrolled) ? enrolled : []), [enrolled]);
    const allList = useMemo(() => (Array.isArray(allStudents) ? allStudents : []), [allStudents]);
    const enrolledIds = useMemo(() => new Set(enrolledList.map(s => s.id)), [enrolledList]);

    // Available = students in scope not yet enrolled.
    const availableList = useMemo(() => allList.filter(s => !enrolledIds.has(s.id)), [allList, enrolledIds]);

    const refresh = () => { reloadEnrolled(); reloadStudents(); };

    const renderStudent = (s) => (
        <span className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 text-[10px] font-black text-muted-foreground">
                {(s.name || '?')[0].toUpperCase()}
            </span>
            <span className="truncate">
                {s.name}
                {s.rollNo && <span className="text-xs font-medium text-muted-foreground ml-1.5">{s.rollNo}</span>}
            </span>
        </span>
    );

    const handleTransfer = async (items, direction) => {
        if (!courseId || !items.length) return;
        setBusy(true);
        const ids = items.map(i => i.id);
        try {
            if (direction === 'toRight') {
                const res = await enrollmentsAPI.bulkEnroll(courseId, ids);
                toast.success(`Enrolled ${res.enrolled}/${ids.length} student${ids.length === 1 ? '' : 's'} in "${course.title}"`);
            } else {
                const res = await enrollmentsAPI.bulkUnenroll(courseId, ids);
                toast.success(`Unenrolled ${res.removed}/${ids.length} student${ids.length === 1 ? '' : 's'} from "${course.title}"`);
            }
            refresh();
        } catch (err) {
            toast.error(err.message || 'Transfer failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        <Users size={26} className="text-indigo-600" />
                        Assign Students to Course
                    </span>
                }
                subtitle="Drag students between Available and Enrolled — or select rows and use the arrows"
            />

            {/* Course selector */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-2">Course</label>
                {coursesLoading ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Loader2 size={15} className="animate-spin" /> Loading courses…</div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                        <select
                            value={courseId}
                            onChange={e => setCourseId(e.target.value)}
                            className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium cursor-pointer"
                        >
                            <option value="">Select a course…</option>
                            {(courses || []).map(c => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                        {course && (
                            <div className="flex items-center gap-3 text-sm">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 font-bold">
                                    <GraduationCap size={14} /> {course.departmentName || 'No department'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
                                    <BookOpen size={14} /> {course.status}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold">
                                    <CheckCircle2 size={14} /> {enrolledList.length} enrolled
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!courseId ? (
                <div className="text-center py-16 text-muted-foreground/70">
                    <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-bold">Select a course to start assigning students</p>
                    <p className="text-sm font-medium mt-1">Only courses in your department are listed — other departments are blocked server-side.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                        Drag students from <b>Available</b> into <b>Enrolled</b> to assign them to the course — and back to remove them. Changes save immediately.
                    </p>
                    {(loadingStudents || loadingEnrolled) && !busy ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground font-medium"><Loader2 size={18} className="animate-spin" /> Loading students…</div>
                    ) : (
                        <DragTransfer
                            leftTitle="Available Students"
                            leftHint={`${availableList.length} in your department, not enrolled`}
                            leftItems={availableList}
                            rightTitle="Enrolled Students"
                            rightHint={`${enrolledList.length} enrolled in this course`}
                            rightItems={enrolledList}
                            renderItem={renderStudent}
                            itemKey="id"
                            onTransfer={handleTransfer}
                            busy={busy}
                            emptyText="No students in this list"
                        />
                    )}
                    {busy && <p className="text-xs font-bold text-indigo-600 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Saving…</p>}
                </div>
            )}
        </div>
    );
}
