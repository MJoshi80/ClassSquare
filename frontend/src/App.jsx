import ErrorBoundary from "./components/ErrorBoundary";
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import HodDashboard from './pages/HodDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const dashboardMap = {
    admin: '/admin',
    hod: '/hod',
    faculty: '/faculty',
    student: '/student',
  };
  return <Navigate to={dashboardMap[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/hod" element={
          <ProtectedRoute allowedRoles={['admin', 'hod']}>
            <HodDashboard />
          </ProtectedRoute>
        } />
        <Route path="/faculty" element={
          <ProtectedRoute allowedRoles={['admin', 'hod', 'faculty']}>
            <FacultyDashboard />
          </ProtectedRoute>
        } />
        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['admin', 'hod', 'faculty', 'student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </AuthProvider>
  );
}
