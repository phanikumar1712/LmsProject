import { useState } from 'react';
import { GripVertical, Loader2, X, Copy } from 'lucide-react';

/**
 * MultiBucketBoard — drag cards into labeled buckets where ONE item can live in
 * SEVERAL buckets at once (copy semantics). Used by the course → semester and
 * course → year drag pages.
 *
 * Props:
 *  - items: all items (must have a stable `itemKey`)
 *  - itemKey: key field (default 'id')
 *  - getBuckets(item): array of bucket keys the item is currently assigned to
 *  - buckets: [{ key, label, accent }] — the labeled buckets
 *  - renderItem(item): card content
 *  - onAdd(item, bucketKey): persist adding the item to a bucket (copy)
 *  - onRemove(item, bucketKey): persist removing the item from a bucket
 *  - busy: disable while saving
 *  - unassignedLabel: heading for the no-bucket column (default 'Unassigned')
 *  - copyHint: short helper text about copy semantics
 */
export default function MultiBucketBoard({
    items = [],
    itemKey = 'id',
    getBuckets = () => [],
    buckets = [],
    renderItem = (item) => item.name,
    onAdd = () => {},
    onRemove = () => {},
    busy = false,
    unassignedLabel = 'Unassigned',
    copyHint,
}) {
    const [dragOver, setDragOver] = useState(null); // bucket key ('' for unassigned)

    const keyOf = (item) => item?.[itemKey];
    const bucketsOf = (item) => {
        const b = getBuckets(item) || [];
        return Array.isArray(b) ? b.map(String) : [];
    };
    const unassigned = items.filter(i => bucketsOf(i).length === 0);
    const assigned = (key) => items.filter(i => bucketsOf(i).includes(String(key)));

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
        if (bucketKey === '') return; // dropping on unassigned does nothing
        const moved = keys.map(k => items.find(i => String(keyOf(i)) === String(k))).filter(Boolean);
        for (const item of moved) {
            if (!bucketsOf(item).includes(String(bucketKey))) onAdd(item, bucketKey);
        }
    };

    const Bucket = ({ bucketKey, title, accent, bucketItems }) => (
        <div
            onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(bucketKey); }}
            onDragLeave={() => setDragOver(prev => (prev === bucketKey ? null : prev))}
            onDrop={e => handleDrop(e, bucketKey)}
            className={`flex flex-col rounded-2xl border-2 transition-colors min-w-[240px] w-[240px] ${
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
                    <p className="text-center text-xs text-muted-foreground/60 py-10">Drop here to copy</p>
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
                        title="Drag to another bucket to copy it there too"
                    >
                        <GripVertical size={14} className="text-muted-foreground/40 group-hover:text-indigo-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">{renderItem(item)}</div>
                        {bucketKey !== '' && (
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) onRemove(item, bucketKey); }}
                                className="p-1 rounded-md text-muted-foreground/50 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0"
                                title={`Remove from ${title}`}
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="flex gap-4 overflow-x-auto pb-4">
                <Bucket bucketKey="" title={unassignedLabel} accent="bg-slate-400" bucketItems={unassigned} />
                {buckets.map(b => (
                    <Bucket key={b.key} bucketKey={b.key} title={b.label} accent={b.accent} bucketItems={assigned(b.key)} />
                ))}
                {busy && <div className="flex items-center justify-center w-32"><Loader2 size={20} className="animate-spin text-indigo-600" /></div>}
            </div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Copy size={13} className="text-indigo-500" />
                {copyHint || 'Drop a card onto a bucket to add it there — the same course can be in several buckets at once. Use ✕ to remove it from one bucket.'}
            </p>
        </div>
    );
}
