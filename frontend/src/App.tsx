import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './i18n';
import { DashboardPage } from './pages/DashboardPage';
import { WorkflowCreatePage } from './pages/WorkflowCreatePage';
import { WorkflowDetailPage } from './pages/WorkflowDetailPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { TemplateFormPage } from './pages/TemplateFormPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ActionConfirmPage } from './pages/ActionConfirmPage';
import { ActionErrorPage } from './pages/ActionErrorPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AppErrorBoundary } from './components/ErrorBoundary';
import { ProfilePage } from './pages/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
            <Route path="/workflows/new" element={<AuthGuard><WorkflowCreatePage /></AuthGuard>} />
            <Route path="/workflows/:id" element={<AuthGuard><WorkflowDetailPage /></AuthGuard>} />
            <Route path="/admin/users" element={<AuthGuard><AdminUsersPage /></AuthGuard>} />
            <Route path="/templates/new" element={<AuthGuard><TemplateFormPage /></AuthGuard>} />
            <Route path="/templates/:id/edit" element={<AuthGuard><TemplateFormPage /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/action/confirm" element={<ActionConfirmPage />} />
            <Route path="/action/expired" element={<ActionErrorPage />} />
            <Route path="/action/used" element={<ActionErrorPage />} />
            <Route path="/action/invalid" element={<ActionErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
