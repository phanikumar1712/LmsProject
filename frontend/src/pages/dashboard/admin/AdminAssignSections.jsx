import { useMemo, useState } from 'react';
import { Layers, Plus, X, Loader2, GraduationCap } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

const SECTION_OPTIONS = ['A', 'B', 'C'];

export default function AdminAssignSections() {
    const { data: students, loading, reload } = useAsyncData(
        () => usersAPI.getAll({ role: 'STUDENT', limit: 1000 }),
        []
    );
    const list = useMemo(() => (Array.isArray(students) ? students : []), [students]);

    const [busy, setBusy] = useState(false);
    const [dragOver, setDragOver] = useState(null); // section or '__none__'
    const [customSections, setCustomSections] = useState([]);
    const [newSection, setNewSection] = useState('');

    const sections = useMemo(() => {
        const existing = [...new Set(list.map(s => s.section).filter(Boolean))];
        return [...new Set([...SECTION_OPTIONS, ...existing, ...customSections])].sort();
    }, [list, customSections]);

    const ACCENTS = [
        'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500',
    ];

    const bySection = (sec) => list.filter(s => (s.section || '') === sec);
    const unassigned = list.filter(s => !s.section);

    const moveTo = async (studentIds, section) => {
        if (!studentIds.length) return;
        setBusy(true);
        try {
            const res = await usersAPI.bulkAssignCohort(studentIds, { section });
            toast.success(`Moved ${res.updated} student${res.updated === 1 ? '' : 's'}${section ? ` to Section ${section}` : ' out of all sections'}`);
            reload();
        } catch (err) {
            toast.error(err.message || 'Move failed');
        } finally {
            setBusy(false);
        }
    };

    const handleDrop = (e, section) => {
        e.preventDefault();
        setDragOver(null);
        if (busy) return;
        let keys = [];
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/x-keys'));
            keys = Array.isArray(data) ? data : [];
        } catch {
            const single = e.dataTransfer.getData('text/plain');
            if (single) keys = [single];
        }
        const ids = keys.map(String);
        if (!ids.length) return;
        const targets = list.filter(s => ids.includes(String(s.id)));
        moveTo(targets.map(s => s.id), section);
    };

    const addCustomSection = () => {
        const v = newSection.trim().toUpperCase();
        if (!v) return;
        if (sections.includes(v)) { toast.error(`Section ${v} already exists`); return; }
        setCustomSections(p => [...p, v]);
        setNewSection('');
    };

    const StudentCard = ({ s }) => (
        <div
            draggable={!busy}
            onDragStart={e => {
                if (busy) return;
                e.dataTransfer.setData('application/x-keys', JSON.stringify([String(s.id)]));
                e.dataTransfer.setData('text/plain', String(s.id));
                e.dataTransfer.effectAllowed = 'copy';
            }}
            className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-muted/30 hover:border-indigo-300 cursor-grab active:cursor-grabbing transition-colors select-none"
            title="Drag to another section"
        >
            <span className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 text-[11px] font-black text-muted-foreground">
                {(s.name || '?')[0].toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                <p className="text-[11px] font-medium text-muted-foreground truncate">
                    {[s.rollNo && `Roll ${s.rollNo}`, s.year != null && `Y${s.year}`, s.batch].filter(Boolean).join(' · ') || s.email}
                </p>
            </div>
        </div>
    );

    const Bucket = ({ title, items, section, accent }) => (
        <div
            onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(section); }}
            onDragLeave={() => setDragOver(prev => (prev === section ? null : prev))}
            onDrop={e => handleDrop(e, section)}
            className={`flex flex-col rounded-2xl border-2 transition-colors min-w-[230px] w-[230px] ${
                dragOver === section ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-border bg-card'
            }`}
        >
            <div className={`flex items-center justify-between px-4 py-3 border-b border-border rounded-t-2xl`}>
                <p className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${accent}`} /> {title}
                </p>
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-black">{items.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[160px]" style={{ maxHeight: 420 }}>
                {items.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground/60 py-10">Drop students here</p>
                ) : items.map(s => <StudentCard key={s.id} s={s} />)}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                border
                title={
                    <span className="flex items-center gap-3">
                        <Layers size={26} className="text-indigo-600" />
                        Assign Sections
                    </span>
                }
                subtitle="Drag student cards between section buckets — drop them onto any column to move them"
            />

            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-muted-foreground">Add section:</span>
                <div className="flex items-center gap-2">
                    <input
                        value={newSection}
                        onChange={e => setNewSection(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSection(); } }}
                        placeholder="e.g. D"
                        maxLength={2}
                        className="w-24 px-3 py-2 bg-card border border-border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button onClick={addCustomSection} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"><Plus size={15} /></button>
                </div>
                <span className="text-xs font-medium text-muted-foreground ml-auto">{list.length} students · {busy && <Loader2 size={12} className="inline animate-spin" />}</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground font-medium"><Loader2 size={18} className="animate-spin" /> Loading students…</div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    <Bucket title="Unassigned" items={unassigned} section="__none__" accent="bg-slate-400" />
                    {sections.map((sec, i) => (
                        <div key={sec} className="flex items-start">
                            <Bucket
                                title={`Section ${sec}`}
                                items={bySection(sec)}
                                section={sec}
                                accent={ACCENTS[i % ACCENTS.length]}
                            />
                            {customSections.includes(sec) && (
                                <button
                                    onClick={() => setCustomSections(p => p.filter(s => s !== sec))}
                                    className="ml-1 mt-1 p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-muted transition-colors"
                                    title={`Remove section ${sec} (students are not changed)`}
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <GraduationCap size={14} />
                Changes save immediately. Dropping into <b>Unassigned</b> removes the student's section.
            </p>
        </div>
    );
}
