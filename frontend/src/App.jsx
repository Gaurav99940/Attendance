import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { AppLayout } from './components/layout/AppLayout';
import { EmployeeLayout } from './components/employee/EmployeeLayout';

// Admin Pages
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { LiveAttendancePage } from './pages/LiveAttendancePage';
import { AttendanceHistoryPage } from './pages/AttendanceHistoryPage';
import { AdminLeavesPage } from './pages/AdminLeavesPage';
import { CalendarPage } from './pages/CalendarPage';
import { ReportsPage } from './pages/ReportsPage';
import { UnknownDetectionsPage } from './pages/UnknownDetectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

// Employee App Pages
import { EmployeeHomePage } from './pages/employee/EmployeeHomePage';
import { EmployeeTodayPage } from './pages/employee/EmployeeTodayPage';
import { EmployeeAttendancePage } from './pages/employee/EmployeeAttendancePage';
import { EmployeeCalendarPage } from './pages/employee/EmployeeCalendarPage';
import { EmployeeLeavesPage } from './pages/employee/EmployeeLeavesPage';
import { EmployeeRegularizePage } from './pages/employee/EmployeeRegularizePage';
import { EmployeeShiftPage } from './pages/employee/EmployeeShiftPage';
import { EmployeeHolidaysPage } from './pages/employee/EmployeeHolidaysPage';
import { EmployeeProfilePage } from './pages/employee/EmployeeProfilePage';


const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, isEmployee, isAdmin } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'admin' && isEmployee) {
    return <Navigate to="/app" replace />;
  }

  return children;
};

const RootRedirect = () => {
  const { isAuthenticated, isEmployee } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isEmployee) return <Navigate to="/app" replace />;
  return <Navigate to="/dashboard" replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Root smart redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* ================= ADMIN PLATFORM ROUTES ================= */}
            <Route
              element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="live" element={<LiveAttendancePage />} />
              <Route path="history" element={<AttendanceHistoryPage />} />
              <Route path="leaves" element={<AdminLeavesPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="unknown" element={<UnknownDetectionsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* ================= EMPLOYEE SELF-SERVICE APP ROUTES ================= */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmployeeHomePage />} />
              <Route path="today" element={<EmployeeTodayPage />} />
              <Route path="attendance" element={<EmployeeAttendancePage />} />
              <Route path="calendar" element={<EmployeeCalendarPage />} />
              <Route path="leaves" element={<EmployeeLeavesPage />} />
              <Route path="regularize" element={<EmployeeRegularizePage />} />
              <Route path="shift" element={<EmployeeShiftPage />} />
              <Route path="holidays" element={<EmployeeHolidaysPage />} />
              <Route path="profile" element={<EmployeeProfilePage />} />
            </Route>


            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
};
