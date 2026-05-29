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

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            {columns.map((col, i) => (
                                <th
                                    key={col}
                                    className={`px-6 py-4 ${i === columns.length - 1 && (col === 'Actions' || col === 'Action') ? 'text-right' : ''}`}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-500 font-medium">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        {loadingText}
                                    </div>
                                </td>
                            </tr>
                        ) : empty ? (
                            <tr>
                                <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-500 font-medium">
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
    );
}

/**
 * UserCell – avatar + name + email table cell content.
 */
export function UserCell({ name, email, avatar }) {
    const avatarSrc = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    return (
        <div className="flex items-center gap-3">
            <img
                src={avatarSrc}
                alt={name}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
            />
            <div>
                <p className="text-slate-900 font-bold">{name}</p>
                {email && <p className="text-slate-500 text-xs font-medium">{email}</p>}
            </div>
        </div>
    );
}
