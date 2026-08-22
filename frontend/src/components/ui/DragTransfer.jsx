import { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Search, GripVertical, Loader2 } from 'lucide-react';

/**
 * A single side of the transfer control (module-level to avoid creating
 * components during render).
 */
const Panel = ({
    title,
    hint,
    items,
    selection,
    itemKey,
    onToggle,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    isOver,
    busy,
    searchValue,
    onSearchChange,
    emptyText,
    renderItem,
}) => (
    <div
        className={`flex flex-col rounded-2xl border-2 bg-card transition-colors min-h-[320px] ${
            isOver ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-border'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
                <p className="text-sm font-extrabold text-foreground">{title}</p>
                {hint && <p className="text-[11px] font-medium text-muted-foreground">{hint}</p>}
            </div>
            {selection.size > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] font-black">
                    {selection.size} selected
                </span>
            )}
        </div>
        <div className="p-3 border-b border-border">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                    value={searchValue}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: 340 }}>
            {items.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground/70 py-8">{searchValue ? 'No matches' : emptyText}</p>
            ) : items.map(item => {
                const key = item?.[itemKey];
                const checked = selection.has(key);
                return (
                    <div
                        key={key}
                        draggable={!busy}
                        onDragStart={e => onDragStart(e, item)}
                        onClick={() => onToggle(key)}
                        className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                            checked
                                ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                                : 'border-border bg-muted/30 hover:border-indigo-200 hover:bg-muted/60'
                        } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                        <GripVertical size={14} className="text-muted-foreground/40 group-hover:text-indigo-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">{renderItem(item)}</div>
                    </div>
                );
            })}
        </div>
    </div>
);

/**
 * DragTransfer — a premium dual-list transfer control.
 *
 * Left = "available", Right = "selected/enrolled". Users can drag individual
 * rows (or a selection) across, or click the arrow buttons. The component is
 * controlled: the parent owns the lists and persists via `onTransfer(items, dir)`.
 *
 * Props:
 *  - leftTitle / rightTitle: panel headings
 *  - leftItems / rightItems: arrays of items
 *  - renderItem(item): React node describing the row (name/avatar etc.)
 *  - itemKey: key field (default 'id')
 *  - onTransfer(items, direction): 'toRight' | 'toLeft'
 *  - busy: disable interactions while a save is in flight
 *  - leftHint / rightHint: sub-titles under headings
 *  - emptyText: shown when both panels are empty
 *  - rightButtonLabel / leftButtonLabel: optional text labels on the center
 *    action buttons (e.g. "Enroll Selected" / "Remove Selected"). When
 *    omitted, the buttons render as bare chevrons.
 */
export default function DragTransfer({
    leftTitle = 'Available',
    rightTitle = 'Selected',
    leftItems = [],
    rightItems = [],
    renderItem = (item) => item.name,
    itemKey = 'id',
    onTransfer = () => {},
    busy = false,
    leftHint,
    rightHint,
    emptyText = 'Nothing to show',
    rightButtonLabel,
    leftButtonLabel,
}) {
    const [selLeft, setSelLeft] = useState(new Set());
    const [selRight, setSelRight] = useState(new Set());
    const [qLeft, setQLeft] = useState('');
    const [qRight, setQRight] = useState('');
    const [over, setOver] = useState(null); // 'left' | 'right'

    const left = useMemo(() => leftItems.filter(i => String(renderItem(i) ?? i.name ?? '').toLowerCase().includes(qLeft.toLowerCase())), [leftItems, qLeft, renderItem]);
    const right = useMemo(() => rightItems.filter(i => String(renderItem(i) ?? i.name ?? '').toLowerCase().includes(qRight.toLowerCase())), [rightItems, qRight, renderItem]);

    const keyOf = (item) => item?.[itemKey];

    const toggle = (setter, key) => setter(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const move = (direction) => {
        if (busy) return;
        const fromLeft = direction === 'toRight';
        const selection = fromLeft ? [...selLeft].map(k => leftItems.find(i => keyOf(i) === k)).filter(Boolean) : [...selRight].map(k => rightItems.find(i => keyOf(i) === k)).filter(Boolean);
        if (!selection.length) return;
        onTransfer(selection, direction);
        if (fromLeft) setSelLeft(new Set()); else setSelRight(new Set());
    };

    const handleDrop = (e, direction) => {
        e.preventDefault();
        setOver(null);
        if (busy) return;
        let keys = [];
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/x-keys'));
            keys = Array.isArray(data) ? data : [];
        } catch {
            const single = e.dataTransfer.getData('text/plain');
            if (single) keys = [single];
        }
        if (!keys.length) return;
        // Resolve keys against whichever panel they came from.
        const fromLeft = direction === 'toRight';
        const pool = fromLeft ? leftItems : rightItems;
        const items = keys.map(k => pool.find(i => String(keyOf(i)) === String(k))).filter(Boolean);
        if (items.length) onTransfer(items, direction);
        setSelLeft(new Set()); setSelRight(new Set());
    };

    const handleDragStart = (e, item, fromLeft) => {
        if (busy) return;
        const selection = fromLeft ? selLeft : selRight;
        // Drag the item itself (plus any selection that includes it).
        let keys = [keyOf(item)];
        if (selection.has(keyOf(item))) keys = [...selection];
        e.dataTransfer.setData('application/x-keys', JSON.stringify(keys.map(String)));
        e.dataTransfer.setData('text/plain', String(keyOf(item)));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
            <Panel
                title={leftTitle}
                hint={leftHint}
                items={left}
                selection={selLeft}
                itemKey={itemKey}
                renderItem={renderItem}
                onToggle={k => toggle(setSelLeft, k)}
                onDragStart={(e, item) => handleDragStart(e, item, true)}
                onDragOver={e => { e.preventDefault(); if (!busy) setOver('left'); }}
                onDragLeave={() => setOver(prev => (prev === 'left' ? null : prev))}
                onDrop={e => handleDrop(e, 'toRight')}
                isOver={over === 'left'}
                busy={busy}
                searchValue={qLeft}
                onSearchChange={setQLeft}
                emptyText={emptyText}
            />
            {/* Center controls */}
            <div className="flex sm:flex-col items-center justify-center gap-2 py-1">
                <button
                    onClick={() => move('toRight')}
                    disabled={busy || selLeft.size === 0}
                    title={rightButtonLabel ? rightButtonLabel : 'Move to right (or drag)'}
                    className={`flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors shadow-sm ${rightButtonLabel ? 'px-4 py-2.5 text-xs font-bold' : 'w-11 h-11'}`}
                >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : rightButtonLabel ? <><span>{rightButtonLabel}</span><ChevronRight size={16} /></> : <ChevronRight size={18} />}
                </button>
                <button
                    onClick={() => move('toLeft')}
                    disabled={busy || selRight.size === 0}
                    title={leftButtonLabel ? leftButtonLabel : 'Move to left (or drag)'}
                    className={`flex items-center justify-center gap-2 rounded-xl bg-muted hover:bg-muted/70 disabled:opacity-40 text-muted-foreground transition-colors shadow-sm ${leftButtonLabel ? 'px-4 py-2.5 text-xs font-bold' : 'w-11 h-11'}`}
                >
                    {leftButtonLabel ? <><ChevronLeft size={16} /><span>{leftButtonLabel}</span></> : <ChevronLeft size={18} />}
                </button>
            </div>
            <Panel
                title={rightTitle}
                hint={rightHint}
                items={right}
                selection={selRight}
                itemKey={itemKey}
                renderItem={renderItem}
                onToggle={k => toggle(setSelRight, k)}
                onDragStart={(e, item) => handleDragStart(e, item, false)}
                onDragOver={e => { e.preventDefault(); if (!busy) setOver('right'); }}
                onDragLeave={() => setOver(prev => (prev === 'right' ? null : prev))}
                onDrop={e => handleDrop(e, 'toLeft')}
                isOver={over === 'right'}
                busy={busy}
                searchValue={qRight}
                onSearchChange={setQRight}
                emptyText={emptyText}
            />
        </div>
    );
}
