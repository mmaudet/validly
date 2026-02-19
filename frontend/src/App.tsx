import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router';
import './i18n';
import { HomePage } from './pages/HomePage';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
