import { useState, useEffect } from 'react';
import { Settings, Save, Globe, Mail, Bell, AlertTriangle, Loader2, Building2, BookOpen, Lock } from 'lucide-react';
import { statsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const SECTIONS = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'college', label: 'College', icon: Building2 },
    { id: 'lms', label: 'LMS', icon: BookOpen },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
];

// Reusable toggle row used across sections
const Toggle = ({ label, desc, checked, onChange, danger }) => (
    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${danger && checked ? 'border-rose-200 bg-rose-50' : 'border-border hover:bg-muted/40'}`}>
        <div className="relative flex-shrink-0">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
            <div onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${checked ? (danger ? 'bg-rose-500' : 'bg-indigo-600') : 'bg-muted'}`}>
                <div className={`w-5 h-5 bg-card rounded-full shadow-sm transform transition-transform m-0.5 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
        </div>
        <div>
            <p className={`text-sm font-bold ${danger && checked ? 'text-rose-700' : 'text-foreground'}`}>{label}</p>
            {desc && <p className="text-xs text-muted-foreground font-medium">{desc}</p>}
        </div>
        {danger && checked && <AlertTriangle size={16} className="text-rose-500 ml-auto flex-shrink-0" />}
    </label>
);

export default function PlatformSettings() {
    const [active, setActive] = useState('general');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({});

    useEffect(() => {
        statsAPI.getSettings()
            .then(setSettings)
            .catch(() => toast.error('Failed to load settings'))
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
        <div className="space-y-6 max-w-5xl">                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
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

            <div className="flex flex-col sm:flex-row gap-6">
                {/* Sidebar nav */}
                <div className="w-full sm:w-44 flex-shrink-0 overflow-x-auto">
                    <div className="bg-card border border-border rounded-2xl p-2 shadow-sm flex sm:flex-col sm:space-y-1 gap-1">
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
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Max Upload Size (MB)</label>
                                        <input type="number" className={inputCls} value={settings.maxUploadSizeMB} onChange={e => update('maxUploadSizeMB', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Support Email</label>
                                        <input type="email" className={inputCls} value={settings.supportEmail} onChange={e => update('supportEmail', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Default Max Students / Department</label>
                                        <input type="number" min={0} className={inputCls} value={settings.defaultMaxStudentsPerAdmin ?? ''} onChange={e => update('defaultMaxStudentsPerAdmin', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Default Max Courses / Department</label>
                                        <input type="number" min={0} className={inputCls} value={settings.defaultMaxCoursesPerAdmin ?? ''} onChange={e => update('defaultMaxCoursesPerAdmin', e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 pt-2">
                                    <Toggle
                                        label="Maintenance Mode"
                                        desc="Show maintenance page to all non-admin users"
                                        danger
                                        checked={!!settings.maintenanceMode}
                                        onChange={v => update('maintenanceMode', v)}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {active === 'college' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">College Settings</h2>
                            <div className="space-y-5">
                                <div className="flex items-start gap-5">
                                    <div className="w-24 h-24 rounded-2xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {settings.collegeLogo ? (
                                            <img src={settings.collegeLogo} alt="College logo" className="w-full h-full object-contain p-2" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                        ) : (
                                            <Building2 size={32} className="text-muted-foreground/50" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">College Logo URL</label>
                                        <input className={inputCls} placeholder="https://example.com/logo.png" value={settings.collegeLogo} onChange={e => update('collegeLogo', e.target.value)} />
                                        <p className="text-xs text-muted-foreground font-medium mt-1.5">A square logo is recommended — shown on login page, certificates, and emails.</p>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">College Name</label>
                                        <input className={inputCls} value={settings.collegeName} onChange={e => update('collegeName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Website</label>
                                        <input type="url" className={inputCls} placeholder="https://college.edu" value={settings.collegeWebsite} onChange={e => update('collegeWebsite', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Address</label>
                                    <textarea rows={2} className={`${inputCls} resize-none`} value={settings.collegeAddress} onChange={e => update('collegeAddress', e.target.value)} />
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Contact Email</label>
                                        <input type="email" className={inputCls} value={settings.collegeContactEmail} onChange={e => update('collegeContactEmail', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Contact Number</label>
                                        <input className={inputCls} value={settings.collegeContactNumber} onChange={e => update('collegeContactNumber', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {active === 'lms' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">LMS Settings</h2>
                            <div className="space-y-4">
                                <Toggle
                                    label="Course approval required"
                                    desc="New courses stay Pending until a department admin or super admin approves them"
                                    checked={!!settings.requireApproval}
                                    onChange={v => update('requireApproval', v)}
                                />
                                <Toggle
                                    label="Enrollment approval required"
                                    desc="Admin/instructor must accept a student's enrollment request before it takes effect"
                                    checked={!!settings.enrollmentApprovalRequired}
                                    onChange={v => update('enrollmentApprovalRequired', v)}
                                />
                                <Toggle
                                    label="Certificates enabled"
                                    desc="Generate certificates for students who complete a course"
                                    checked={settings.certificateEnabled !== false}
                                    onChange={v => update('certificateEnabled', v)}
                                />
                                <Toggle
                                    label="Student self-enrollment"
                                    desc="Students may enroll themselves in published courses without admin help"
                                    checked={settings.studentSelfEnrollment !== false}
                                    onChange={v => update('studentSelfEnrollment', v)}
                                />
                                <Toggle
                                    label="Instructor course creation"
                                    desc="Instructors may create their own courses (otherwise only admins create them)"
                                    checked={settings.instructorCourseCreation !== false}
                                    onChange={v => update('instructorCourseCreation', v)}
                                />
                                <div className="grid sm:grid-cols-2 gap-5 pt-2">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Maximum Course Capacity</label>
                                        <input type="number" min={0} className={inputCls} value={settings.maxCourseCapacity ?? ''} onChange={e => update('maxCourseCapacity', e.target.value)} />
                                        <p className="text-xs text-muted-foreground font-medium mt-1.5">Max students per course. Leave empty for unlimited.</p>
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Default Max Students / Department</label>
                                        <input type="number" min={0} className={inputCls} value={settings.defaultMaxStudentsPerAdmin ?? ''} onChange={e => update('defaultMaxStudentsPerAdmin', e.target.value)} />
                                    </div>
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

                    {active === 'security' && (
                        <>
                            <h2 className="text-lg font-extrabold text-foreground border-b border-border pb-4">Security Settings</h2>
                            <div className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Password Policy — Minimum Length</label>
                                        <input type="number" min={4} max={64} className={inputCls} value={settings.passwordMinLength ?? ''} onChange={e => update('passwordMinLength', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Session Timeout (minutes)</label>
                                        <input type="number" min={5} className={inputCls} value={settings.sessionTimeoutMinutes ?? ''} onChange={e => update('sessionTimeoutMinutes', e.target.value)} />
                                        <p className="text-xs text-muted-foreground font-medium mt-1.5">Auto sign-out after inactivity.</p>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Max Login Attempts</label>
                                        <input type="number" min={1} className={inputCls} value={settings.maxLoginAttempts ?? ''} onChange={e => update('maxLoginAttempts', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Account Lockout — Failed Attempts</label>
                                        <input type="number" min={1} className={inputCls} value={settings.accountLockoutAttempts ?? ''} onChange={e => update('accountLockoutAttempts', e.target.value)} />
                                        <p className="text-xs text-muted-foreground font-medium mt-1.5">Lock the account after this many failed attempts.</p>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">JWT Token Expiry (days)</label>
                                        <input type="number" className={inputCls} value={settings.jwtExpiryDays ?? ''} onChange={e => update('jwtExpiryDays', e.target.value)} />
                                    </div>
                                </div>
                                <Toggle
                                    label="Require strong password"
                                    desc="Passwords must include upper/lowercase, a number, and a symbol"
                                    checked={!!settings.passwordComplexityRequired}
                                    onChange={v => update('passwordComplexityRequired', v)}
                                />
                                <Toggle
                                    label="Require 2FA for Admins"
                                    desc="Force all admin and super-admin accounts to use two-factor auth"
                                    checked={!!settings.twoFactorRequired}
                                    onChange={v => update('twoFactorRequired', v)}
                                />
                                <Toggle
                                    label="Account lockout enabled"
                                    desc="Temporarily lock accounts that exceed the failed-attempt limit"
                                    checked={!!settings.accountLockoutEnabled}
                                    onChange={v => update('accountLockoutEnabled', v)}
                                />
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
