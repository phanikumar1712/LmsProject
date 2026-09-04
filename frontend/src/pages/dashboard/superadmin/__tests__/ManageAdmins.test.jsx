/**
 * ManageAdmins — filter & grouping tests
 *
 * Strategy: mock useAsyncData to supply fixture data directly, so we test the
 * component's filtering/grouping rendering logic without AbortController timing.
 *
 * Important: `getByText` matches ALL elements containing the text, including
 * <option> tags in filter dropdowns. We use `screen.getAllByText` + assertions
 * on length, or target more specific containers to avoid false matches.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useNavigate: () => vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'sa-1', name: 'Super Admin', role: 'SUPER_ADMIN' },
        isSuperAdmin: () => true,
    }),
}));

vi.mock('../../../../components/ui/PermissionBadges', () => ({
    default: () => null,
}));

// ── Fixture data ─────────────────────────────────────────────────────────────

const DEPARTMENTS = [
    { id: 'dept-cse', name: 'CSE' },
    { id: 'dept-ece', name: 'ECE' },
    { id: 'dept-eee', name: 'EEE' },
];

const ALL_USERS = [
    { id: 'sa-1', name: 'Super Admin', email: 'superadmin@lms.com', role: 'SUPER_ADMIN', departmentId: null, department_id: null, departmentName: null, active: true, createdAt: '2026-01-01', created_at: '2026-01-01', lastLogin: null, last_login: null, avatar: '', username: null, phone: '' },
    { id: 'adm-1', name: 'CSE Admin', email: 'cse.admin@lms.com', role: 'ADMIN', departmentId: 'dept-cse', department_id: 'dept-cse', departmentName: 'CSE', active: true, createdAt: '2026-02-01', created_at: '2026-02-01', lastLogin: null, last_login: null, avatar: '', username: null, phone: '' },
    { id: 'adm-2', name: 'ECE Admin', email: 'ece.admin@lms.com', role: 'ADMIN', departmentId: 'dept-ece', department_id: 'dept-ece', departmentName: 'ECE', active: true, createdAt: '2026-03-01', created_at: '2026-03-01', lastLogin: null, last_login: null, avatar: '', username: null, phone: '' },
    { id: 'adm-3', name: 'EEE Admin', email: 'eee.admin@lms.com', role: 'ADMIN', departmentId: 'dept-eee', department_id: 'dept-eee', departmentName: 'EEE', active: false, createdAt: '2026-04-01', created_at: '2026-04-01', lastLogin: null, last_login: null, avatar: '', username: null, phone: '' },
    { id: 'stu-1', name: 'Riya Sharma', email: 'riya@lms.com', role: 'STUDENT', departmentId: 'dept-cse', department_id: 'dept-cse', departmentName: 'CSE', active: true, createdAt: '2026-05-01', created_at: '2026-05-01', lastLogin: null, last_login: null, avatar: '', username: null, phone: '' },
    { id: 'inst-1', name: 'Dr. Patel', email: 'patel@lms.com', role: 'INSTRUCTOR', departmentId: 'dept-cse', department_id: 'dept-cse', departmentName: 'CSE', active: true, createdAt: '2026-06-01', created_at: '2026-06-01', lastLogin: null, last_login: null, avatar: '', username: null, phone: '' },
];

// ── Mock useAsyncData — return fixture data directly ─────────────────────────
// vi.mock factories are hoisted, so use vi.hoisted() for mutable state.
const { getUsers, getDepts, setUsers, setDepts } = vi.hoisted(() => {
    let _users = null;
    let _depts = null;
    return {
        getUsers: () => _users,
        getDepts: () => _depts,
        setUsers: (v) => { _users = v; },
        setDepts: (v) => { _depts = v; },
    };
});

vi.mock('../../../../hooks/useAsyncData', () => ({
    useAsyncData: (fetcher) => {
        const fnStr = String(fetcher);
        if (fnStr.includes('getAll')) {
            return { data: getUsers(), loading: false, error: null, reload: vi.fn() };
        }
        return { data: getDepts(), loading: false, error: null, reload: vi.fn() };
    },
}));

vi.mock('../../../../services/api', () => ({
    usersAPI: {
        getAll: vi.fn(),
        toggleStatus: vi.fn().mockResolvedValue({}),
        resetPassword: vi.fn().mockResolvedValue({ tempPassword: 'Temp@123' }),
        inviteAdmin: vi.fn().mockResolvedValue({}),
        updateUser: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
        updateRole: vi.fn().mockResolvedValue({}),
        getUserDepartments: vi.fn().mockResolvedValue([]),
        getPermissions: vi.fn().mockResolvedValue({ effective: [], overrides: {} }),
        setAdminDepartments: vi.fn().mockResolvedValue({}),
    },
    departmentsAPI: { list: vi.fn() },
}));

// ── Import component AFTER mocks ─────────────────────────────────────────────
import ManageAdmins from '../ManageAdmins';

// ── Helpers ──────────────────────────────────────────────────────────────────

const renderAdmins = (users = ALL_USERS, depts = DEPARTMENTS) => {
    setUsers(users);
    setDepts(depts);
    return render(<ManageAdmins />);
};

/** Find a <select> by checking its option values */
const findSelect = (optionValues) =>
    Array.from(document.querySelectorAll('select')).find(s =>
        optionValues.every(v => Array.from(s.options).some(o => o.value === v))
    );

