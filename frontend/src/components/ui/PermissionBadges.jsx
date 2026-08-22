import { ShieldCheck } from 'lucide-react';
import { PERMISSIONS } from '../../data/permissions';

// ── PERMISSION BADGES ─────────────────────────────────────────────────────────
// Compact "what this user can do at a glance" chips. Renders the effective
// permission list; optional explicit grants / revocations (per-user overrides
// set by the Super Admin) get distinct markers. Overflow collapses into a
// "+N more" chip whose tooltip lists everything.

const GROUP_COLORS = {
    Departments: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Admins: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    Users: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    Permissions: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    Courses: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Assignments: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    Quizzes: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    Platform: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
};

const shortLabel = (perm) =>
    PERMISSIONS[perm]?.label ||
    String(perm || '').split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const groupOf = (perm) => PERMISSIONS[perm]?.group || 'Platform';

const Chip = ({ perm, variant = 'default', title }) => {
    if (variant === 'revoked') {
        return (
            <span
                title={title}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-rose-50 text-rose-500 line-through decoration-rose-400/70 dark:bg-rose-900/20 dark:text-rose-400"
            >
                {shortLabel(perm)}
            </span>
        );
    }
    const base = GROUP_COLORS[groupOf(perm)] || GROUP_COLORS.Platform;
    const cls = variant === 'granted'
        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
        : base;
    return (
        <span
            title={title}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${cls}`}
        >
            {variant === 'granted' && <span className="w-1 h-1 rounded-full bg-current" />}
            {shortLabel(perm)}
        </span>
    );
};

export default function PermissionBadges({
    permissions = [],
    granted = [],
    revoked = [],
    max = 4,
    className = '',
}) {
    const effective = Array.isArray(permissions) ? permissions : [];
    const grantedSet = new Set(Array.isArray(granted) ? granted : []);
    const revokedList = (Array.isArray(revoked) ? revoked : []).filter(p => !effective.includes(p));

    // Order: revoked (denials) first, then effective, explicit grants highlighted.
    const ordered = [...revokedList, ...effective];
    const shown = ordered.slice(0, max);
    const rest = ordered.slice(max);

    const tooltipText = (() => {
        const parts = [
            ...effective.map(p => `✓ ${PERMISSIONS[p]?.label || p}`),
            ...revokedList.map(p => `✕ revoked: ${PERMISSIONS[p]?.label || p}`),
        ];
        return parts.join('\n');
    })();

    if (effective.length === 0 && revokedList.length === 0) {
        return <span className={`text-[11px] font-medium text-muted-foreground/50 ${className}`}>No permissions</span>;
    }

    return (
        <div className={`flex items-center flex-wrap gap-1.5 ${className}`} title={tooltipText}>
            {shown.map(perm => (
                <Chip
                    key={perm}
                    perm={perm}
                    variant={revokedList.includes(perm) ? 'revoked' : (grantedSet.has(perm) ? 'granted' : 'default')}
                    title={PERMISSIONS[perm]?.description || perm}
                />
            ))}
            {rest.length > 0 && (
                <span
                    title={tooltipText}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-muted text-muted-foreground cursor-help"
                >
                    <ShieldCheck size={10} /> +{rest.length} more
                </span>
            )}
        </div>
    );
}
