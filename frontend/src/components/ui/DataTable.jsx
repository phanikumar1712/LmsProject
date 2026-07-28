/**
 * DataTable – responsive table with a standard header/body layout.
 *
 * @param {string[]} columns   - Column header labels (last one right-aligned if "Actions")
 * @param {React.ReactNode} children - <tbody> row content (<tr> elements)
 * @param {boolean} [loading]  - Shows a loading row instead of children
 * @param {string} [loadingText]
 * @param {boolean} [empty]    - Shows empty row when true
 * @param {string} [emptyText]
 */
export function DataTable({
    columns,
    children,
    loading = false,
    loadingText = 'Loading...',
    empty = false,
    emptyText = 'No data found.',
}) {
    const colSpan = columns.length;
    const isActionsLast = columns.length > 0 && (columns[columns.length - 1] === 'Actions' || columns[columns.length - 1] === 'Action');

    return (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden relative">
            {/* Mobile scroll hint */}
            <div className="md:hidden flex items-center justify-center py-1.5 bg-muted/40 border-b border-border text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                <svg className="w-3 h-3 mr-1 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Swipe to scroll
            </div>
            <div className="overflow-x-auto -mx-1 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                    <table className="w-full text-left text-sm text-foreground min-w-[600px] md:min-w-0">
                        <thead className="bg-muted/60 border-b border-border text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            <tr>
                                {columns.map((col, i) => (
                                    <th
                                        key={col}
                                        className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap ${i === columns.length - 1 && isActionsLast ? 'text-right' : ''}`}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={colSpan} className="px-3 sm:px-6 py-8 sm:py-12 text-center text-muted-foreground font-medium">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-5 h-5 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                            {loadingText}
                                        </div>
                                    </td>
                                </tr>
                            ) : empty ? (
                                <tr>
                                    <td colSpan={colSpan} className="px-3 sm:px-6 py-8 sm:py-12 text-center text-muted-foreground font-medium">
                                        {emptyText}
                                    </td>
                                </tr>
                            ) : (
                                children
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

import { User } from 'lucide-react';

/**
 * UserCell – avatar + name + email table cell content.
 */
export function UserCell({ name, email, avatar }) {
    return (
        <div className="flex items-center gap-3">
            {avatar ? (
                <img
                    src={avatar}
                    alt={name}
                    className="w-10 h-10 rounded-full object-cover border border-border shadow-sm flex-shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border shadow-sm">
                    <User size={20} className="text-muted-foreground" />
                </div>
            )}
            <div>
                <p className="text-foreground font-bold">{name}</p>
                {email && <p className="text-muted-foreground text-xs font-medium">{email}</p>}
            </div>
        </div>
    );
}
