import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t('app.name')}</h1>
        <p className="mt-2 text-lg text-gray-600">{t('app.tagline')}</p>
      </div>
    </div>
  );
}
