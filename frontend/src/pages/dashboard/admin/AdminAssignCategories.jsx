import { useMemo, useState } from 'react';
import { Layers, Loader2, BookOpen, Building2 } from 'lucide-react';
import { coursesAPI, statsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import BucketBoard from '../../../components/ui/BucketBoard';
import toast from 'react-hot-toast';

const ACCENTS = ['bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500'];

export default function AdminAssignCategories() {
    const { data: courses, loading, reload } = useAsyncData(
        () => coursesAPI.getAll({ admin: true, limit: 500 }),
        []
    );
    const { data: categories } = useAsyncData(
        () => statsAPI.getCategories().catch(() => []),
        []
    );
    const [busy, setBusy] = useState(false);

    const courseList = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
    const catList = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);

    const buckets = useMemo(() => catList.map((c, i) => ({
        key: c.id,
        label: `${c.icon || '📚'} ${c.name}`,
        accent: ACCENTS[i % ACCENTS.length],
    })), [catList]);

    const renderCourse = (c) => (
        <span className="flex items-center gap-2 min-w-0">
            <BookOpen size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="truncate text-sm font-semibold text-foreground">{c.title}</span>
        </span>
    );

    const handleMove = async (course, fromBucket, toBucket) => {
        setBusy(true);
        try {
            await coursesAPI.update(course.id, { categoryId: toBucket || null });
            toast.success(`"${course.title}" → ${toBucket ? 'assigned' : 'unassigned'}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Move failed');
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
                        <Layers size={26} className="text-indigo-600" /> Assign Course Categories
                    </span>
                }
                subtitle="Drag course cards between category buckets — drop onto any column to recategorize"
            />
            {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground font-medium"><Loader2 size={18} className="animate-spin" /> Loading courses…</div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Building2 size={14} className="text-cyan-600" />
                        Only courses in your department are shown — other departments are blocked server-side.
                    </p>
                    <BucketBoard
                        items={courseList}
                        getBucket={(c) => c.categoryId || ''}
                        buckets={buckets}
                        renderItem={renderCourse}
                        onMove={handleMove}
                        busy={busy}
                        unassignedLabel="Uncategorized"
                    />
                    {busy && <p className="text-xs font-bold text-indigo-600">Saving…</p>}
                </div>
            )}
        </div>
    );
}
