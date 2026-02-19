import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <span className="text-2xl font-bold text-blue-600">404</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{t('errors.not_found_title')}</h2>
        <p className="mt-2 text-gray-600">{t('errors.not_found_message')}</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('errors.go_to_dashboard')}
        </Link>
      </div>
    </div>
  );
}
