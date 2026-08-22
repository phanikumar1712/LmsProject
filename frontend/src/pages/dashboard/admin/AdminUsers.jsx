import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Ban, Trash2, Upload, X, Building2, Download, UserPlus, RotateCcw, Copy, GraduationCap, Users, Shield, Crown, Lock, ArrowLeftRight } from 'lucide-react';
import { usersAPI, departmentsAPI, statsAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { FilterBar, FilterSelect } from '../../../components/ui/SearchInput';
import { DataTable, UserCell } from '../../../components/ui/DataTable';
import { DataGrid, ConfirmDialog, Breadcrumbs } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';

export default function AdminUsers() {
    const { isSuperAdmin, user: currentUser, can } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('users');
    const [filters, setFilters] = useState({ role: '', status: '', from: '', to: '', departmentId: '' });

    const { data: users, loading, reload: reloadUsers } = useAsyncData(
        () => usersAPI.getAll(filters),
        [filters.role, filters.status, filters.from, filters.to, filters.departmentId]
    );
    const { data: requests, loading: loadingRequests, reload: reloadRequests } = useAsyncData(() => usersAPI.getInstructorRequests(), []);
    const { data: departments } = useAsyncData(() => departmentsAPI.list(), []);
    // Department-scoped admin: current dept usage vs student quota (banner).
    const { data: adminOverview } = useAsyncData(
        () => (isSuperAdmin() ? Promise.resolve(null) : statsAPI.getAdminOverview().catch(() => null)),
        [isSuperAdmin]
    );
    const deptCapacity = isSuperAdmin() ? null : (adminOverview?.data?.[0] || null);
    const studentLimitReached = deptCapacity ? deptCapacity.studentCount >= deptCapacity.maxStudents : false;

    // Independent fetch for the Role Changes tab — deliberately NOT derived from
    // the All Users tab's filters/search, so a stray role/status filter or search
    // term can never hide convertible students/instructors here. Scoped admins
    // still get only their department's users (backend isolation).
    const { data: roleUsers, loading: loadingRoleUsers, reload: reloadRoleUsers } = useAsyncData(
        () => usersAPI.getAll({ limit: 500 }),
        []
    );
    const deptName = (id) => (departments || []).find(d => d.id === id)?.name || '—';

    // Add Instructor modal
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', departmentId: '' });
    const [adding, setAdding] = useState(false);
    const [addResult, setAddResult] = useState(null); // { email, tempPassword }

    // Import Instructors modal
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);

    // Import Students modal
    const [showStudentImport, setShowStudentImport] = useState(false);
    const [studentImportFile, setStudentImportFile] = useState(null);
    const [importingStudents, setImportingStudents] = useState(false);
    const [studentImportResults, setStudentImportResults] = useState(null);

    // Password reset result modal
    const [resetResult, setResetResult] = useState(null); // { name, tempPassword }

    // Role change confirmation modal — every role change now requires the
    // acting admin's own password (verified server-side) + optional reason.
    const [roleChangeConfirm, setRoleChangeConfirm] = useState(null); // { user, newRole }
    const [roleChangeReason, setRoleChangeReason] = useState('');
    const [roleChangePassword, setRoleChangePassword] = useState('');
    const [roleChanging, setRoleChanging] = useState(false);

    const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

    const handleRoleChange = async (userId, newRole, reason = '', adminPassword = '') => {
        try {
            await usersAPI.updateRole(userId, newRole, reason, adminPassword);
            reloadUsers();
            reloadRoleUsers?.(); // keep the Role Changes tab in sync
            toast.success(`User role updated to ${newRole}`);
            return true;
        } catch (err) {
            toast.error(err.message || 'Failed to update role');
            return false;
        }
    };

    // All role changes (student↔instructor and admin promotions) go through the
    // password-gated confirmation modal.
    const handleRoleSelect = (user, newRole) => {
        if (newRole === user.role) return;
        setRoleChangeConfirm({ user, newRole });
        setRoleChangeReason('');
        setRoleChangePassword('');
    };

    const confirmRoleChange = async () => {
        if (!roleChangeConfirm) return;
        if (!roleChangePassword) {
            toast.error('Enter your password to authorize the role change');
            return;
        }
        setRoleChanging(true);
        // Keep the modal open on failure (e.g. wrong password) so the admin can
        // retry in place instead of reopening everything.
        const ok = await handleRoleChange(roleChangeConfirm.user.id, roleChangeConfirm.newRole, roleChangeReason, roleChangePassword);
        setRoleChanging(false);
        if (ok) {
            setRoleChangeConfirm(null);
            setRoleChangeReason('');
            setRoleChangePassword('');
        }
    };

    const handleRequestAction = async (id, action) => {
        try {
            await usersAPI.approveInstructorRequest(id, action);
            reloadRequests();
            reloadUsers();
            toast.success(`Application ${action.toLowerCase()}`);
        } catch (err) {
            toast.error(err.message || `Failed to ${action.toLowerCase()} application`);
        }
    };

    const handleToggleStatus = async (userId) => {
        try {
            await usersAPI.toggleStatus(userId);
            reloadUsers();
            toast.success('User status updated');
        } catch (err) {
            toast.error(err.message || 'Failed to update status');
        }
    };

    // Force password reset: opens a confirm modal (instead of window.confirm)
    // so the operator can opt into "must change password on next login".
    const [resetTarget, setResetTarget] = useState(null); // user awaiting reset confirmation
    const [forceReset, setForceReset] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleResetPassword = (user) => {
        setResetTarget(user);
        setForceReset(false);
    };

    const confirmResetPassword = async () => {
        if (!resetTarget) return;
        setResetting(true);
        try {
            const res = await usersAPI.resetPassword(resetTarget.id, undefined, forceReset);
            setResetResult({ name: resetTarget.name, tempPassword: res.tempPassword, mustChange: res.mustChangePassword });
            setResetTarget(null);
            toast.success(forceReset ? 'Password reset — user must change it on next login' : 'Password reset');
        } catch (err) {
            toast.error(err.message || 'Failed to reset password');
        } finally {
            setResetting(false);
        }
    };

    // Delete confirmation (single user or bulk selection) via ConfirmDialog.
    const [deleteTarget, setDeleteTarget] = useState(null); // single user
    const [bulkDeleteRows, setBulkDeleteRows] = useState(null); // array for bulk selection
    const [deleting, setDeleting] = useState(false);

    const requestDeleteUser = (user) => setDeleteTarget(user);
    const requestBulkDelete = (rows) => setBulkDeleteRows(rows);

    const confirmDelete = async () => {
        const targets = bulkDeleteRows || (deleteTarget ? [deleteTarget] : []);
        if (!targets.length) return;
        setDeleting(true);
        let deleted = 0;
        for (const u of targets) {
            try { await usersAPI.delete(u.id); deleted++; } catch { /* keep going — collect failures */ }
        }
        if (deleted === targets.length) {
            toast.success(`${deleted} user${deleted > 1 ? 's' : ''} deleted`);
        } else if (deleted > 0) {
            toast.success(`${deleted} deleted — ${targets.length - deleted} failed (tied to courses/data?)`);
        } else {
            toast.error('No users deleted. They may be tied to existing courses/data.');
        }
        setDeleting(false);
        setDeleteTarget(null);
        setBulkDeleteRows(null);
        setSelectedKeys([]);
        reloadUsers();
    };

    const handleAddInstructor = async (e) => {
        e.preventDefault();
        setAdding(true);
        setAddResult(null);
        try {
            const payload = { name: addForm.name, email: addForm.email, phone: addForm.phone };
            if (isSuperAdmin() && addForm.departmentId) payload.departmentId = addForm.departmentId;
            const res = await usersAPI.createInstructor(payload);
            setAddResult({ email: res.user.email, tempPassword: res.tempPassword });
            setAddForm({ name: '', email: '', phone: '', departmentId: '' });
            reloadUsers();
            toast.success('Instructor created');
        } catch (err) {
            toast.error(err.message || 'Failed to create instructor');
        } finally {
            setAdding(false);
        }
    };

    const [abortControllers, setAbortControllers] = useState({});

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile) { toast.error('Choose a CSV or Excel file'); return; }
        setImporting(true);
        setImportResults(null);
        const ac = new AbortController();
        setAbortControllers(prev => ({ ...prev, instructor: ac }));
        try {
            const res = await usersAPI.importInstructors(importFile, { signal: ac.signal });
            setImportResults(res);
            reloadUsers();
            toast.success(`${res.created} created, ${res.failed} failed`);
        } catch (err) {
            if (err.name === 'AbortError') toast.error('Import timed out. Try a smaller file.');
            else toast.error(err.message || 'Import failed');
        } finally {
            setImporting(false);
            setAbortControllers(prev => ({ ...prev, instructor: null }));
        }
    };

    const handleStudentImport = async (e) => {
        e.preventDefault();
        if (!studentImportFile) { toast.error('Choose a CSV or Excel file'); return; }
        setImportingStudents(true);
        setStudentImportResults(null);
        const ac = new AbortController();
        setAbortControllers(prev => ({ ...prev, student: ac }));
        try {
            const res = await usersAPI.importStudents(studentImportFile, { signal: ac.signal });
            setStudentImportResults(res);
            reloadUsers();
            toast.success(`${res.created} students created, ${res.failed} failed`);
        } catch (err) {
            if (err.name === 'AbortError') toast.error('Import timed out. Try a smaller file.');
            else toast.error(err.message || 'Import failed');
        } finally {
            setImportingStudents(false);
            setAbortControllers(prev => ({ ...prev, student: null }));
        }
    };

    const cancelImport = (type) => {
        abortControllers[type]?.abort();
        setImporting(false);
        setImportingStudents(false);
    };

    const downloadPasswords = (rows, label = 'Instructor') => {
        const created = rows.filter(r => r.status === 'created');
        const csv = "Name,Email,Department,TempPassword\n" +
            created.map(r => `"${r.name || ''}","${r.email}","${r.departmentName || ''}","${r.tempPassword}"`).join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${label}_Credentials_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const safeUsers = users ?? [];

    // Rows currently visible in the DataGrid (post search/sort) — drives the CSV export.
    const [exportRows, setExportRows] = useState([]);

    // Controlled bulk-selection state for the DataGrid.
    const [selectedKeys, setSelectedKeys] = useState([]);

    // Users eligible for student↔instructor conversion in the dedicated tab.
    const convertibleUsers = (roleUsers || []).filter(u => ['STUDENT', 'INSTRUCTOR'].includes(u.role));

    const roleBadge = (role) => {
        const map = {
            STUDENT: { cls: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400', icon: GraduationCap },
            INSTRUCTOR: { cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', icon: Users },
            ADMIN: { cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', icon: Shield },
            SUPER_ADMIN: { cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400', icon: Crown },
        };
        const entry = map[role] || { cls: 'bg-muted text-muted-foreground', icon: Shield };
        const Icon = entry.icon;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${entry.cls}`}>
                <Icon size={13} /> {role.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <Breadcrumbs
                items={[{ label: 'Dashboard', to: '/admin' }, { label: 'User Management' }]}
                className="mb-1"
            />
            <PageHeader
                title="User Management"
                subtitle="Manage roles, statuses, departments, and instructor onboarding."
                action={
                    <div className="flex items-center gap-2">
                        {can('instructor.create') && (
                            <button
                                onClick={() => { setShowImport(true); setImportResults(null); setImportFile(null); }}
                                className="bg-card border border-border text-foreground px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-muted transition-colors"
                            >
                                <Upload size={16} /> Import Instructors
                            </button>
                        )}
                        {can('student.create') && (
                            <button
                                onClick={() => { setShowStudentImport(true); setStudentImportResults(null); setStudentImportFile(null); }}
                                className="bg-card border border-border text-foreground px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-muted transition-colors"
                            >
                                <Upload size={16} /> Import Students
                            </button>
                        )}
                        {can('instructor.create') && (
                            <button
                                onClick={() => { setShowAdd(true); setAddResult(null); }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
                            >
                                <UserPlus size={16} /> Add Instructor
                            </button>
                        )}
                        <button
                            onClick={() => {
                                const csv = "Name,Email,Role,Department,Joined,Status\n" +
                                    exportRows.map(u => `"${u.name}","${u.email}","${u.role}","${deptName(u.departmentId)}","${new Date(u.createdAt).toLocaleDateString()}",${u.active !== false ? 'Active' : 'Suspended'}`).join("\n");
                                const blob = new Blob([csv], { type: 'text/csv' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Users_Export_${new Date().toISOString().split('T')[0]}.csv`;
                                a.click();
                            }}
                            className="bg-card border border-border text-foreground px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-muted transition-colors"
                        >
                            Export CSV
                        </button>
                    </div>
                }
            />

            {studentLimitReached && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center flex-shrink-0">
                        <GraduationCap size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">Student limit reached ({deptCapacity.studentCount}/{deptCapacity.maxStudents})</p>
                        <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            Adding or importing new students into {deptCapacity.departmentName} is blocked until a Super Admin raises the limit.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex border-b border-border gap-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    All Users ({safeUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'requests' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Instructor Requests
                    {requests?.length > 0 && (
                        <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <ArrowLeftRight size={15} /> Role Changes
                </button>
            </div>

            {activeTab === 'users' && (
                <>
                    <FilterBar className="mb-6">
                        <FilterSelect value={filters.role} onChange={v => setFilter('role', v)}>
                            <option value="">All Roles</option>
                            <option value="STUDENT">Student</option>
                            <option value="INSTRUCTOR">Instructor</option>
                            {isSuperAdmin() && <option value="ADMIN">Admin</option>}
                            {isSuperAdmin() && <option value="SUPER_ADMIN">Super Admin</option>}
                        </FilterSelect>
                        <FilterSelect value={filters.status} onChange={v => setFilter('status', v)}>
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </FilterSelect>
                        {isSuperAdmin() && (
                            <FilterSelect value={filters.departmentId} onChange={v => setFilter('departmentId', v)} icon={Building2}>
                                <option value="">All Departments</option>
                                {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </FilterSelect>
                        )}
                        <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)}
                            title="Joined from"
                            className="bg-card border border-border text-foreground font-medium rounded-xl py-3 px-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                        <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)}
                            title="Joined to"
                            className="bg-card border border-border text-foreground font-medium rounded-xl py-3 px-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                    </FilterBar>

                    <DataGrid
                        columns={[
                            { key: 'name', header: 'User', sortable: true, render: (user) => <UserCell name={user.name} email={user.email} avatar={user.avatar} /> },
                            { key: 'rollNo', header: 'Roll No', sortable: true, render: (user) => user.rollNo ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold">
                                    {user.rollNo}
                                </span>
                            ) : (
                                <span className="text-muted-foreground/40 text-xs">—</span>
                            ) },
                            { key: 'role', header: 'Role', sortable: true, render: (user) => roleBadge(user.role) },
                            { key: 'departmentId', header: 'Department', sortable: true, value: (user) => deptName(user.departmentId), render: (user) => (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                    <Building2 size={12} /> {deptName(user.departmentId)}
                                </span>
                            ) },
                            { key: 'createdAt', header: 'Joined Date', sortable: true, value: (user) => new Date(user.createdAt).getTime(), render: (user) => (
                                <span className="text-muted-foreground font-medium text-[13px]">{new Date(user.createdAt).toLocaleDateString()}</span>
                            ) },
                            { key: 'status', header: 'Status', sortable: true, value: (user) => user.active !== false ? 'Active' : 'Suspended', render: (user) => (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(user.id); }}
                                    disabled={user.id === currentUser?.id}
                                    title={user.id === currentUser?.id ? "You can't change your own status" : undefined}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${user.active !== false
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100'
                                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-700 hover:bg-rose-100'}`}
                                >
                                    {user.active !== false
                                        ? <><CheckCircle size={14} /> Active</>
                                        : <><Ban size={14} /> Suspended</>}
                                </button>
                            ) },
                            { key: 'actions', header: 'Actions', align: 'right', render: (user) => (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleResetPassword(user); }}
                                        disabled={user.id === currentUser?.id}
                                        className="p-2 text-violet-500 hover:text-violet-600 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                        title={user.id === currentUser?.id ? "Use your profile to change your own password" : 'Reset password'}
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); requestDeleteUser(user); }}
                                        disabled={user.id === currentUser?.id}
                                        className="p-2 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                        title={user.id === currentUser?.id ? "You can't delete your own account" : 'Delete User'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </>
                            ) },
                        ]}
                        rows={safeUsers}
                        rowKey="id"
                        searchable
                        searchPlaceholder="Search users by name, email, roll no, or department..."
                        selectable
                        selectedKeys={selectedKeys}
                        onSelectionChange={setSelectedKeys}
                        bulkActions={[
                            { label: 'Delete selected', icon: Trash2, onClick: requestBulkDelete },
                        ]}
                        onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
                        onFilteredChange={setExportRows}
                        loading={loading}
                        loadingText="Loading users..."
                        emptyText="No users found matching your filters."
                    />
                </>
            )}

            {activeTab === 'requests' && (
                <DataTable
                    columns={['Applicant', 'Details', 'Sample Topic', 'Applied Date', 'Actions']}
                    loading={loadingRequests}
                    loadingText="Loading requests..."
                    empty={!loadingRequests && (!requests || requests.length === 0)}
                    emptyText="No pending instructor requests."
                >
                    {requests?.map((req) => (
                        <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-4 px-4">
                                <UserCell name={req.userName} email={req.userEmail} />
                            </td>
                            <td className="py-4 px-4">
                                <div className="text-sm">
                                    <p className="font-bold text-foreground">{req.expertise}</p>
                                    <p className="text-xs text-muted-foreground">{req.experience} experience</p>
                                </div>
                            </td>
                            <td className="py-4 px-4 text-sm text-muted-foreground">
                                {req.sampleTopic}
                            </td>
                            <td className="py-4 px-4 text-muted-foreground font-medium text-[13px]">
                                {new Date(req.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleRequestAction(req.id, 'APPROVE')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Approve</button>
                                    <button onClick={() => handleRequestAction(req.id, 'REJECT')} className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Reject</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </DataTable>
            )}

            {activeTab === 'roles' && (
                <>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <Lock size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-indigo-800 dark:text-indigo-200">
                            <p className="font-bold mb-1">Convert users between Student and Instructor</p>
                            <p className="text-xs opacity-80">
                                Every role change requires <b>your admin password</b> to authorize. The change is logged for the audit trail.
                            </p>
                        </div>
                    </div>

                    <DataTable
                        columns={['User', 'Current Role', 'Department', 'Change Role']}
                        loading={loadingRoleUsers}
                        loadingText="Loading users..."
                        empty={!loadingRoleUsers && convertibleUsers.length === 0}
                        emptyText="No students or instructors available to convert."
                    >
                        {convertibleUsers.map((user) => {
                            const target = user.role === 'STUDENT' ? 'INSTRUCTOR' : 'STUDENT';
                            return (
                                <tr key={user.id} className="hover:bg-muted/40 transition-colors">
                                    <td className="py-4 px-4">
                                        <UserCell name={user.name} email={user.email} avatar={user.avatar} />
                                    </td>
                                    <td className="py-4 px-4">
                                        {roleBadge(user.role)}
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                            <Building2 size={12} /> {deptName(user.departmentId)}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRoleSelect(user, target); }}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow ${target === 'INSTRUCTOR'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100'
                                                : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100'}`}
                                        >
                                            <ArrowLeftRight size={14} />
                                            Make {target === 'INSTRUCTOR' ? 'Instructor' : 'Student'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </DataTable>
                </>
            )}

            {/* Add Instructor modal */}
            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Add Instructor</h3>
                            <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        {addResult ? (
                            <div className="p-8 space-y-4">
                                <div className="flex items-center gap-2 text-emerald-600"><CheckCircle size={20} /><p className="font-bold">Instructor account created</p></div>
                                <div className="bg-muted/40 border border-border rounded-2xl p-4 text-sm">
                                    <p className="text-muted-foreground">Email</p>
                                    <p className="font-bold text-foreground mb-3">{addResult.email}</p>
                                    <p className="text-muted-foreground">Temporary password (share securely)</p>
                                    <p className="font-mono font-bold text-foreground select-all">{addResult.tempPassword}</p>
                                </div>
                                <p className="text-[11px] text-muted-foreground">The instructor should change this after first login.</p>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setAddResult(null)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Add another</button>
                                    <button onClick={() => setShowAdd(false)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Done</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleAddInstructor} className="p-8 space-y-4">
                                <input required type="text" placeholder="Full name" value={addForm.name}
                                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium" />
                                <input required type="email" placeholder="Email address" value={addForm.email}
                                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium" />
                                <input type="tel" placeholder="Phone (optional)" value={addForm.phone}
                                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium" />
                                {isSuperAdmin() && (
                                    <select value={addForm.departmentId} onChange={e => setAddForm(f => ({ ...f, departmentId: e.target.value }))}
                                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:border-indigo-500 text-sm font-medium appearance-none">
                                        <option value="">Global (no department)</option>
                                        {(departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                )}
                                <p className="text-[11px] text-muted-foreground">A temporary password is generated automatically and shown after creation.</p>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                    <button type="submit" disabled={adding} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">{adding ? 'Creating...' : 'Create'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Import modal */}
            {showImport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Import Instructors</h3>
                            <button onClick={() => setShowImport(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <div className="p-8 space-y-4">
                            {!importResults ? (
                                <form onSubmit={handleImport} className="space-y-4">
                                    <p className="text-sm text-muted-foreground">Upload a <b>CSV or Excel</b> file with columns <code className="font-mono">name, email</code> (optional <code className="font-mono">phone</code>). Each instructor is created in {isSuperAdmin() ? 'the global pool' : 'your department'} with an auto-generated password.</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { usersAPI.downloadInstructorTemplate().catch(err => toast.error(err.message)); }}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            <Download size={14} /> Download sample template
                                        </button>
                                    </div>
                                    <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setImportFile(e.target.files[0])}
                                        className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-bold hover:file:bg-indigo-700 cursor-pointer" />
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowImport(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                        {importing ? (
                                            <button type="button" onClick={() => cancelImport('instructor')} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Cancel</button>
                                        ) : (
                                            <button type="submit" disabled={importing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Import</button>
                                        )}
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{importResults.created} created · {importResults.failed} failed</p>
                                            <p className="text-xs font-semibold text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                <Building2 size={12} className="text-indigo-500" />
                                                Target department: <span className="font-bold text-indigo-600 dark:text-indigo-400">{importResults.departmentName || 'Global'}</span>
                                            </p>
                                        </div>
                                        {importResults.created > 0 && (
                                            <button onClick={() => downloadPasswords(importResults.results, 'Instructor')} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-bold">
                                                <Download size={16} /> Download passwords
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto border border-border rounded-2xl divide-y divide-border">
                                        {importResults.results.map((r, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <span className="font-medium text-foreground truncate">{r.email || '(no email)'}</span>
                                                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                                                        <Building2 size={10} /> {r.departmentName || 'Global'}
                                                    </span>
                                                </div>
                                                {r.status === 'created'
                                                    ? <span className="shrink-0 text-emerald-600 font-bold text-xs">Created</span>
                                                    : <span className="shrink-0 text-rose-600 font-bold text-xs" title={r.error}>{r.error || 'Failed'}</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setShowImport(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Done</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Import Students modal */}
            {showStudentImport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Import Students</h3>
                            <button onClick={() => setShowStudentImport(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <div className="p-8 space-y-4">
                            {!studentImportResults ? (
                                <form onSubmit={handleStudentImport} className="space-y-4">
                                    <p className="text-sm text-muted-foreground">Upload a <b>CSV or Excel</b> file with columns <code className="font-mono">name, email, roll_no</code> (optional <code className="font-mono">phone</code>). Each student is created in {isSuperAdmin() ? 'the global pool' : 'your department'} with an auto-generated password. Roll numbers must be unique per department.</p>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-2xl p-4">
                                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">Expected CSV/Excel format:</p>
                                        <code className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">name,email,roll_no,phone\nJane Doe,jane@example.com,CS22001,9876543210</code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { usersAPI.downloadStudentTemplate().catch(err => toast.error(err.message)); }}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            <Download size={14} /> Download sample template
                                        </button>
                                    </div>
                                    <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setStudentImportFile(e.target.files[0])}
                                        className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-bold hover:file:bg-indigo-700 cursor-pointer" />
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowStudentImport(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                        {importingStudents ? (
                                            <button type="button" onClick={() => cancelImport('student')} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Cancel</button>
                                        ) : (
                                            <button type="submit" disabled={importingStudents} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Import</button>
                                        )}
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{studentImportResults.created} created · {studentImportResults.failed} failed</p>
                                            <p className="text-xs font-semibold text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                <Building2 size={12} className="text-indigo-500" />
                                                Target department: <span className="font-bold text-indigo-600 dark:text-indigo-400">{studentImportResults.departmentName || 'Global'}</span>
                                            </p>
                                        </div>
                                        {studentImportResults.created > 0 && (
                                            <button onClick={() => downloadPasswords(studentImportResults.results, 'Student')} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-bold">
                                                <Download size={16} /> Download passwords
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto border border-border rounded-2xl divide-y divide-border">
                                        {studentImportResults.results.map((r, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <span className="font-medium text-foreground truncate">{r.email || '(no email)'}</span>
                                                    {r.rollNo && <span className="shrink-0 text-muted-foreground text-[10px] font-mono font-bold">{r.rollNo}</span>}
                                                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                                                        <Building2 size={10} /> {r.departmentName || 'Global'}
                                                    </span>
                                                </div>
                                                {r.status === 'created'
                                                    ? <span className="shrink-0 text-emerald-600 font-bold text-xs">Created</span>
                                                    : <span className="shrink-0 text-rose-600 font-bold text-xs" title={r.error}>{r.error || 'Failed'}</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setShowStudentImport(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Done</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Role Change Confirmation Modal */}
            {roleChangeConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-foreground tracking-tight mb-1">
                                    Confirm Role Change
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Change <strong className="text-foreground">{roleChangeConfirm.user.name}</strong>'s role from{' '}
                                    <strong className="text-foreground">{roleChangeConfirm.user.role.replace('_', ' ')}</strong> to{' '}
                                    <strong className="text-indigo-600">{roleChangeConfirm.newRole.replace('_', ' ')}</strong>?
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-2">
                                    This action is logged for compliance.
                                </p>
                            </div>

                            {/* Admin password — required to authorize the change */}
                            <div className="text-left space-y-1.5 w-full">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground/70 ml-1">
                                    Your admin password <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={roleChangePassword}
                                    onChange={e => setRoleChangePassword(e.target.value)}
                                    placeholder="Enter your password to authorize"
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-medium"
                                />
                            </div>

                            {/* Optional reason for compliance (NAAC/UGC audit trail) */}
                            <div className="text-left space-y-1.5 w-full">
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground/70 ml-1">
                                    Reason for change <span className="text-muted-foreground/40">(optional — for audit trail)</span>
                                </label>
                                <textarea
                                    value={roleChangeReason}
                                    onChange={e => setRoleChangeReason(e.target.value)}
                                    placeholder="e.g. Department head requested, administrative restructuring..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setRoleChangeConfirm(null); setRoleChangeReason(''); setRoleChangePassword(''); }}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                                >
                                    No, Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmRoleChange}
                                    disabled={roleChanging}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-amber-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {roleChanging ? 'Changing...' : 'Yes, Change Role'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Reset Confirm Modal */}
            {resetTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <RotateCcw size={20} className="text-violet-600" /> Reset Password
                            </h3>
                            <button onClick={() => setResetTarget(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground font-medium">
                                Reset the password for <span className="font-bold text-foreground">{resetTarget.name}</span>?
                                A new temporary password will be generated.
                            </p>
                            <label className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={forceReset}
                                    onChange={e => setForceReset(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded accent-violet-600"
                                />
                                <span>
                                    <span className="block text-sm font-bold text-foreground">Force password change on next login</span>
                                    <span className="block text-xs text-muted-foreground mt-0.5">
                                        The user must set a new password before they can continue using the platform.
                                    </span>
                                </span>
                            </label>
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setResetTarget(null)}
                                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-2xl font-bold text-sm text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmResetPassword}
                                    disabled={resetting}
                                    className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-2xl font-bold text-sm transition-colors"
                                >
                                    {resetting ? 'Resetting...' : 'Yes, Reset Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation (single or bulk) */}
            <ConfirmDialog
                open={!!deleteTarget || !!bulkDeleteRows}
                title={bulkDeleteRows ? `Delete ${bulkDeleteRows.length} selected users?` : `Delete "${deleteTarget?.name}"?`}
                message={bulkDeleteRows
                    ? 'The selected users will be permanently removed. Users tied to existing courses or data cannot be deleted.'
                    : 'This user will be permanently removed. This cannot be undone.'}
                confirmLabel="Delete"
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => { if (!deleting) { setDeleteTarget(null); setBulkDeleteRows(null); } }}
            />

            {/* Password Reset Result Modal */}
            {resetResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                                <RotateCcw size={20} className="text-violet-600" /> Password Reset
                            </h3>
                            <button onClick={() => setResetResult(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <p className="text-sm text-muted-foreground font-medium">
                                New temporary password for <span className="font-bold text-foreground">{resetResult.name}</span>.
                                Share it securely — it won't be shown again.
                            </p>
                            {resetResult.mustChange && (
                                <p className="text-[12px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
                                    This user must change their password on next login.
                                </p>
                            )}
                            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-2xl px-4 py-3">
                                <code className="flex-1 font-mono text-sm font-bold text-foreground break-all">{resetResult.tempPassword}</code>
                                <button
                                    onClick={() => { navigator.clipboard?.writeText(resetResult.tempPassword); toast.success('Copied'); }}
                                    className="p-2 text-violet-600 hover:bg-violet-50 rounded-xl transition-all flex-shrink-0" title="Copy">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <button onClick={() => setResetResult(null)}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
