import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardLayout, PublicLayout } from './components/layout/Layout';
import { ProtectedRoute, GuestRoute } from './components/routes/ProtectedRoute';

// Pages — code-split: each page becomes its own chunk, loaded on navigation.
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const InstructorProfilePage = lazy(() => import('./pages/InstructorProfilePage'));
const CertificateVerifyPage = lazy(() => import('./pages/CertificateVerifyPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

// Dashboards
const StudentDashboard = lazy(() => import('./pages/dashboard/StudentDashboard'));
const InstructorDashboard = lazy(() => import('./pages/dashboard/InstructorDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const InstructorCourses = lazy(() => import('./pages/dashboard/instructor/InstructorCourses'));
const CreateCourseForm = lazy(() => import('./pages/dashboard/instructor/CreateCourseForm'));
const InstructorStudents = lazy(() => import('./pages/dashboard/instructor/InstructorStudents'));
const InstructorReviews = lazy(() => import('./pages/dashboard/instructor/InstructorReviews'));
const InstructorAnalytics = lazy(() => import('./pages/dashboard/instructor/InstructorAnalytics'));
const InstructorQuizBuilder = lazy(() => import('./pages/dashboard/instructor/InstructorQuizBuilder'));
const InstructorAssessments = lazy(() => import('./pages/dashboard/instructor/InstructorAssessments'));
const AssessmentReportPage = lazy(() => import('./pages/dashboard/instructor/AssessmentReportPage'));
const AdminUsers = lazy(() => import('./pages/dashboard/admin/AdminUsers'));
const AdminStudents = lazy(() => import('./pages/dashboard/admin/AdminStudents'));
const AdminInstructors = lazy(() => import('./pages/dashboard/admin/AdminInstructors'));
const AdminAssignStudents = lazy(() => import('./pages/dashboard/admin/AdminAssignStudents'));
const AdminAssignSections = lazy(() => import('./pages/dashboard/admin/AdminAssignSections'));
const AdminAssignCategories = lazy(() => import('./pages/dashboard/admin/AdminAssignCategories'));
const AdminAssignSemesters = lazy(() => import('./pages/dashboard/admin/AdminAssignSemesters'));
const AdminAssignYears = lazy(() => import('./pages/dashboard/admin/AdminAssignYears'));
const InstructorContentOrder = lazy(() => import('./pages/dashboard/instructor/InstructorContentOrder'));
const SuperAdminStudents = lazy(() => import('./pages/dashboard/superadmin/SuperAdminStudents'));
const StudentDetail = lazy(() => import('./pages/dashboard/superadmin/StudentDetail'));
const SuperAdminInstructors = lazy(() => import('./pages/dashboard/superadmin/SuperAdminInstructors'));
const InstructorDetail = lazy(() => import('./pages/dashboard/superadmin/InstructorDetail'));
const SuperAdminCourses = lazy(() => import('./pages/dashboard/superadmin/SuperAdminCourses'));
const AdminCourses = lazy(() => import('./pages/dashboard/admin/AdminCourses'));
const BecomeInstructorPage = lazy(() => import('./pages/BecomeInstructorPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const UserDetail = lazy(() => import('./pages/dashboard/admin/UserDetail'));
const StudentCourses = lazy(() => import('./pages/dashboard/student/StudentCourses'));
const StudentWishlist = lazy(() => import('./pages/dashboard/student/StudentWishlist'));
const StudentQuizzes = lazy(() => import('./pages/dashboard/student/StudentQuizzes'));
const StudentExams = lazy(() => import('./pages/dashboard/student/StudentExams'));
const StudentAssignments = lazy(() => import('./pages/dashboard/student/StudentAssignments'));
const StudentCertificates = lazy(() => import('./pages/dashboard/student/StudentCertificates'));
const StudentGrades = lazy(() => import('./pages/dashboard/student/StudentGrades'));
const CourseLearningPlayer = lazy(() => import('./pages/dashboard/student/CourseLearningPlayer'));
const SuperAdminAnalytics = lazy(() => import('./pages/dashboard/superadmin/SuperAdminAnalytics'));
const AuditLogs = lazy(() => import('./pages/dashboard/superadmin/AuditLogs'));
const SuperAdminPermissions = lazy(() => import('./pages/dashboard/superadmin/SuperAdminPermissions'));
const SystemHealth = lazy(() => import('./pages/dashboard/superadmin/SystemHealth'));
const PlatformSettings = lazy(() => import('./pages/dashboard/superadmin/PlatformSettings'));
const ManageAdmins = lazy(() => import('./pages/dashboard/superadmin/ManageAdmins'));
const DepartmentOverview = lazy(() => import('./pages/dashboard/superadmin/DepartmentOverview'));
const DepartmentDetail = lazy(() => import('./pages/dashboard/superadmin/DepartmentDetail'));
const CategoryOverview = lazy(() => import('./pages/dashboard/superadmin/CategoryOverview'));
const CategoryDetail = lazy(() => import('./pages/dashboard/superadmin/CategoryDetail'));
const CreateAdmin = lazy(() => import('./pages/dashboard/superadmin/CreateAdmin'));
const AIAnalytics = lazy(() => import('./pages/dashboard/superadmin/AIAnalytics'));
const SuperAdminReports = lazy(() => import('./pages/dashboard/superadmin/SuperAdminReports'));
const AdminCategories = lazy(() => import('./pages/dashboard/admin/AdminCategories'));
const ModerateReviews = lazy(() => import('./pages/dashboard/admin/ModerateReviews'));
const AdminReports = lazy(() => import('./pages/dashboard/admin/AdminReports'));
const AdminAnnouncements = lazy(() => import('./pages/dashboard/admin/AdminAnnouncements'));
const AdminBulkEnrollment = lazy(() => import('./pages/dashboard/admin/AdminBulkEnrollment'));
const AdminEnrollments = lazy(() => import('./pages/dashboard/admin/AdminEnrollments'));
const AdminBulkImport = lazy(() => import('./pages/dashboard/admin/AdminBulkImport'));
const AdminStudentProgress = lazy(() => import('./pages/dashboard/admin/AdminStudentProgress'));
const AdminAssignments = lazy(() => import('./pages/dashboard/admin/AdminAssignments'));
const AdminTimetable = lazy(() => import('./pages/dashboard/admin/AdminTimetable'));
const InstructorChangelog = lazy(() => import('./pages/dashboard/instructor/InstructorChangelog'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const InstructorLiveSessions = lazy(() => import('./pages/dashboard/instructor/InstructorLiveSessions'));
const AdminLiveSessions = lazy(() => import('./pages/dashboard/admin/AdminLiveSessions'));

// Placeholder empty page for other routes
const Placeholder = ({ title }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/40 border border-border border-dashed rounded-2xl m-4">
    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 text-2xl shadow-inner">🚧</div>
    <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'Outfit' }}>{title}</h2>
    <p className="text-muted-foreground max-w-sm font-medium">This page is under construction. Check back soon for updates!</p>
  </div>
);

// Shown while a lazy page chunk is being fetched
const PageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
  </div>
);

// Catches lazy chunk load failures (offline, bad deploy) so the app shows a
// recoverable screen instead of unmounting the whole tree.
class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="text-4xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground font-medium mb-6">The page failed to load. It may be a temporary network issue.</p>
            <button
              onClick={this.handleReload}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteErrorBoundary>
          <Suspense fallback={<PageFallback />}>
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
              <Route path="/verify/:certId" element={<CertificateVerifyPage />} />
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
              <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'SUPER_ADMIN']}><QuizPage /></ProtectedRoute>
            } />

            {/* Dashboard Routes with Sidebar & Navbar */}
            <Route element={<DashboardLayout />}>
              {/* Student */}
              <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/courses" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentCourses /></ProtectedRoute>} />
              <Route path="/student/wishlist" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentWishlist /></ProtectedRoute>} />
              <Route path="/student/quizzes" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentQuizzes /></ProtectedRoute>} />
              <Route path="/student/exams" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentExams /></ProtectedRoute>} />
              <Route path="/student/assignments" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentAssignments /></ProtectedRoute>} />
              <Route path="/student/certificates" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentCertificates /></ProtectedRoute>} />
              <Route path="/student/grades" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentGrades /></ProtectedRoute>} />
              <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['STUDENT']}><SettingsPage /></ProtectedRoute>} />
              <Route path="/courses/:courseId/learn" element={<ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><CourseLearningPlayer /></ProtectedRoute>} />

              {/* Instructor */}
              <Route path="/instructor" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorDashboard /></ProtectedRoute>} />
              <Route path="/instructor/courses" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorCourses /></ProtectedRoute>} />
              <Route path="/instructor/create-course" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><CreateCourseForm /></ProtectedRoute>} />
              <Route path="/instructor/students" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorStudents /></ProtectedRoute>} />
              <Route path="/instructor/students/:id" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><UserDetail /></ProtectedRoute>} />
              <Route path="/instructor/reviews" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorReviews /></ProtectedRoute>} />
              <Route path="/instructor/analytics" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorAnalytics /></ProtectedRoute>} />
              <Route path="/instructor/quiz-builder" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorQuizBuilder /></ProtectedRoute>} />
              <Route path="/instructor/assessments" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorAssessments /></ProtectedRoute>} />
              <Route path="/instructor/content-order" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorContentOrder /></ProtectedRoute>} />
              <Route path="/instructor/assessments/:quizId/student/:studentId" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><AssessmentReportPage /></ProtectedRoute>} />
              <Route path="/instructor/versions" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorChangelog /></ProtectedRoute>} />
              <Route path="/instructor/live-sessions" element={<ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><InstructorLiveSessions /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminStudents /></ProtectedRoute>} />
              <Route path="/admin/instructors" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminInstructors /></ProtectedRoute>} />
              <Route path="/admin/assign-students" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAssignStudents /></ProtectedRoute>} />
              <Route path="/admin/assign-sections" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAssignSections /></ProtectedRoute>} />
              <Route path="/admin/assign-categories" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAssignCategories /></ProtectedRoute>} />
              <Route path="/admin/assign-semesters" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAssignSemesters /></ProtectedRoute>} />
              <Route path="/admin/assign-years" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAssignYears /></ProtectedRoute>} />
              <Route path="/admin/users/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><UserDetail /></ProtectedRoute>} />
              <Route path="/admin/courses" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminCourses /></ProtectedRoute>} />
              <Route path="/admin/categories" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminCategories /></ProtectedRoute>} />
              <Route path="/admin/reviews" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><ModerateReviews /></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminReports /></ProtectedRoute>} />
              <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAnnouncements /></ProtectedRoute>} />
              <Route path="/admin/bulk-enroll" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminBulkEnrollment /></ProtectedRoute>} />
              <Route path="/admin/enrollments" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminEnrollments /></ProtectedRoute>} />
              <Route path="/admin/bulk-import" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminBulkImport /></ProtectedRoute>} />
              <Route path="/admin/student-progress" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminStudentProgress /></ProtectedRoute>} />
              <Route path="/admin/assignments" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminAssignments /></ProtectedRoute>} />
              <Route path="/admin/timetable" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminTimetable /></ProtectedRoute>} />
              <Route path="/admin/attendance" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminLiveSessions /></ProtectedRoute>} />
              {/* Department admins see their own department's audit trail */}
              <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AuditLogs /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><SettingsPage /></ProtectedRoute>} />

              {/* Super Admin */}
              <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/super-admin/admins" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><ManageAdmins /></ProtectedRoute>} />
              <Route path="/super-admin/students" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminStudents /></ProtectedRoute>} />
              <Route path="/super-admin/students/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><StudentDetail /></ProtectedRoute>} />
              <Route path="/super-admin/instructors" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminInstructors /></ProtectedRoute>} />
              <Route path="/super-admin/instructors/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><InstructorDetail /></ProtectedRoute>} />
              <Route path="/super-admin/courses" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminCourses /></ProtectedRoute>} />
              <Route path="/super-admin/departments" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><DepartmentOverview /></ProtectedRoute>} />
              <Route path="/super-admin/departments/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><DepartmentDetail /></ProtectedRoute>} />
              <Route path="/super-admin/categories" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><CategoryOverview /></ProtectedRoute>} />
              <Route path="/super-admin/categories/:id" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><CategoryDetail /></ProtectedRoute>} />
              <Route path="/super-admin/admins/create" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><CreateAdmin /></ProtectedRoute>} />
              <Route path="/super-admin/analytics" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminAnalytics /></ProtectedRoute>} />
              <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><PlatformSettings /></ProtectedRoute>} />
              <Route path="/super-admin/reports" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminReports /></ProtectedRoute>} />
              <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AuditLogs /></ProtectedRoute>} />
              <Route path="/super-admin/permissions" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminPermissions /></ProtectedRoute>} />
              <Route path="/super-admin/system" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SystemHealth /></ProtectedRoute>} />
              <Route path="/super-admin/ai-analytics" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AIAnalytics /></ProtectedRoute>} />

              {/* General Protected */}
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
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
