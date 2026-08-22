import { useState } from 'react';
import { GripVertical, Loader2 } from 'lucide-react';

/**
 * BucketBoard — drag cards between labeled buckets (used by the course →
 * category and course → semester drag pages).
 *
 * Props:
 *  - items: all items (must have a stable `itemKey`)
 *  - itemKey: key field (default 'id')
 *  - getBucket(item): bucket key the item currently sits in ('' or null for unassigned)
 *  - buckets: [{ key, label, accent }] — the labeled buckets (unassigned is implicit)
 *  - renderItem(item): card content
 *  - onMove(item, fromBucket, toBucket): persist the move
 *  - busy: disable while saving
 *  - unassignedLabel: heading for the no-bucket column (default 'Unassigned')
 */
export default function BucketBoard({
    items = [],
    itemKey = 'id',
    getBucket = () => '',
    buckets = [],
    renderItem = (item) => item.name,
    onMove = () => {},
    busy = false,
    unassignedLabel = 'Unassigned',
}) {
    const [dragOver, setDragOver] = useState(null); // bucket key ('' for unassigned)

    const keyOf = (item) => item?.[itemKey];

    const handleDrop = (e, bucketKey) => {
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
        const moved = keys.map(k => items.find(i => String(keyOf(i)) === String(k))).filter(Boolean);
        for (const item of moved) {
            const from = getBucket(item) || '';
            const to = bucketKey || '';
            if (from !== to) onMove(item, from, to);
        }
    };

    const byBucket = (key) => items.filter(i => (getBucket(i) || '') === key);

    const Bucket = ({ bucketKey, title, accent, bucketItems }) => (
        <div
            onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(bucketKey); }}
            onDragLeave={() => setDragOver(prev => (prev === bucketKey ? null : prev))}
            onDrop={e => handleDrop(e, bucketKey)}
            className={`flex flex-col rounded-2xl border-2 transition-colors min-w-[230px] w-[230px] ${
                dragOver === bucketKey ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-border bg-card'
            }`}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${accent}`} /> {title}
                </p>
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-black">{bucketItems.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[160px]" style={{ maxHeight: 420 }}>
                {bucketItems.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground/60 py-10">Drop here</p>
                ) : bucketItems.map(item => (
                    <div
                        key={keyOf(item)}
                        draggable={!busy}
                        onDragStart={e => {
                            if (busy) return;
                            e.dataTransfer.setData('application/x-keys', JSON.stringify([String(keyOf(item))]));
                            e.dataTransfer.setData('text/plain', String(keyOf(item)));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-muted/30 hover:border-indigo-300 cursor-grab active:cursor-grabbing transition-colors select-none"
                        title="Drag to another bucket"
                    >
                        <GripVertical size={14} className="text-muted-foreground/40 group-hover:text-indigo-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">{renderItem(item)}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            <Bucket bucketKey="" title={unassignedLabel} accent="bg-slate-400" bucketItems={byBucket('')} />
            {buckets.map(b => (
                <Bucket key={b.key} bucketKey={b.key} title={b.label} accent={b.accent} bucketItems={byBucket(b.key)} />
            ))}
            {busy && <div className="flex items-center justify-center w-32"><Loader2 size={20} className="animate-spin text-indigo-600" /></div>}
        </div>
    );
}
