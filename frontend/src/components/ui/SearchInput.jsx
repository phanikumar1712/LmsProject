import { Search } from 'lucide-react';

/**
 * SearchInput – icon-left search box used in user management, courses, students tables.
 *
 * @param {string} value
 * @param {function} onChange
 * @param {string} [placeholder]
 * @param {string} [className]
 */
export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
    return (
        <div className={`relative flex-1 ${className}`}>
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow font-medium text-[15px]"
            />
        </div>
    );
}

/**
 * FilterSelect – icon-left select used alongside SearchInput.
 *
 * @param {string} value
 * @param {function} onChange
 * @param {React.ReactNode} icon - Lucide icon component
 * @param {string} [className]
 */
export function FilterSelect({ value, onChange, icon: Icon, children, className = '' }) {
    return (
        <div className={`relative ${className}`}>
            {Icon && <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-white border border-slate-200 text-slate-700 font-medium rounded-xl py-3 ${Icon ? 'pl-11' : 'pl-4'} pr-4 appearance-none focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow text-[15px] cursor-pointer`}
            >
                {children}
            </select>
        </div>
    );
}

/**
 * FilterBar – horizontal wrapper for SearchInput + FilterSelect(s).
 */
export function FilterBar({ children, className = '' }) {
    return (
        <div className={`flex flex-col sm:flex-row gap-4 ${className}`}>
            {children}
        </div>
    );
}
