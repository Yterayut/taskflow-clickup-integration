import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@store/store';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ProtectedRoute } from '@components/auth/ProtectedRoute';
import { MainLayout } from '@components/layout/MainLayout';

// Pages
import LoginPage from '@pages/LoginPage';
import DashboardPage from '@pages/DashboardPage';
import TasksPage from '@pages/TasksPage';
import TeamPage from '@pages/TeamPage';
import AttendancePage from '@pages/AttendancePage';
import ReportsPage from '@pages/ReportsPage';
import SettingsPage from '@pages/SettingsPage';
import NotFoundPage from '@pages/NotFoundPage';

// Styles
import '@/styles/globals.css';

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Router>
              <div className="min-h-screen bg-background text-foreground">
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* Protected routes */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Navigate to="/dashboard" replace />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <MainLayout>
                        <DashboardPage />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/tasks" element={
                    <ProtectedRoute>
                      <MainLayout>
                        <TasksPage />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/team" element={
                    <ProtectedRoute roles={['manager', 'team_lead']}>
                      <MainLayout>
                        <TeamPage />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/attendance" element={
                    <ProtectedRoute>
                      <MainLayout>
                        <AttendancePage />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/reports" element={
                    <ProtectedRoute roles={['manager', 'team_lead']}>
                      <MainLayout>
                        <ReportsPage />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <MainLayout>
                        <SettingsPage />
                      </MainLayout>
                    </ProtectedRoute>
                  } />
                  
                  {/* 404 route */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </div>
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;