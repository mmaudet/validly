import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { apiFetch, ApiError } from '../lib/api';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [expired, setExpired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.password_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setExpired(true);
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Validly" className="mx-auto h-24 w-auto" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">{t('app.name')}</h1>
          <p className="mt-2 text-gray-600">{t('auth.reset_title')}</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          {success ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
                {t('auth.reset_success')}
              </div>
              <p className="text-center text-sm text-gray-600">
                <Link to="/login" className="text-blue-600 hover:underline">
                  {t('auth.reset_go_login')}
                </Link>
              </p>
            </div>
          ) : expired ? (
            <div className="space-y-4">
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                {t('auth.reset_expired')}
              </div>
              <p className="text-center text-sm text-gray-600">
                <Link to="/forgot-password" className="text-blue-600 hover:underline">
                  {t('auth.reset_go_forgot')}
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('auth.reset_new_password')}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  {t('auth.reset_confirm_password')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('auth.reset_submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
