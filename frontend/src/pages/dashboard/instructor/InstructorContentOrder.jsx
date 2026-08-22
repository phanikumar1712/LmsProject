import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListOrdered, GripVertical, ChevronDown, ChevronRight, Loader2, BookOpen, Video, FileText, CheckSquare, Save, Headphones, Type, ClipboardList, Code2, ExternalLink } from 'lucide-react';
import { coursesAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

// ── Vertical drag-sort list (HTML5). Live-reorders on drag-over and calls
// onCommit(ids) when a same-list drag finishes. Lesson lists (listType
// "lessons") additionally support CROSS-MODULE moves: drag a lesson and drop it
// on another module's rows to move it there. Cross-list state travels through a
// shared `dragRef` (a plain mutable ref, read synchronously by the drop/dragend
// handlers — React state would be stale between the two events). ─────────────
function SortableList({
    items, itemKey = 'id', renderItem, onCommit, busy, title,
    listType = 'sections', sectionId = null, dragRef = null,
    onLessonDropForeign = null, hoverSectionId = null, onHoverSection = null,
}) {
    const [order, setOrder] = useState(items);
    const [dragIdx, setDragIdx] = useState(null);

    useEffect(() => { setOrder(items); }, [items]);

    const commit = (list) => {
        const ids = list.map(i => i[itemKey]);
        if (JSON.stringify(ids) !== JSON.stringify(items.map(i => i[itemKey]))) {
            onCommit(ids);
        }
        setDragIdx(null);
    };

    const isLesson = listType === 'lessons';
    const drag = () => (dragRef ? dragRef.current : null);
    // Is a lesson from a DIFFERENT section being dragged over this row?
    const isForeignTarget = (targetSectionId) => {
        const d = drag();
        return !!(d && d.type === 'lesson' && d.fromSectionId !== targetSectionId);
    };

    return (
        <div className="space-y-1.5">
            {order.length === 0 && <p className="text-center text-xs text-muted-foreground/60 py-6">{title || 'Nothing here yet'}</p>}
            {order.map((item, idx) => {
                const targetSectionId = isLesson ? sectionId : item[itemKey];
                // Row is the currently highlighted cross-module drop target
                // (driven by state so no ref is read during render).
                const dropTarget = hoverSectionId === targetSectionId;
                return (
                    // Note: this list may be nested inside another SortableList
                    // (lessons inside a module). HTML5 drag events bubble, so every
                    // handler must stopPropagation() once this row is the active
                    // drag source — otherwise dragging a lesson would reorder the
                    // parent modules too and fire a spurious reorderSections() call.
                    <div
                        key={item[itemKey]}
                        draggable={!busy}
                        onDragStart={e => {
                            if (busy) return;
                            setDragIdx(idx);
                            if (dragRef) {
                                dragRef.current = isLesson
                                    ? { type: 'lesson', lessonId: item[itemKey], fromSectionId: sectionId }
                                    : { type: 'section' };
                            }
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(idx));
                            e.stopPropagation();
                        }}
                        onDragEnter={e => {
                            e.preventDefault();
                            // A lesson from another module is hovering this row —
                            // flag the module as the drop target (visual feedback).
                            if (isForeignTarget(targetSectionId) && hoverSectionId !== targetSectionId) {
                                onHoverSection(targetSectionId);
                            }
                            if (busy || dragIdx === null || dragIdx === idx) return;
                            setOrder(prev => {
                                const next = [...prev];
                                const [moved] = next.splice(dragIdx, 1);
                                next.splice(idx, 0, moved);
                                return next;
                            });
                            setDragIdx(idx);
                            // We're reordering this list — keep the parent list from
                            // treating the hover as a drag over its own rows. When
                            // dragIdx is null (a parent drag is in progress) we leave
                            // the event bubbling so the parent can reorder.
                            e.stopPropagation();
                        }}
                        onDragOver={e => {
                            e.preventDefault();
                            if (dragIdx !== null) e.stopPropagation();
                        }}
                        onDrop={e => {
                            e.preventDefault();
                            // A lesson from another module dropped here → move it.
                            if (isForeignTarget(targetSectionId)) {
                                e.stopPropagation();
                                if (dragRef) {
                                    dragRef.current = { ...drag(), movedToSectionId: targetSectionId };
                                }
                                if (onHoverSection) onHoverSection(null);
                                if (onLessonDropForeign) {
                                    const order = isLesson ? idx + 1 : (item.lessons?.length || 0) + 1;
                                    onLessonDropForeign(drag().lessonId, targetSectionId, order);
                                }
                                setDragIdx(null);
                                return;
                            }
                            if (dragIdx !== null) e.stopPropagation();
                            commit(order);
                        }}
                        onDragEnd={e => {
                            e.stopPropagation();
                            // If this lesson was dropped into another module, the move
                            // already fired — don't also commit a stale reorder.
                            const d = drag();
                            if (d && d.type === 'lesson' && d.movedToSectionId) {
                                if (dragRef) dragRef.current = null;
                                if (onHoverSection) onHoverSection(null);
                                setDragIdx(null);
                                return;
                            }
                            if (dragRef) dragRef.current = null;
                            if (onHoverSection) onHoverSection(null);
                            commit(order);
                        }}
                        onDragLeave={!isLesson ? (e) => {
                            // Only clear the drop-target highlight when the cursor
                            // leaves the whole module row (not just its children).
                            if (!e.currentTarget.contains(e.relatedTarget) && onHoverSection) {
                                onHoverSection(null);
                            }
                        } : undefined}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-colors select-none ${
                            dragIdx === idx
                                ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30'
                                : dropTarget
                                    ? 'border-indigo-500 ring-2 ring-indigo-200/80 bg-indigo-50/50 dark:bg-indigo-950/40'
                                    : 'border-border bg-muted/30 hover:border-indigo-200'
                        }`}
                    >
                        <GripVertical size={15} className="text-muted-foreground/40 flex-shrink-0" />
                        {renderItem(item)}
                    </div>
                );
            })}
        </div>
    );
}

const TYPE_ICON = {
    video: <Video size={13} />,
    pdf: <FileText size={13} />,
    document: <FileText size={13} />,
    audio: <Headphones size={13} />,
    text: <Type size={13} />,
    quiz: <CheckSquare size={13} />,
    assignment: <ClipboardList size={13} />,
    coding: <Code2 size={13} />,
    external: <ExternalLink size={13} />,
};

export default function InstructorContentOrder() {
    const { user } = useAuth();
    const [params] = useSearchParams();
    const [courseId, setCourseId] = useState(params.get('course') || '');
    const [busy, setBusy] = useState(false);
    const [expanded, setExpanded] = useState(new Set());
    // Shared drag state between the nested lesson lists and the module list
    // (plain ref — drop and dragend fire in the same tick, so state is stale).
    const dragRef = useRef(null);
    // Module id currently highlighted as a cross-module lesson drop target.
    const [hoverSec, setHoverSec] = useState(null);

    const { data: myCourses } = useAsyncData(
        () => user?.id ? coursesAPI.getByInstructor(user.id) : Promise.resolve([]),
        [user?.id]
    );
    const courseList = useMemo(() => (Array.isArray(myCourses) ? myCourses : []), [myCourses]);

    // Preselect ?course=<id> once the course list loads (deep link from course cards).
    useEffect(() => {
        const qs = params.get('course');
        if (qs && courseList.some(c => c.id === qs)) setCourseId(qs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseList]);

    const { data: rows, loading: loadingRows, reload: reloadRows } = useAsyncData(
        () => courseId ? coursesAPI.getLessons(courseId) : Promise.resolve([]),
        [courseId]
    );

    // getLessons returns { sections: [...], lessons: [...] } — nest lessons under
    // their section, each sorted by its `order` column.
    const sections = useMemo(() => {
        const data = rows || {};
        const secList = Array.isArray(data.sections) ? data.sections : [];
        const lessonList = Array.isArray(data.lessons) ? data.lessons : [];
        return secList
            .map(sec => ({
                id: sec.id,
                title: sec.title,
                order: sec.order,
                lessons: lessonList
                    .filter(l => l.section_id === sec.id)
                    .sort((a, b) => a.order - b.order)
                    .map(l => ({ id: l.id, title: l.title, type: l.type, order: l.order })),
            }))
            .sort((a, b) => a.order - b.order);
    }, [rows]);

    const handleSectionsCommit = async (sectionIds) => {
        setBusy(true);
        try {
            const res = await coursesAPI.reorderSections(courseId, sectionIds);
            toast.success(`Sections reordered (${res.reordered})`);
            reloadRows();
        } catch (err) {
            toast.error(err.message || 'Failed to reorder sections');
        } finally {
            setBusy(false);
        }
    };

    const handleLessonsCommit = async (sectionId, lessonIds) => {
        setBusy(true);
        try {
            const res = await coursesAPI.reorderLessons(sectionId, lessonIds);
            toast.success(`Lessons reordered (${res.reordered})`);
            reloadRows();
        } catch (err) {
            toast.error(err.message || 'Failed to reorder lessons');
        } finally {
            setBusy(false);
        }
    };

    // Cross-module lesson move (drag a lesson onto another module's rows).
    const handleLessonMove = async (lessonId, targetSectionId, order) => {
        setBusy(true);
        try {
            await coursesAPI.moveLesson(lessonId, targetSectionId, order);
            const target = sections.find(s => s.id === targetSectionId);
            toast.success(`Lesson moved to ${target?.title ? `"${target.title}"` : 'module'} #${order}`);
            reloadRows();
        } catch (err) {
            toast.error(err.message || 'Failed to move lesson');
        } finally {
            setBusy(false);
        }
    };

    const toggleSection = (id) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        <ListOrdered size={26} className="text-indigo-600" /> Course Content Order
                    </span>
                }
                subtitle="Drag modules and lessons to reorder them — drag a lesson onto another module to move it. Changes save automatically"
            />

            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-2">Course</label>
                <select
                    value={courseId}
                    onChange={e => setCourseId(e.target.value)}
                    className="w-full px-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium cursor-pointer"
                >
                    <option value="">Select one of your courses…</option>
                    {courseList.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
            </div>

            {!courseId ? (
                <div className="text-center py-16 text-muted-foreground/70">
                    <ListOrdered size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-bold">Select a course to reorder its content</p>
                </div>
            ) : loadingRows ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground font-medium"><Loader2 size={18} className="animate-spin" /> Loading content…</div>
            ) : sections.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/70">
                    <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-bold">This course has no modules yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-muted-foreground">
                            Modules: <b className="text-foreground">{sections.length}</b> · Lessons: <b className="text-foreground">{sections.reduce((n, s) => n + s.lessons.length, 0)}</b>
                        </p>
                        {busy && <p className="text-xs font-bold text-indigo-600 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Saving…</p>}
                    </div>

                    <SortableList
                        items={sections}
                        itemKey="id"
                        listType="sections"
                        busy={busy}
                        dragRef={dragRef}
                        hoverSectionId={hoverSec}
                        onHoverSection={setHoverSec}
                        onLessonDropForeign={handleLessonMove}
                        onCommit={handleSectionsCommit}
                        title="No modules yet"
                        renderItem={(sec) => (
                            <div className="flex-1 min-w-0">
                                <button onClick={() => toggleSection(sec.id)} className="w-full flex items-center justify-between gap-2 text-left">
                                    <span className="text-sm font-bold text-foreground truncate flex items-center gap-2">
                                        {expanded.has(sec.id) ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                                        {sec.title || 'Untitled module'}
                                    </span>
                                    <span className="text-[11px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex-shrink-0">{sec.lessons.length} lessons</span>
                                </button>
                                {expanded.has(sec.id) && (
                                    <div className="mt-2 ml-7 pl-3 border-l-2 border-border">
                                        <SortableList
                                            items={sec.lessons}
                                            itemKey="id"
                                            listType="lessons"
                                            sectionId={sec.id}
                                            busy={busy}
                                            dragRef={dragRef}
                                            hoverSectionId={hoverSec}
                                            onHoverSection={setHoverSec}
                                            onLessonDropForeign={handleLessonMove}
                                            onCommit={(ids) => handleLessonsCommit(sec.id, ids)}
                                            title="No lessons — drag a lesson here from another module"
                                            renderItem={(lesson) => (
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <span className="text-muted-foreground flex-shrink-0">{TYPE_ICON[lesson.type] || <FileText size={13} />}</span>
                                                    <span className="text-sm font-semibold text-foreground truncate">{lesson.title}</span>
                                                </div>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    />

                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Save size={12} /> Tip: drag a module to reorder it; expand a module (chevron) to drag its lessons or drop a lesson onto it from another module. Changes save when the drag ends.
                    </p>
                </div>
            )}
        </div>
    );
}
