import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

// Normalize snake_case DB fields to camelCase for frontend
const mapUser = (u) => ({
    ...u,
    subscriptionPlan: u.subscription_plan || u.subscriptionPlan || 'FREE',
    subscriptionExpiry: u.subscription_expiry || u.subscriptionExpiry || null,
    currentStreak: u.current_streak || u.currentStreak || 0,
    longestStreak: u.longest_streak || u.longestStreak || 0,
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

    const login = async (email, password) => {
        const { user, token } = await authAPI.login(email, password);
        const safeUser = mapUser(user);
        localStorage.setItem('lms_token', token);
        dispatch({ type: 'SET_USER', payload: { user: safeUser, token } });
        toast.success(`Welcome back, ${safeUser.name}! 👋`);
        return safeUser;
    };

    const register = async (name, email, password, role) => {
        const { user, token } = await authAPI.register(name, email, password, role);
        const safeUser = mapUser(user);
        localStorage.setItem('lms_token', token);
        dispatch({ type: 'SET_USER', payload: { user: safeUser, token } });
        toast.success(`Account created! Welcome, ${safeUser.name}! 🎉`);
        return safeUser;
    };

    const logout = () => {
        localStorage.removeItem('lms_token');
        dispatch({ type: 'LOGOUT' });
        toast.success('Logged out successfully');
    };

    const updateUser = (updates) => {
        dispatch({ type: 'UPDATE_USER', payload: updates });
    };

    const hasRole = (...roles) => roles.includes(state.user?.role);
    const isAdmin = () => ['ADMIN', 'SUPER_ADMIN'].includes(state.user?.role);
    const isSuperAdmin = () => state.user?.role === 'SUPER_ADMIN';
    const isInstructor = () => state.user?.role === 'INSTRUCTOR';
    const isStudent = () => state.user?.role === 'STUDENT';

    return (
        <AuthContext.Provider value={{
            ...state,
            login, register, logout, updateUser,
            hasRole, isAdmin, isSuperAdmin, isInstructor, isStudent,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
