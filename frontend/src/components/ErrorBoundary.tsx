import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { ErrorPage } from '../pages/ErrorPage';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const err = error instanceof Error ? error : new Error(String(error));
  return <ErrorPage error={err} onReset={resetErrorBoundary} />;
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset app state — navigate to dashboard
        window.location.href = '/dashboard';
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
