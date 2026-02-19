import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import './i18n';
import { DashboardPage } from './pages/DashboardPage';
import { WorkflowDetailPage } from './pages/WorkflowDetailPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ActionConfirmPage } from './pages/ActionConfirmPage';
import { ActionErrorPage } from './pages/ActionErrorPage';

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
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/workflows/:id" element={<AuthGuard><WorkflowDetailPage /></AuthGuard>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/action/confirm" element={<ActionConfirmPage />} />
          <Route path="/action/expired" element={<ActionErrorPage />} />
          <Route path="/action/used" element={<ActionErrorPage />} />
          <Route path="/action/invalid" element={<ActionErrorPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
