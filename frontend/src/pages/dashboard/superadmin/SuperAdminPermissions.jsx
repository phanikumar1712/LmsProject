import { useState, useCallback, useEffect } from 'react';
import { Search, ShieldCheck, Save, RotateCcw, AlertTriangle, UserCheck, Info, Key, Lock, Unlock, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import toast from 'react-hot-toast';
import { PERMISSIONS, PERMISSION_GROUPS } from '../../../data/permissions';

// ── Three-state toggle logic ─────────────────────────────────────────────────
// Each permission is either:
//   'inherited' — from the role matrix (no override), toggle = revoke
//   'granted'   — explicit override true (beyond the role), toggle = clear
//   'revoked'   — explicit override false (removed from the role), toggle = clear
const overrideFor = (inherited, current) => {
    if (current === undefined) return undefined; // no override
    if (current === true) return inherited ? undefined : true; // granted beyond role
    return inherited ? false : undefined; // revoked from role
};

export default function SuperAdminPermissions() {
    const { user: me } = useAuth();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState(null); // user summary
    const [permData, setPermData] = useState(null); // { rolePermissions, overrides, effective }
    const [draft, setDraft] = useState(null); // working overrides map
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadPermissions = useCallback(async (userId) => {
        setLoading(true);
        try {
            const data = await usersAPI.getPermissions(userId);
            setPermData(data);
            setDraft({ ...data.overrides });
        } catch (err) {
            toast.error(err.message || 'Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearch = useCallback(async (term) => {
        if (!term.trim()) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await usersAPI.getAll({ search: term, limit: 10 });
            const list = (res.data || res || []).filter(u => u.role !== 'SUPER_ADMIN');
            setResults(list);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    // Debounce search input
    useEffect(() => {
        const t = setTimeout(() => handleSearch(search), 400);
        return () => clearTimeout(t);
    }, [search, handleSearch]);

    const selectUser = (u) => {
        setSelected({ id: u.id, name: u.name, email: u.email, role: u.role, departmentName: u.departmentName });
        setResults([]);
        setSearch('');
        loadPermissions(u.id);
    };

    const toggle = (perm) => {
        if (!permData || !draft) return;
        const inherited = permData.rolePermissions.includes(perm);
        const next = overrideFor(inherited, draft[perm]);
        setDraft(prev => {
            const copy = { ...prev };
            if (next === undefined) delete copy[perm];
            else copy[perm] = next;
            return copy;
        });
    };

    const effectiveSet = useCallback((perm) => {
        if (!permData) return false;
        const inherited = permData.rolePermissions.includes(perm);
        if (draft && draft[perm] !== undefined) return draft[perm];
        return inherited;
    }, [permData, draft]);

    const hasChanges = permData && draft && JSON.stringify(draft) !== JSON.stringify(permData.overrides);

    const save = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await usersAPI.updatePermissions(selected.id, draft || {});
            toast.success('Permissions updated');
            loadPermissions(selected.id);
        } catch (err) {
            toast.error(err.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    const clearAll = () => setDraft({});

    const inputCls = "px-3 py-2 bg-card border border-border text-foreground rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm";
    const dirtyCount = permData && draft
        ? Object.keys(draft).filter(p => draft[p] !== permData.overrides[p]).length
        : 0;

    return (
        <div className="space-y-6 max-w-6xl">
            <PageHeader
                title="Permissions"
                subtitle="Grant or revoke individual permissions for any user — on top of their role's default set"
            />

            {/* User picker */}
            <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, email, or roll number..."
                            className={`${inputCls} w-full pl-10 pr-4 py-2.5`}
                        />
                        {searching && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">Searching…</span>
                        )}
                        {search && !searching && results.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                                {results.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => selectUser(u)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                            <UserCheck size={15} className="text-muted-foreground" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground flex-shrink-0">
                                            {u.role.replace('_', ' ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {selected && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <UserCheck size={18} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-foreground">{selected.name}</p>
                            <p className="text-xs text-muted-foreground">{selected.email}{selected.departmentName ? ` · ${selected.departmentName}` : ''}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-indigo-600 text-white">{selected.role.replace('_', ' ')}</span>
                        {hasChanges && (
                            <button
                                onClick={save}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                <Save size={14} /> {saving ? 'Saving…' : `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`}
                            </button>
                        )}
                        {hasChanges && (
                            <button
                                onClick={clearAll}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <RotateCcw size={14} /> Revert all
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* How it works banner */}
            {!selected && (
                <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200 rounded-2xl p-6">
                    <h3 className="text-base font-extrabold text-foreground flex items-center gap-2 mb-4">
                        <Key size={18} className="text-indigo-600" /> How Permissions Work
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <ShieldCheck size={16} className="text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">Role Defaults</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Each role (Admin, Instructor, Student) has a built-in set of permissions. These are the baseline.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <Unlock size={16} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">Grant Extra</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Give a user permissions beyond their role — e.g. let a Student manage attendance.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                                <Lock size={16} className="text-rose-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">Revoke Access</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Remove a permission from someone's role set — e.g. prevent an Instructor from deleting courses.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Permission matrix */}
            {selected && !loading && permData ? (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    {/* Legend */}
                    <div className="p-4 border-b border-border bg-muted/20">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/50">Legend:</span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-500" /> Enabled
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                                <span className="w-3 h-3 rounded-full border-2 border-muted-foreground/40" /> Disabled
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] font-black uppercase">Role Default</span> From role
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-600">
                                <span className="px-1.5 py-0.5 rounded bg-violet-50 text-[9px] font-black uppercase">Grant</span> Extra permission
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-[9px] font-black uppercase">Revoked</span> Removed from role
                            </span>
                        </div>
                    </div>

                    <div className="divide-y divide-border">
                        {PERMISSION_GROUPS.map(group => {
                            const perms = Object.entries(PERMISSIONS).filter(([, m]) => m.group === group);
                            if (!perms.length) return null;
                            const groupEnabledCount = perms.filter(([key]) => effectiveSet(key)).length;
                            return (
                                <div key={group} className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">{group}</h3>
                                        <span className="text-[10px] font-bold text-muted-foreground/60">
                                            {groupEnabledCount}/{perms.length} enabled
                                        </span>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-3">
                                        {perms.map(([key, meta]) => {
                                            const enabled = effectiveSet(key);
                                            const inherited = permData.rolePermissions.includes(key);
                                            const overridden = draft && draft[key] !== undefined;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => toggle(key)}
                                                    disabled={selected.role === 'SUPER_ADMIN' || me?.id === selected.id}
                                                    className={`text-left p-4 rounded-2xl border transition-all ${enabled
                                                        ? 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/10'
                                                        : 'border-border bg-card hover:bg-muted/40'
                                                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-bold text-foreground">{meta.label}</p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
                                                        </div>
                                                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${enabled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'}`}>
                                                            {enabled && <span className="w-2 h-2 rounded-full bg-white" />}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                                        <code className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono text-muted-foreground/70">{key}</code>
                                                        {inherited && !overridden && (
                                                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 text-[9px] font-black uppercase tracking-wider">role default</span>
                                                        )}
                                                        {overridden && draft[key] === true && (
                                                            <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 dark:bg-violet-900/30 text-[9px] font-black uppercase tracking-wider">explicit grant</span>
                                                        )}
                                                        {overridden && draft[key] === false && (
                                                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-900/30 text-[9px] font-black uppercase tracking-wider">revoked</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : selected && loading ? (
                <div className="bg-card border border-border rounded-2xl shadow-sm">
                    <LoadingContainer height="h-48" />
                </div>
            ) : (
                <div className="bg-card border border-border rounded-2xl shadow-sm p-10 text-center">
                    <div className="w-14 h-14 mx-auto rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                        <ShieldCheck size={24} className="text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1">Select a User</h3>
                    <p className="text-muted-foreground font-medium text-sm max-w-md mx-auto">
                        Search for any admin, instructor, or student to view and customize their individual permissions beyond their role defaults.
                    </p>
                    <div className="flex items-center justify-center gap-6 mt-6">
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-1.5">
                                <UserCheck size={16} className="text-amber-600" />
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Admins</p>
                        </div>
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-1.5">
                                <UserCheck size={16} className="text-emerald-600" />
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Instructors</p>
                        </div>
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-1.5">
                                <UserCheck size={16} className="text-indigo-600" />
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Students</p>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 font-medium mt-5 flex items-center justify-center gap-1">
                        <AlertTriangle size={11} /> All changes are audit-logged and applied immediately.
                    </p>
                </div>
            )}
        </div>
    );
}
