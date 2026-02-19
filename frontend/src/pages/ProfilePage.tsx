import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { apiFetch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, fetchProfile } = useAuth();

  // Section 1: Name editing
  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Section 2: Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Section 3: Language
  const [localeLoading, setLocaleLoading] = useState(false);
  const [localeSuccess, setLocaleSuccess] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameSuccess(false);
    setNameError(null);
    try {
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await fetchProfile();
      setNameSuccess(true);
    } catch (err: any) {
      setNameError(err?.message ?? t('common.error'));
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.confirm_password') + ' mismatch');
      return;
    }
    setPasswordLoading(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('incorrect')) {
        setPasswordError(t('profile.password_wrong'));
      } else {
        setPasswordError(err?.message ?? t('common.error'));
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLocaleChange = async (newLocale: string) => {
    setLocaleLoading(true);
    setLocaleSuccess(false);
    try {
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ locale: newLocale }),
      });
      await i18n.changeLanguage(newLocale);
      await fetchProfile();
      setLocaleSuccess(true);
    } catch {
      // silent on locale change failure
    } finally {
      setLocaleLoading(false);
    }
  };

  const currentLocale = user?.locale ?? i18n.language;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <img src="/logo.svg" alt="" className="h-8 w-auto" />
            Validly
          </h1>
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; {t('nav.dashboard')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">{t('profile.title')}</h2>

        {/* Section 1: Profile Information */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">{t('profile.info_section')}</h3>

          {/* Email (read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {t('profile.email_label')}
            </label>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>

          {/* Name editing */}
          <form onSubmit={handleSaveName} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.name_label')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameSuccess(false);
                }}
                minLength={1}
                maxLength={100}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {nameError && (
              <p className="text-sm text-red-600">{nameError}</p>
            )}
            {nameSuccess && (
              <p className="text-sm text-green-600">{t('profile.name_saved')}</p>
            )}
            <button
              type="submit"
              disabled={nameLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {nameLoading ? t('common.loading') : t('profile.save_name')}
            </button>
          </form>
        </div>

        {/* Section 2: Change Password */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">{t('profile.password_section')}</h3>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.current_password')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError(null);
                }}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.new_password')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('profile.confirm_password')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            {passwordSuccess && (
              <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
                {t('profile.password_changed')}
              </div>
            )}
            <button
              type="submit"
              disabled={passwordLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {passwordLoading ? t('common.loading') : t('profile.change_password')}
            </button>
          </form>
        </div>

        {/* Section 3: Language Preference */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">{t('profile.language_section')}</h3>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={localeLoading}
              onClick={() => currentLocale !== 'en' && handleLocaleChange('en')}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                currentLocale === 'en'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-60`}
            >
              English
            </button>
            <button
              type="button"
              disabled={localeLoading}
              onClick={() => currentLocale !== 'fr' && handleLocaleChange('fr')}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                currentLocale === 'fr'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-60`}
            >
              Fran&ccedil;ais
            </button>
          </div>
          {localeSuccess && (
            <p className="mt-2 text-sm text-green-600">{t('profile.language_saved')}</p>
          )}
        </div>
      </main>
    </div>
  );
}
