import { useEffect, useMemo, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Columns,
    Search,
    SlidersHorizontal,
    X,
} from 'lucide-react';

/**
 * DataGrid – config-driven data table with the full premium feature set:
 * global search, sortable columns, per-column filters, pagination, column
 * visibility, and bulk selection + bulk actions. Fully client-side: it
 * operates on already-fetched arrays, so it slots into any page that loads
 * its rows in memory.
 *
 * @param {object[]} columns - Column definitions:
 *   { key, header,
 *     sortable?,          - click header to toggle asc/desc
 *     filterable?,        - show this column in the Filters panel
 *     filterOptions?,     - [{ value, label }] renders a select instead of a text input
 *     searchable?,        - include in global search (default true)
 *     align?: 'right',    - right-align header + cells (use for Actions)
 *     render?(row),       - custom cell content
 *     value?(row),        - accessor used for sort/filter/search comparisons (defaults to row[key])
 *     className?          - extra cell classes }
 * @param {object[]} rows
 * @param {string} rowKey              - unique key accessor, e.g. 'id'
 * @param {boolean} [searchable]       - show the global search box
 * @param {string} [searchPlaceholder]
 * @param {boolean} [selectable]       - bulk-selection checkboxes
 * @param {string[]} [selectedKeys]    - controlled selection (omit for internal state)
 * @param {(keys: string[]) => void} [onSelectionChange]
 * @param {object[]} [bulkActions]     - [{ label, icon?, onClick(selectedRows) }]
 * @param {number} [defaultPageSize]
 * @param {number[]} [pageSizeOptions]
 * @param {(rows: object[]) => void} [onFilteredChange] - reports post-search/filter/sort rows (for CSV export etc.)
 * @param {(row: object) => void} [onRowClick]
 * @param {boolean} [columnsToggle]    - column-visibility menu (default true)
 * @param {boolean} [loading]
 * @param {string} [loadingText]
 * @param {string} [emptyText]
 * @param {object} [initialSort]       - { key, dir: 'asc' | 'desc' }
 */
