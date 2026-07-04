import { useState } from 'react';
import { CheckCircle, Ban, Trash2 } from 'lucide-react';
import { usersAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { SearchInput, FilterBar } from '../../../components/ui/SearchInput';
import { DataTable, UserCell } from '../../../components/ui/DataTable';
import { useAuth } from '../../../contexts/AuthContext';

export default function AdminUsers() {
    const { isSuperAdmin, user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const [searchTerm, setSearchTerm] = useState('');
    const { data: users, loading, reload: reloadUsers } = useAsyncData(() => usersAPI.getAll(), []);
    const { data: requests, loading: loadingRequests, reload: reloadRequests } = useAsyncData(() => usersAPI.getInstructorRequests(), []);

    const handleRoleChange = async (userId, newRole) => {
        try {
            await usersAPI.updateRole(userId, newRole);
            reloadUsers();
            toast.success(`User role updated to ${newRole}`);
        } catch (err) {
            toast.error(err.message || 'Failed to update role');
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

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
        try {
            await usersAPI.delete(userId);
            reloadUsers();
            toast.success('User deleted');
        } catch (err) {
            toast.error(err.message || 'Failed to delete user. They might be tied to existing courses/data.');
        }
    };

    const safeUsers = users ?? [];
    const filteredUsers = safeUsers.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader
                title="User Management"
                subtitle="Manage user roles, statuses, and approve instructor requests."
                action={
                    <button
                        onClick={() => {
                            const csv = "Name,Email,Role,Joined,Status\n" +
                                filteredUsers.map(u => `"${u.name}","${u.email}","${u.role}","${new Date(u.createdAt).toLocaleDateString()}",${u.active !== false ? 'Active' : 'Suspended'}`).join("\n");
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
                }
            />

            <div className="flex border-b border-border gap-6">
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
            </div>

            {activeTab === 'users' && (
                <>
                    <FilterBar className="mb-6">
                        <SearchInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search users by name or email..."
                        />
                    </FilterBar>

                    <DataTable
                        columns={['User', 'Role', 'Joined Date', 'Status', 'Actions']}
                        loading={loading}
                        loadingText="Loading users..."
                        empty={!loading && filteredUsers.length === 0}
                        emptyText="No users found matching your search."
                    >
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-muted/40 transition-colors">
                                <td className="py-4 px-4">
                                    <UserCell name={user.name} email={user.email} avatar={user.avatar} />
                                </td>
                                <td className="py-4 px-4">
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                        className="bg-card border border-border text-foreground text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 shadow-sm transition-colors cursor-pointer"
                                    >
                                        <option value="STUDENT">Student</option>
                                        <option value="INSTRUCTOR">Instructor</option>
                                        {isSuperAdmin() && (
                                            <>
                                                <option value="ADMIN">Admin</option>
                                                <option value="SUPER_ADMIN">Super Admin</option>
                                            </>
                                        )}
                                    </select>
                                </td>
                                <td className="py-4 px-4 text-muted-foreground font-medium text-[13px]">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-4">
                                    <button
                                        onClick={() => handleToggleStatus(user.id)}
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
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        disabled={user.id === currentUser?.id}
                                        className="p-2 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                        title={user.id === currentUser?.id ? "You can't delete your own account" : 'Delete User'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </DataTable>
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
        </div>
    );
}
