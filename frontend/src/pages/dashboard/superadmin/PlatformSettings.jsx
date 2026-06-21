import { useState, useEffect } from 'react';
import { Settings, Save, Globe, Mail, CreditCard, Shield, Bell, AlertTriangle, Loader2 } from 'lucide-react';
import { statsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const SECTIONS = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function PlatformSettings() {
    const [active, setActive] = useState('general');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({});

    useEffect(() => {
        statsAPI.getSettings()
            .then(setSettings)
            .catch(err => toast.error('Failed to load settings'))
            .finally(() => setLoading(false));
    }, []);

    const update = (k, v) => setSettings(p => ({ ...p, [k]: v }));

    const saveSettings = async () => {
        setSaving(true);
        try {
            const updated = await statsAPI.updateSettings(settings);
            setSettings(updated);
            toast.success('Settings saved successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="p-20 text-center flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-muted-foreground font-bold">Fetching Platform Configuration...</p>
        </div>
    );

    const inputCls = 'w-full bg-card border border-border text-foreground rounded-xl py-2.5 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm';

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <Settings size={28} className="text-indigo-600" /> Platform Settings
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Configure global platform behavior and integrations</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                    {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                    Save Changes
                </button>
            </div>

            <div className="flex gap-6">
                {/* Sidebar nav */}
                <div className="w-44 flex-shrink-0">
                    <div className="bg-card border border-border rounded-2xl p-2 shadow-sm space-y-1">
                        {SECTIONS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActive(id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${active === id ? 'bg-indigo-50 text-indigo-700' : 'text-muted-foreground hover:bg-muted/40'}`}
                            >
                                <Icon size={16} /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings panel */}
                <div className="flex-1 bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
                    {active === 'general' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">General Settings</h2>
                            <div className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Platform Name</label>
                                        <input className={inputCls} value={settings.siteName} onChange={e => update('siteName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Tagline</label>
                                        <input className={inputCls} value={settings.siteTagline} onChange={e => update('siteTagline', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Default Currency</label>
                                        <select className={inputCls} value={settings.defaultCurrency} onChange={e => update('defaultCurrency', e.target.value)}>
                                            <option value="INR">INR (₹)</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Instructor Revenue Share (%)</label>
                                        <input type="number" className={inputCls} value={settings.instructorRevenueShare} min={0} max={100} onChange={e => update('instructorRevenueShare', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Max Upload Size (MB)</label>
                                        <input type="number" className={inputCls} value={settings.maxUploadSizeMB} onChange={e => update('maxUploadSizeMB', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Support Email</label>
                                        <input type="email" className={inputCls} value={settings.supportEmail} onChange={e => update('supportEmail', e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 pt-2">
                                    {[
                                        { key: 'requireApproval', label: 'Require admin approval for new courses', desc: 'Courses must be reviewed before being published' },
                                        { key: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Show maintenance page to all non-admin users', danger: true },
                                    ].map(({ key, label, desc, danger }) => (
                                        <label key={key} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${danger && settings[key] ? 'border-rose-200 bg-rose-50' : 'border-border hover:bg-muted/40'}`}>
                                            <div className="relative flex-shrink-0">
                                                <input type="checkbox" checked={settings[key]} onChange={e => update(key, e.target.checked)} className="sr-only" />
                                                <div onClick={() => update(key, !settings[key])} className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${settings[key] ? (danger ? 'bg-rose-500' : 'bg-indigo-600') : 'bg-muted'}`}>
                                                    <div className={`w-5 h-5 bg-card rounded-full shadow-sm transform transition-transform m-0.5 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </div>
                                            </div>
                                            <div>
                                                <p className={`text-sm font-bold ${danger && settings[key] ? 'text-rose-700' : 'text-foreground'}`}>{label}</p>
                                                <p className="text-xs text-muted-foreground font-medium">{desc}</p>
                                            </div>
                                            {danger && settings[key] && <AlertTriangle size={16} className="text-rose-500 ml-auto flex-shrink-0" />}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {active === 'email' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">Email Configuration</h2>
                            <div className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">SMTP Host</label>
                                        <input className={inputCls} value={settings.smtpHost} onChange={e => update('smtpHost', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">SMTP Port</label>
                                        <input className={inputCls} value={settings.smtpPort} onChange={e => update('smtpPort', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">From Email Address</label>
                                    <input type="email" className={inputCls} value={settings.emailFrom} onChange={e => update('emailFrom', e.target.value)} />
                                </div>
                                <button className="px-4 py-2.5 bg-muted hover:bg-muted text-foreground/80 rounded-xl font-bold text-sm transition-colors">
                                    Send Test Email
                                </button>
                            </div>
                        </>
                    )}

                    {active === 'payments' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">Payment Gateways</h2>
                            <div className="space-y-5">
                                {[
                                    { key: 'razorpayEnabled', label: 'Razorpay', desc: 'Accept UPI, cards, and net banking via Razorpay' },
                                    { key: 'stripeEnabled', label: 'Stripe', desc: 'Accept international cards via Stripe' },
                                ].map(({ key, label, desc }) => (
                                    <div key={key} className="flex items-center justify-between p-5 border border-border rounded-xl">
                                        <div>
                                            <p className="text-foreground font-bold">{label}</p>
                                            <p className="text-muted-foreground text-sm font-medium">{desc}</p>
                                        </div>
                                        <div onClick={() => update(key, !settings[key])} className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${settings[key] ? 'bg-indigo-600' : 'bg-muted'}`}>
                                            <div className={`w-5 h-5 bg-card rounded-full shadow-sm transform transition-transform m-0.5 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {active === 'security' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">Security Settings</h2>
                            <div className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">JWT Token Expiry (days)</label>
                                        <input type="number" className={inputCls} value={settings.jwtExpiryDays} onChange={e => update('jwtExpiryDays', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Max Login Attempts</label>
                                        <input type="number" className={inputCls} value={settings.maxLoginAttempts} onChange={e => update('maxLoginAttempts', e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-5 border border-border rounded-xl">
                                    <div>
                                        <p className="text-foreground font-bold">Require 2FA for Admins</p>
                                        <p className="text-muted-foreground text-sm font-medium">Force all admin and super-admin accounts to use two-factor auth</p>
                                    </div>
                                    <div onClick={() => update('twoFactorRequired', !settings.twoFactorRequired)} className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.twoFactorRequired ? 'bg-indigo-600' : 'bg-muted'}`}>
                                        <div className={`w-5 h-5 bg-card rounded-full shadow-sm transform transition-transform m-0.5 ${settings.twoFactorRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {active === 'notifications' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">Notification Settings</h2>
                            <div className="space-y-4">
                                {[
                                    { key: 'newEnrollmentNotif', label: 'New Enrollment Alerts', desc: 'Send email when a student enrolls in a course' },
                                    { key: 'newReviewNotif', label: 'New Review Alerts', desc: 'Notify instructors of new course reviews' },
                                    { key: 'weeklyReportEmail', label: 'Weekly Platform Report', desc: 'Send weekly summary to super admins every Monday' },
                                ].map(({ key, label, desc }) => (
                                    <div key={key} className="flex items-center justify-between p-5 border border-border rounded-xl hover:bg-muted/40 transition-colors">
                                        <div>
                                            <p className="text-foreground font-bold text-sm">{label}</p>
                                            <p className="text-muted-foreground text-xs font-medium mt-0.5">{desc}</p>
                                        </div>
                                        <div onClick={() => update(key, !settings[key])} className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${settings[key] ? 'bg-indigo-600' : 'bg-muted'}`}>
                                            <div className={`w-5 h-5 bg-card rounded-full shadow-sm transform transition-transform m-0.5 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
