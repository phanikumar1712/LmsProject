import { useState } from 'react';
import { Lock, KeyRound, AlertTriangle } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const inputCls = 'w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium placeholder:text-muted-foreground/60';

/**
 * Shared self-service change-password form (current + new + confirm).
 * Self-contained state, validation, and API call (PUT /auth/change-password).
 * The backend enforces role policy: admins cannot change their own password —
 * admin passwords are managed by the Super Admin.
 *
 * @param {() => void} [onSuccess] fired after a successful password change
 * @param {() => void} [onCancel]  when provided, renders a Cancel button (modal usage)
 */
export default function ChangePasswordForm({ onSuccess, onCancel, submitLabel = 'Update Password' }) {
    const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.current || !form.newPwd || !form.confirm) { toast.error('Please fill in all password fields'); return; }
        if (form.newPwd !== form.confirm) { toast.error('New passwords do not match'); return; }
        if (form.newPwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        setSaving(true);
        try {
            await authAPI.changePassword(form.current, form.newPwd);
            toast.success('Password changed successfully!');
            setForm({ current: '', newPwd: '', confirm: '' });
            onSuccess?.();
        } catch (err) {
            toast.error(err.message || 'Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Current Password *</label>
                <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                    <input type="password" value={form.current}
                        onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        className={inputCls} />
                </div>
            </div>
            <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">New Password *</label>
                <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                    <input type="password" value={form.newPwd}
                        onChange={e => setForm(f => ({ ...f, newPwd: e.target.value }))}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        className={inputCls} />
                </div>
            </div>
            <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Confirm New Password *</label>
                <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                    <input type="password" value={form.confirm}
                        onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                        className={`${inputCls} ${form.confirm && form.newPwd !== form.confirm ? 'border-rose-300 focus:ring-rose-500/10 focus:border-rose-400' : ''}`} />
                </div>
                {form.confirm && form.newPwd !== form.confirm && (
                    <p className="text-rose-500 text-xs font-bold mt-2 flex items-center gap-1">
                        <AlertTriangle size={12} /> Passwords do not match
                    </p>
                )}
            </div>
            <div className={`pt-2 flex gap-3 ${onCancel ? '' : 'justify-end'}`}>
                {onCancel && (
                    <button type="button" onClick={onCancel}
                        className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">
                        Cancel
                    </button>
                )}
                <button type="submit" disabled={saving}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm">
                    {saving ? 'Updating...' : <><KeyRound size={15} /> {submitLabel}</>}
                </button>
            </div>
        </form>
    );
}