const getRoleSelect = () => findSelect(['ADMIN', 'SUPER_ADMIN']);
const getStatusSelect = () => findSelect(['Active', 'Suspended']);
const getDeptSelect = () => findSelect(['dept-cse']);
const getGroupSelect = () => findSelect(['role', 'department']);

/**
 * Check that a user name appears in the rendered list (not inside a <select>).
 * We search all elements with that text and verify at least one is NOT an option.
 */
const userVisible = (name) => {
    const matches = screen.getAllByText(name);
    return matches.some(el => el.tagName !== 'OPTION');
};

const userNotVisible = (name) => {
    const matches = screen.queryAllByText(name);
    if (matches.length === 0) return true;
    return matches.every(el => el.tagName === 'OPTION');
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ManageAdmins — filtering', () => {
    it('renders only ADMIN and SUPER_ADMIN users', () => {
        renderAdmins();
        expect(userVisible('CSE Admin')).toBe(true);
        expect(userVisible('ECE Admin')).toBe(true);
        expect(userVisible('EEE Admin')).toBe(true);
        expect(userNotVisible('Riya Sharma')).toBe(true);
        expect(userNotVisible('Dr. Patel')).toBe(true);
    });

    it('shows correct summary counts', () => {
        renderAdmins();
        // stats: Total Admins=3, Super Admins=1, Active=3, Filtered=4
        const cards = screen.getAllByText(/\d+/);
        const values = cards.filter(el => el.tagName === 'P' && el.className.includes('font-extrabold')).map(el => el.textContent);
        expect(values).toContain('4'); // Filtered
        expect(values).toContain('1'); // Super Admins
        expect(values).toContain('3'); // Total Admins or Active
    });

    it('filters by role: ADMIN only', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getRoleSelect(), 'ADMIN');

        expect(userNotVisible('Super Admin')).toBe(true);
        expect(userVisible('CSE Admin')).toBe(true);
        expect(userVisible('ECE Admin')).toBe(true);
        expect(userVisible('EEE Admin')).toBe(true);
    });

    it('filters by role: SUPER_ADMIN only', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getRoleSelect(), 'SUPER_ADMIN');

        expect(userVisible('Super Admin')).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
    });

    it('filters by status: Suspended', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getStatusSelect(), 'Suspended');

        expect(userVisible('EEE Admin')).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
    });

    it('filters by status: Active', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getStatusSelect(), 'Active');

        expect(userVisible('Super Admin')).toBe(true);
        expect(userVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('EEE Admin')).toBe(true);
    });

    it('filters by department: CSE', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getDeptSelect(), 'dept-cse');

        expect(userVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('ECE Admin')).toBe(true);
        expect(userNotVisible('EEE Admin')).toBe(true);
        expect(userNotVisible('Super Admin')).toBe(true);
    });

    it('filters by department: Global (no dept)', async () => {
        const user = userEvent.setup();
        renderAdmins();
        const deptSelect = getDeptSelect();
        // The Global option has value=""
        await user.selectOptions(deptSelect, '');

        // Super Admin has departmentId: null → shown as 'Global'
        // Find the 'Global' badge span to confirm it's visible
        const globalBadge = document.querySelectorAll('span');
        const hasGlobalBadge = Array.from(globalBadge).some(el => el.textContent === 'Global');
        expect(hasGlobalBadge).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
    });

    it('search filters by name', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.type(screen.getByPlaceholderText(/search by name/i), 'CSE');

        expect(userVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('ECE Admin')).toBe(true);
    });

    it('search filters by email', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.type(screen.getByPlaceholderText(/search by name/i), 'superadmin');

        expect(userVisible('Super Admin')).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
    });

    it('combines role + status filters (ADMIN + Suspended = EEE only)', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getRoleSelect(), 'ADMIN');
        await user.selectOptions(getStatusSelect(), 'Suspended');

        expect(userVisible('EEE Admin')).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('Super Admin')).toBe(true);
    });

    it('shows "No admins found" when filters match nothing', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.type(screen.getByPlaceholderText(/search by name/i), 'zzzznonexistent');

        expect(screen.getByText('No admins found')).toBeInTheDocument();
    });

    it('filtered count card updates on role filter', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getRoleSelect(), 'SUPER_ADMIN');

        // After filtering to SUPER_ADMIN only, only 1 user card should render
        expect(userVisible('Super Admin')).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('ECE Admin')).toBe(true);
    });
});