export function DataGrid({
    columns,
    rows = [],
    rowKey = 'id',
    searchable = false,
    searchPlaceholder = 'Search...',
    selectable = false,
    selectedKeys: selectedKeysProp,
    onSelectionChange,
    bulkActions = [],
    defaultPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    onFilteredChange,
    onRowClick,
    columnsToggle = true,
    loading = false,
    loadingText = 'Loading...',
    emptyText = 'No data found.',
    initialSort,
}) {
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({});
    const [sort, setSort] = useState(initialSort ?? null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const [visibleKeys, setVisibleKeys] = useState(() => columns.map(c => c.key));
    const [showColumns, setShowColumns] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Selection: controlled when selectedKeys is provided, otherwise internal.
    const [internalSelected, setInternalSelected] = useState([]);
    const isControlled = selectedKeysProp !== undefined;
    const selectedKeys = isControlled ? selectedKeysProp ?? [] : internalSelected;
    const updateSelection = (next) => {
        if (isControlled) onSelectionChange?.(next);
        else setInternalSelected(next);
    };

    const getValue = (col, row) => {
        if (col.value) return col.value(row);
        const v = row?.[col.key];
        return v == null ? '' : v;
    };
    const toStr = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

    // ── Pipeline: search → filters → sort → paginate ──────────────────────
    const filtered = useMemo(() => {
        let out = rows;
        const q = search.trim().toLowerCase();
        if (q) {
            const searchCols = columns.filter(c => c.searchable !== false);
            out = out.filter(r => searchCols.some(c => toStr(getValue(c, r)).toLowerCase().includes(q)));
        }
        const active = Object.entries(filters).filter(([, v]) => v !== '' && v != null);
        if (active.length) {
            out = out.filter(r =>
                active.every(([k, v]) => {
                    const col = columns.find(c => c.key === k);
                    if (!col) return true;
                    const val = toStr(getValue(col, r));
                    return col.filterOptions ? val === v : val.toLowerCase().includes(toStr(v).toLowerCase());
                })
            );
        }
        return out;
    }, [rows, search, filters, columns]);

    const sorted = useMemo(() => {
        if (!sort) return filtered;
        const col = columns.find(c => c.key === sort.key);
        if (!col) return filtered;
        const dir = sort.dir === 'desc' ? -1 : 1;
        return [...filtered].sort((a, b) => {
            const va = getValue(col, a);
            const vb = getValue(col, b);
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            return toStr(va).localeCompare(toStr(vb), undefined, { numeric: true }) * dir;
        });
    }, [filtered, sort, columns]);

    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        onFilteredChange?.(sorted);
    }, [sorted]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Interactions ───────────────────────────────────────────────────────
    const toggleSort = (col) => {
        setSort(prev =>
            prev?.key === col.key
                ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key: col.key, dir: 'asc' }
        );
        setPage(1);
    };
    const setFilter = (key, value) => {
        setFilters(prev => {
            const next = { ...prev };
            if (value === '' || value == null) delete next[key];
            else next[key] = value;
            return next;
        });
        setPage(1);
    };
    const toggleColumn = (key) => {
        setVisibleKeys(prev => {
            const has = prev.includes(key);
            if (has && prev.length === 1) return prev; // keep at least one column
            return has ? prev.filter(k => k !== key) : [...prev, key];
        });
    };

    const pageKeys = pageRows.map(r => toStr(r[rowKey]));
    const selectedSet = new Set(selectedKeys);
    const allPageSelected = pageKeys.length > 0 && pageKeys.every(k => selectedSet.has(k));
    const somePageSelected = pageKeys.some(k => selectedSet.has(k));
    const togglePage = () => {
        const next = new Set(selectedKeys);
        pageKeys.forEach(k => (allPageSelected ? next.delete(k) : next.add(k)));
        updateSelection([...next]);
    };
    const toggleRow = (key) => {
        const next = new Set(selectedKeys);
        next.has(key) ? next.delete(key) : next.add(key);
        updateSelection([...next]);
    };
    const selectedRows = rows.filter(r => selectedSet.has(toStr(r[rowKey])));

    const visibleCols = columns.filter(c => visibleKeys.includes(c.key));
    const filterableCols = columns.filter(c => c.filterable);
    const activeFilterCount = Object.keys(filters).length;

    const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, sorted.length);

    return (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {/* ── Toolbar: search + filters + columns ── */}
            {(searchable || columnsToggle || filterableCols.length > 0) && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border">
                    {searchable && (
                        <div className="relative flex-1 min-w-[220px] w-full sm:w-auto">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                            <input
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder={searchPlaceholder}
                                className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {filterableCols.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowFilters(v => !v)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${activeFilterCount
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                                        : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'}`}
                                >
                                    <SlidersHorizontal size={14} />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">{activeFilterCount}</span>
                                    )}
                                </button>
                                {showFilters && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                                        <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-card border border-border rounded-2xl shadow-xl p-4 space-y-3">
                                            {filterableCols.map(col => (
                                                <div key={col.key}>
                                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{col.header}</label>
                                                    {col.filterOptions ? (
                                                        <select
                                                            value={filters[col.key] || ''}
                                                            onChange={e => setFilter(col.key, e.target.value)}
                                                            className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-200"
                                                        >
                                                            <option value="">All</option>
                                                            {col.filterOptions.map(o => (
                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={filters[col.key] || ''}
                                                            onChange={e => setFilter(col.key, e.target.value)}
                                                            placeholder={`Filter by ${col.header.toLowerCase()}...`}
                                                            className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-200"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            {activeFilterCount > 0 && (
                                                <button onClick={() => setFilters({})} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                                                    Clear all filters
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {columnsToggle && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowColumns(v => !v)}
                                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-muted/40 hover:bg-muted text-muted-foreground border border-border transition-colors"
                                >
                                    <Columns size={14} />
                                    Columns
                                </button>
                                {showColumns && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowColumns(false)} />
                                        <div className="absolute right-0 top-full mt-2 z-20 w-56 max-h-80 overflow-y-auto bg-card border border-border rounded-2xl shadow-xl p-2">
                                            {columns.map(c => (
                                                <label key={c.key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/50 cursor-pointer text-sm font-semibold text-foreground transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleKeys.includes(c.key)}
                                                        onChange={() => toggleColumn(c.key)}
                                                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                    />
                                                    {c.header}
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Bulk selection bar ── */}
            {selectable && selectedKeys.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-border">
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        {selectedKeys.length} selected
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {bulkActions.map((action, i) => {
                            const Icon = action.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={() => action.onClick?.(selectedRows)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${action.variant === 'primary'
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                                >
                                    {Icon && <Icon size={14} />}
                                    {action.label}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => updateSelection([])}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-card border border-border text-muted-foreground hover:bg-muted transition-colors"
                        >
                            <X size={14} />
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* ── Table ── */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-foreground min-w-[600px]">
                    <thead className="bg-muted/60 border-y border-border text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <tr>
                            {selectable && (
                                <th className="px-3 sm:px-4 py-3 sm:py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        onChange={togglePage}
                                        ref={el => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }}
                                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                        title="Select all on this page"
                                    />
                                </th>
                            )}
                            {visibleCols.map(col => (
                                <th
                                    key={col.key}
                                    onClick={col.sortable ? () => toggleSort(col) : undefined}
                                    className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap select-none ${col.sortable ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                                >
                                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                        {col.header}
                                        {col.sortable && (
                                            sort?.key === col.key
                                                ? sort.dir === 'asc'
                                                    ? <ArrowUp size={13} className="text-indigo-600" />
                                                    : <ArrowDown size={13} className="text-indigo-600" />
                                                : <ChevronsUpDown size={13} className="opacity-40" />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="px-3 sm:px-6 py-10 sm:py-12 text-center text-muted-foreground font-medium">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        {loadingText}
                                    </div>
                                </td>
                            </tr>
                        ) : pageRows.length === 0 ? (
                            <tr>
                                <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="px-3 sm:px-6 py-10 sm:py-12 text-center text-muted-foreground font-medium">
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            pageRows.map(row => (
                                <tr
                                    key={toStr(row[rowKey])}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-muted/40' : 'hover:bg-muted/30'}`}
                                >
                                    {selectable && (
                                        <td className="py-4 px-3 sm:px-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedSet.has(toStr(row[rowKey]))}
                                                onChange={() => toggleRow(toStr(row[rowKey]))}
                                                onClick={e => e.stopPropagation()}
                                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                            />
                                        </td>
                                    )}
                                    {visibleCols.map(col => (
                                        <td key={col.key} className={`py-4 px-3 sm:px-4 md:px-6 ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}>
                                            {col.render ? col.render(row) : toStr(getValue(col, row))}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Footer: count + page size + pager ── */}
            {!loading && sorted.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground">
                        Showing <span className="text-foreground font-bold">{start}–{end}</span> of {sorted.length.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-3">
                        <select
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                        >
                            {pageSizeOptions.map(n => (
                                <option key={n} value={n}>{n} / page</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <span className="text-xs font-bold text-foreground px-2">
                                {safePage} / {pageCount}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                                disabled={safePage >= pageCount}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground"
                                aria-label="Next page"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
