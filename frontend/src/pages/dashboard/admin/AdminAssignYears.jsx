import { useMemo, useState } from 'react';
import { CalendarRange, Loader2, BookOpen, Building2 } from 'lucide-react';
import { coursesAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import MultiBucketBoard from '../../../components/ui/MultiBucketBoard';
import toast from 'react-hot-toast';

const YEAR_COUNT = 4;
const ACCENTS = ['bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500'];

export default function AdminAssignYears() {
    const { data: courses, loading, reload } = useAsyncData(
        () => coursesAPI.getAll({ admin: true, limit: 500 }),
        []
    );
    const [busy, setBusy] = useState(false);

    const courseList = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);

    const buckets = useMemo(() => Array.from({ length: YEAR_COUNT }, (_, i) => ({
        key: String(i + 1),
        label: `${i + 1}${['st', 'nd', 'rd', 'th'][i] || 'th'} Year`,
        accent: ACCENTS[i % ACCENTS.length],
    })), []);

    const renderCourse = (c) => (
        <span className="flex items-center gap-2 min-w-0">
            <BookOpen size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="truncate text-sm font-semibold text-foreground">{c.title}</span>
        </span>
    );

    const handleAdd = async (course, year) => {
        setBusy(true);
        try {
            await coursesAPI.addBuckets(course.id, { years: [Number(year)] });
            toast.success(`"${course.title}" added to Year ${year}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (course, year) => {
        setBusy(true);
        try {
            await coursesAPI.removeBuckets(course.id, { years: [Number(year)] });
            toast.success(`"${course.title}" removed from Year ${year}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        <CalendarRange size={26} className="text-indigo-600" /> Assign Course Years
                    </span>
                }
                subtitle="Drag course cards into 1st–4th Year buckets — one course can be copied into several years"
            />
            {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground font-medium"><Loader2 size={18} className="animate-spin" /> Loading courses…</div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Building2 size={14} className="text-cyan-600" />
                        Only courses in your department are shown — other departments are blocked server-side.
                    </p>
                    <MultiBucketBoard
                        items={courseList}
                        getBuckets={(c) => (c.years || []).map(String)}
                        buckets={buckets}
                        renderItem={renderCourse}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                        busy={busy}
                        unassignedLabel="No Year"
                        copyHint="Drop a course onto a year to add it there. The same course can be in several years at once — use ✕ to remove it from one year."
                    />
                    {busy && <p className="text-xs font-bold text-indigo-600">Saving…</p>}
                </div>
            )}
        </div>
    );
}