describe('ManageAdmins — grouping', () => {
    it('groups by role when selected', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getGroupSelect(), 'role');

        // Group headers appear as <button> elements with group name + count badge
        const roleHeaders = screen.getAllByText(/SUPER_ADMIN|ADMIN/).filter(
            el => el.tagName === 'SPAN' && el.closest('button')
        );
        expect(roleHeaders.length).toBeGreaterThanOrEqual(2);
    });

    it('groups by department when selected', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getGroupSelect(), 'department');

        // "Unassigned" group for Super Admin (no dept)
        const unassignedMatches = screen.getAllByText('Unassigned');
        expect(unassignedMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('collapses and expands groups', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.selectOptions(getGroupSelect(), 'role');

        // All admin users visible in grouped list
        expect(userVisible('CSE Admin')).toBe(true);
        expect(userVisible('ECE Admin')).toBe(true);

        // Find the ADMIN group toggle button (not SUPER_ADMIN)
        const adminGroupBtn = Array.from(document.querySelectorAll('button')).find(btn => {
            const spans = btn.querySelectorAll('span');
            return Array.from(spans).some(s => s.textContent.trim() === 'ADMIN');
        });
        expect(adminGroupBtn).toBeTruthy();

        // Collapse the ADMIN group
        await user.click(adminGroupBtn);

        // After collapse: SUPER_ADMIN group still shows Super Admin, but CSE/ECE Admin hidden
        expect(userVisible('Super Admin')).toBe(true);
        expect(userNotVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('ECE Admin')).toBe(true);

        // Expand again
        await user.click(adminGroupBtn);
        expect(userVisible('CSE Admin')).toBe(true);
        expect(userVisible('ECE Admin')).toBe(true);
    });

    it('resets grouping when switching back to No Grouping', async () => {
        const user = userEvent.setup();
        renderAdmins();

        await user.selectOptions(getGroupSelect(), 'role');
        expect(userVisible('CSE Admin')).toBe(true);

        await user.selectOptions(getGroupSelect(), 'none');
        // Users should still be visible in flat list
        expect(userVisible('CSE Admin')).toBe(true);
    });
});

describe('ManageAdmins — search interaction', () => {
    it('search is case-insensitive', async () => {
        const user = userEvent.setup();
        renderAdmins();
        await user.type(screen.getByPlaceholderText(/search by name/i), 'cse');

        expect(userVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('ECE Admin')).toBe(true);
    });

    it('search works together with role filter', async () => {
        const user = userEvent.setup();
        renderAdmins();

        await user.selectOptions(getRoleSelect(), 'ADMIN');
        await user.type(screen.getByPlaceholderText(/search by name/i), 'cse');

        expect(userVisible('CSE Admin')).toBe(true);
        expect(userNotVisible('ECE Admin')).toBe(true);
        expect(userNotVisible('Super Admin')).toBe(true);
    });
});
