import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

// Normalize snake_case DB fields to camelCase for frontend
const mapUser = (u) => ({
    ...u,
    currentStreak: u.current_streak || u.currentStreak || 0,
    longestStreak: u.longest_streak || u.longestStreak || 0,
    departmentId: u.department_id ?? u.departmentId ?? null,
    createdAt: u.created_at || u.createdAt,
});

const initialState = {
    user: null,
    token: null,
    loading: true,
    isAuthenticated: false,
};

function authReducer(state, action) {
    switch (action.type) {
        case 'SET_USER':
            return { ...state, user: action.payload.user, token: action.payload.token, isAuthenticated: true, loading: false };
        case 'LOGOUT':
            return { ...initialState, loading: false };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'UPDATE_USER':
            return { ...state, user: { ...state.user, ...action.payload } };
        default:
            return state;
    }
}

export function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    const initAuth = useCallback(async () => {
        const token = localStorage.getItem('lms_token');
        if (!token) {
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
        }
        try {
            const user = await authAPI.verifyToken(token);
            dispatch({ type: 'SET_USER', payload: { user: mapUser(user), token } });
        } catch {
            localStorage.removeItem('lms_token');
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    useEffect(() => { initAuth(); }, [initAuth]);

    const login = useCallback(async (email, password) => {
        const { user, token } = await authAPI.login(email, password);
        const safeUser = mapUser(user);
        localStorage.setItem('lms_token', token);
        dispatch({ type: 'SET_USER', payload: { user: safeUser, token } });
        toast.success(`Welcome back, ${safeUser.name}! 👋`);
        return safeUser;
    }, []);

    const register = useCallback(async (name, email, password, role, departmentId = null, rollNo = null) => {
        const { user, token } = await authAPI.register(name, email, password, role, departmentId, rollNo);
        const safeUser = mapUser(user);
        localStorage.setItem('lms_token', token);
        dispatch({ type: 'SET_USER', payload: { user: safeUser, token } });
        toast.success(`Account created! Welcome, ${safeUser.name}! 🎉`);
        return safeUser;
    }, []);

    const demoLogin = useCallback(async (role = 'STUDENT') => {
        const { user, token } = await authAPI.loginWithDemo(role);
        const safeUser = mapUser(user);
        localStorage.setItem('lms_token', token);
        dispatch({ type: 'SET_USER', payload: { user: safeUser, token } });
        toast.success(`Welcome back, ${safeUser.name}! 👋`);
        return safeUser;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('lms_token');
        dispatch({ type: 'LOGOUT' });
        toast.success('Logged out successfully');
    }, []);

    const updateUser = useCallback((updates) => {
        dispatch({ type: 'UPDATE_USER', payload: updates });
    }, []);

    const userRole = state.user?.role;
    const hasRole = useCallback((...roles) => roles.includes(userRole), [userRole]);
    const isAdmin = useCallback(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole), [userRole]);
    const isSuperAdmin = useCallback(() => userRole === 'SUPER_ADMIN', [userRole]);
    const isInstructor = useCallback(() => userRole === 'INSTRUCTOR', [userRole]);
    const isStudent = useCallback(() => userRole === 'STUDENT', [userRole]);

    // Granular permission check: the backend ships the user's effective
    // permission list (role matrix + per-user overrides) on every auth response.
    // SUPER_ADMIN implicitly holds every permission. Falls back to the role
    // matrix so the UI still works if a cached user predates the permissions
    // field (stale localStorage token from before the upgrade).
    const can = useCallback((...permissions) => {
        const perms = state.user?.permissions;
        if (Array.isArray(perms)) return permissions.some(p => perms.includes(p));
        const roleDefaults = {
            STUDENT: ['course.view', 'course.enroll', 'assignment.submit', 'quiz.attempt'],
            INSTRUCTOR: ['course.view', 'course.create', 'course.update', 'assignment.create', 'assignment.update', 'grade.update', 'quiz.create', 'attendance.manage', 'announcement.create'],
            ADMIN: ['department.view', 'user.view', 'student.create', 'student.update', 'student.delete', 'instructor.create', 'instructor.update', 'instructor.delete', 'user.status.update', 'user.password.reset', 'user.role.change', 'course.view', 'course.update', 'course.delete', 'course.approve', 'enrollment.manage', 'import.users', 'category.manage', 'announcement.create', 'attendance.manage', 'audit.view', 'reports.view', 'assignment.create', 'assignment.update', 'grade.update'],
        };
        if (userRole === 'SUPER_ADMIN') return true;
        return (roleDefaults[userRole] || []).some(p => permissions.includes(p));
    }, [state.user?.permissions, userRole]);

    // Memoize the value so consumers don't re-render on every provider render
    // (functions are stable; the object identity only changes with auth state).
    const value = useMemo(() => ({
        ...state,
        login, register, demoLogin, logout, updateUser,
        hasRole, isAdmin, isSuperAdmin, isInstructor, isStudent, can,
    }), [state, login, register, demoLogin, logout, updateUser,
        hasRole, isAdmin, isSuperAdmin, isInstructor, isStudent, can]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
