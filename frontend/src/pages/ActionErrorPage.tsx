import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router';

export function ActionErrorPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const path = location.pathname;

  let title: string;
  let message: string;

  if (path.includes('expired')) {
    title = t('action.token_expired') || t('email.token_expired');
    message = t('email.token_expired_detail') || 'This action link has expired. Please contact the workflow initiator for a new link.';
  } else if (path.includes('used')) {
    title = t('action.token_used') || t('email.token_used');
    message = t('email.token_used_detail') || 'This action link has already been used. Your decision was already recorded.';
  } else {
    title = t('action.token_invalid') || t('errors.not_found');
    message = 'This action link is invalid. Please check the link or contact the workflow initiator.';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-gray-600">{message}</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {t('action.go_to_dashboard')}
        </Link>
      </div>
    </div>
  );
}
