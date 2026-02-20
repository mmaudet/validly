import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../lib/api';
import { forgotPasswordSchema, ForgotPasswordForm } from '../lib/validation';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setError('');
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: data.email }),
      });
      setSuccess(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Validly" className="mx-auto h-16 w-auto sm:h-24" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">{t('app.name')}</h1>
          <p className="mt-2 text-gray-600">{t('auth.forgot_title')}</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          {success ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
                {t('auth.forgot_success')}
              </div>
              <p className="text-center text-sm text-gray-600">
                <Link to="/login" className="inline-block py-1 text-blue-600 hover:underline">
                  {t('auth.forgot_back')}
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <p className="text-sm text-gray-600">{t('auth.forgot_instruction')}</p>

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{t(errors.email.message!)}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('auth.forgot_submit')}
              </button>

              <p className="text-center text-sm text-gray-600">
                <Link to="/login" className="inline-block py-1 text-blue-600 hover:underline">
                  {t('auth.forgot_back')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
