import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

interface ErrorPageProps {
  error?: Error;
  onReset?: () => void;
}

export function ErrorPage({ error, onReset }: ErrorPageProps) {
  const { t } = useTranslation();

  const handleRetry = () => {
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="text-2xl font-bold text-red-600">500</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{t('errors.server_error_title')}</h2>
        <p className="mt-2 text-gray-600">{t('errors.server_error_message')}</p>
        {import.meta.env.DEV && error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">Error details</summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs text-red-700">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleRetry}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('errors.try_again')}
          </button>
          <Link
            to="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('errors.go_to_dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
