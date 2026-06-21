import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardLayout, PublicLayout } from './components/layout/Layout';
import { ProtectedRoute, GuestRoute } from './components/routes/ProtectedRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import QuizPage from './pages/QuizPage';
import InstructorProfilePage from './pages/InstructorProfilePage';




// Dashboards
import StudentDashboard from './pages/dashboard/StudentDashboard';
import InstructorDashboard from './pages/dashboard/InstructorDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import InstructorCourses from './pages/dashboard/instructor/InstructorCourses';
import CreateCourseForm from './pages/dashboard/instructor/CreateCourseForm';
import InstructorStudents from './pages/dashboard/instructor/InstructorStudents';
import InstructorReviews from './pages/dashboard/instructor/InstructorReviews';
import InstructorAnalytics from './pages/dashboard/instructor/InstructorAnalytics';
import InstructorQuizBuilder from './pages/dashboard/instructor/InstructorQuizBuilder';
import AdminUsers from './pages/dashboard/admin/AdminUsers';
import AdminCourses from './pages/dashboard/admin/AdminCourses';
import BecomeInstructorPage from './pages/BecomeInstructorPage';
import ProfilePage from './pages/ProfilePage';
import StudentCourses from './pages/dashboard/student/StudentCourses';
import StudentWishlist from './pages/dashboard/student/StudentWishlist';
import StudentQuizzes from './pages/dashboard/student/StudentQuizzes';
import StudentCertificates from './pages/dashboard/student/StudentCertificates';
import StudentSubscription from './pages/dashboard/student/StudentSubscription';
import CourseLearningPlayer from './pages/dashboard/student/CourseLearningPlayer';
import SuperAdminAnalytics from './pages/dashboard/superadmin/SuperAdminAnalytics';
import AuditLogs from './pages/dashboard/superadmin/AuditLogs';
import SystemHealth from './pages/dashboard/superadmin/SystemHealth';
import PlatformSettings from './pages/dashboard/superadmin/PlatformSettings';
import ManageAdmins from './pages/dashboard/superadmin/ManageAdmins';
import SubscriptionPlans from './pages/dashboard/superadmin/SubscriptionPlans';
import AdminCategories from './pages/dashboard/admin/AdminCategories';
import ModerateReviews from './pages/dashboard/admin/ModerateReviews';
import AdminReports from './pages/dashboard/admin/AdminReports';
import AdminSubscriptions from './pages/dashboard/admin/AdminSubscriptions';

// Placeholder empty page for other routes
const Placeholder = ({ title }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/40 border border-border border-dashed rounded-2xl m-4">
    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 text-2xl shadow-inner">🚧</div>
    <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'Outfit' }}>{title}</h2>
    <p className="text-muted-foreground max-w-sm font-medium">This page is under construction. Check back soon for updates!</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes with shared Navbar (used by Home, Login, Register, etc.) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/instructor/:id" element={<InstructorProfilePage />} />
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/become-instructor" element={<BecomeInstructorPage />} />
            <Route path="/teach" element={<Navigate to="/become-instructor" replace />} />

            {/* Nav and Footer Placeholders */}
            <Route path="/paths" element={<Placeholder title="Learning Paths" />} />
            <Route path="/contact" element={<Placeholder title="Contact Us" />} />
            <Route path="/about" element={<Placeholder title="About Us" />} />
            <Route path="/careers" element={<Placeholder title="Careers" />} />
            <Route path="/blog" element={<Placeholder title="Blog" />} />
            <Route path="/community" element={<Placeholder title="Community" />} />
            <Route path="/help" element={<Placeholder title="Help Center" />} />
            <Route path="/directory" element={<Placeholder title="Directory" />} />
            <Route path="/terms" element={<Placeholder title="Terms of Service" />} />
            <Route path="/privacy" element={<Placeholder title="Privacy Policy" />} />
            <Route path="/sitemap" element={<Placeholder title="Sitemap" />} />
            <Route path="/accessibility" element={<Placeholder title="Accessibility" />} />
          </Route>

          {/* Fullscreen quiz route - no navbar/sidebar */}
          <Route path="/courses/:courseId/quiz/:quizId" element={
            <ProtectedRoute allowedRoles={['STUDENT']}><QuizPage /></ProtectedRoute>
          } />

          {/* Dashboard Routes with Sidebar & Navbar */}
          <Route element={<DashboardLayout />}>
            {/* Student */}
            <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/courses" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentCourses /></ProtectedRoute>} />
            <Route path="/student/wishlist" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentWishlist /></ProtectedRoute>} />
            <Route path="/student/quizzes" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentQuizzes /></ProtectedRoute>} />
            <Route path="/student/certificates" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentCertificates /></ProtectedRoute>} />
            <Route path="/student/subscription" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentSubscription /></ProtectedRoute>} />
            <Route path="/courses/:courseId/learn" element={<ProtectedRoute allowedRoles={['STUDENT']}><CourseLearningPlayer /></ProtectedRoute>} />

            {/* Instructor */}
            <Route path="/instructor" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorDashboard /></ProtectedRoute>} />
            <Route path="/instructor/courses" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorCourses /></ProtectedRoute>} />
            <Route path="/instructor/create-course" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><CreateCourseForm /></ProtectedRoute>} />
            <Route path="/instructor/students" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorStudents /></ProtectedRoute>} />
            <Route path="/instructor/reviews" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorReviews /></ProtectedRoute>} />
            <Route path="/instructor/analytics" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorAnalytics /></ProtectedRoute>} />
            <Route path="/instructor/quiz-builder" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorQuizBuilder /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminCourses /></ProtectedRoute>} />
            <Route path="/admin/categories" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminCategories /></ProtectedRoute>} />
            <Route path="/admin/reviews" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><ModerateReviews /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminSubscriptions /></ProtectedRoute>} />

            {/* Super Admin */}
            <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/super-admin/admins" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><ManageAdmins /></ProtectedRoute>} />
            <Route path="/super-admin/analytics" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminAnalytics /></ProtectedRoute>} />
            <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><PlatformSettings /></ProtectedRoute>} />
            <Route path="/super-admin/subscriptions" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SubscriptionPlans /></ProtectedRoute>} />
            <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AuditLogs /></ProtectedRoute>} />
            <Route path="/super-admin/system" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SystemHealth /></ProtectedRoute>} />
            <Route path="/super-admin/users" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminUsers /></ProtectedRoute>} />
            <Route path="/super-admin/courses" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminCourses /></ProtectedRoute>} />

            {/* General Protected */}
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }
        }}
      />
    </AuthProvider>
  );
}
